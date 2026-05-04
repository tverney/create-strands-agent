/**
 * Integration tests for full scaffold generation.
 *
 * These tests exercise the complete scaffold pipeline using the real file system
 * with isolated temp directories. Each test:
 *   1. Scaffolds a project with a specific module combination
 *   2. Verifies all expected files exist (and no unexpected module files)
 *   3. Creates type stubs for external dependencies
 *   4. Runs `tsc --noEmit` to verify zero TypeScript compilation errors
 *
 * Type stubs are used instead of real npm install because:
 *   - Some packages may have different type definitions than expected
 *   - The SDK's type definitions may not match the template's usage exactly
 *   - Tests should be deterministic and not depend on network access
 *
 * Requirements: 11.1, 13.1, 13.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile as fsWriteFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { scaffold } from './scaffold.js';
import type { ModuleName, ScaffoldConfig } from './types.js';

const execFileAsync = promisify(execFile);

// ── Constants ───────────────────────────────────────────────────────────────

const ALL_MODULES: ModuleName[] = ['memory', 'guardrails', 'a2a', 'agentcore'];

/** Base files that are always generated regardless of module selection. */
const BASE_FILES = [
  'package.json',
  'tsconfig.json',
  '.env.example',
  '.gitignore',
  '.eslintrc.json',
  'README.md',
  'src/index.ts',
];

/** Files generated per optional module. */
const MODULE_FILES: Record<ModuleName, string[]> = {
  memory: ['src/memory/index.ts', 'src/memory/provider.ts'],
  guardrails: [
    'src/guardrails/index.ts',
    'src/guardrails/input-guardrail.ts',
    'src/guardrails/output-guardrail.ts',
  ],
  a2a: ['src/a2a/server.ts', 'src/a2a/agent-card.json'],
  agentcore: [
    'deployment/Dockerfile',
    'deployment/deploy.sh',
    'deployment/agentcore-config.json',
    'src/server.ts',
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

/** Build a ScaffoldConfig for the given modules. */
function makeConfig(
  modules: ModuleName[],
  projectDir: string,
  projectName = 'test-project',
): ScaffoldConfig {
  return {
    projectName,
    projectDir,
    packageManager: 'npm',
    modules: new Set(modules),
    skipInstall: true,
    isNonInteractive: true,
  };
}

/** Assert that every file in the list exists under projectDir. */
function assertFilesExist(projectDir: string, files: string[]): void {
  for (const file of files) {
    const filePath = join(projectDir, file);
    expect(existsSync(filePath), `Expected file to exist: ${file}`).toBe(true);
  }
}

/** Assert that every file in the list does NOT exist under projectDir. */
function assertFilesAbsent(projectDir: string, files: string[]): void {
  for (const file of files) {
    const filePath = join(projectDir, file);
    expect(existsSync(filePath), `Expected file to be absent: ${file}`).toBe(false);
  }
}

/**
 * Create a stub package in node_modules with a minimal type declaration.
 * This allows `tsc --noEmit` to resolve imports without real npm packages.
 */
async function createStubPackage(
  projectDir: string,
  packageName: string,
  dtsContent: string,
): Promise<void> {
  const pkgDir = join(projectDir, 'node_modules', ...packageName.split('/'));
  await mkdir(pkgDir, { recursive: true });
  await fsWriteFile(
    join(pkgDir, 'package.json'),
    JSON.stringify({ name: packageName, version: '1.0.0', types: 'index.d.ts' }),
  );
  await fsWriteFile(join(pkgDir, 'index.d.ts'), dtsContent);
}

/**
 * Install type stubs for all external dependencies used by the generated project.
 * This replaces `npm install` for the purpose of `tsc --noEmit` validation.
 *
 * Uses the real `@types/node` from the workspace's node_modules (via symlink)
 * to provide proper Node.js type definitions including `console`, `process`,
 * and `node:` protocol module resolution. Only project-specific packages
 * (SDK, A2A, etc.) use minimal type stubs.
 */
async function installTypeStubs(
  projectDir: string,
  modules: ModuleName[],
): Promise<void> {
  const selectedModules = new Set(modules);
  const nodeModulesDir = join(projectDir, 'node_modules');
  await mkdir(nodeModulesDir, { recursive: true });

  // ── @types/node — symlink from workspace for full Node.js types ────
  const workspaceTypesNode = path.resolve('node_modules', '@types', 'node');
  const targetTypesDir = join(nodeModulesDir, '@types');
  await mkdir(targetTypesDir, { recursive: true });
  const { symlink } = await import('node:fs/promises');
  await symlink(workspaceTypesNode, join(targetTypesDir, 'node'), 'dir');

  // ── Base dependencies (always needed) ──────────────────────────────

  // @strands-agents/sdk
  await createStubPackage(
    projectDir,
    '@strands-agents/sdk',
    `
export interface AgentConfig {
  tools?: unknown[];
  model?: unknown;
  systemPrompt?: string;
  memory?: unknown;
  inputGuardrails?: unknown[];
  outputGuardrails?: unknown[];
  [key: string]: unknown;
}
export class Agent {
  constructor(config?: AgentConfig);
  invoke(prompt: string): Promise<unknown>;
}
export function tool(config: unknown): unknown;
`,
  );

  // zod
  await createStubPackage(
    projectDir,
    'zod',
    `
export function string(): unknown;
export function object(shape: unknown): unknown;
export function number(): unknown;
`,
  );

  // dotenv
  await createStubPackage(
    projectDir,
    'dotenv',
    `
export function config(options?: unknown): unknown;
`,
  );

  // dotenv/config (side-effect import)
  const dotenvDir = join(nodeModulesDir, 'dotenv');
  await fsWriteFile(join(dotenvDir, 'config.d.ts'), 'export {};\n');

  // ── Conditional dependencies ───────────────────────────────────────

  if (selectedModules.has('a2a')) {
    // @a2a-js/sdk — main package
    const a2aSdkDir = join(nodeModulesDir, '@a2a-js', 'sdk');
    await mkdir(a2aSdkDir, { recursive: true });
    await fsWriteFile(
      join(a2aSdkDir, 'package.json'),
      JSON.stringify({ name: '@a2a-js/sdk', version: '0.3.13', types: 'index.d.ts' }),
    );
    await fsWriteFile(
      join(a2aSdkDir, 'index.d.ts'),
      `
export interface AgentCard {
  name: string;
  description: string;
  protocolVersion: string;
  version: string;
  url: string;
  capabilities?: Record<string, unknown>;
  skills?: unknown[];
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  additionalInterfaces?: Array<{ url: string; transport: string }>;
  [key: string]: unknown;
}
export interface MessagePart { kind: string; text?: string; [key: string]: unknown; }
export interface Message {
  kind: 'message';
  messageId: string;
  role: string;
  parts: MessagePart[];
  contextId?: string;
}
export const AGENT_CARD_PATH: string;
`,
    );

    // @a2a-js/sdk/server
    const a2aServerDir = join(a2aSdkDir, 'server');
    await mkdir(a2aServerDir, { recursive: true });
    await fsWriteFile(
      join(a2aServerDir, 'package.json'),
      JSON.stringify({ name: '@a2a-js/sdk/server', version: '0.3.13', types: 'index.d.ts' }),
    );
    await fsWriteFile(
      join(a2aServerDir, 'index.d.ts'),
      `
export interface RequestContext {
  taskId: string;
  contextId: string;
  userMessage: { parts: Array<{ kind: string; text?: string }> };
  task?: unknown;
}
export interface ExecutionEventBus {
  publish(event: unknown): void;
  finished(): void;
}
export interface AgentExecutor {
  execute(ctx: RequestContext, bus: ExecutionEventBus): Promise<void>;
  cancelTask?: () => Promise<void>;
}
export class DefaultRequestHandler {
  constructor(card: unknown, store: unknown, executor: unknown);
}
export class InMemoryTaskStore {
  constructor();
}
`,
    );

    // @a2a-js/sdk/server/express
    const a2aExpressDir = join(a2aServerDir, 'express');
    await mkdir(a2aExpressDir, { recursive: true });
    await fsWriteFile(
      join(a2aExpressDir, 'package.json'),
      JSON.stringify({ name: '@a2a-js/sdk/server/express', version: '0.3.13', types: 'index.d.ts' }),
    );
    await fsWriteFile(
      join(a2aExpressDir, 'index.d.ts'),
      `
export function agentCardHandler(config: unknown): unknown;
export function jsonRpcHandler(config: unknown): unknown;
export function restHandler(config: unknown): unknown;
export const UserBuilder: { noAuthentication: unknown };
`,
    );

    // express (also needed for A2A)
    await createStubPackage(
      projectDir,
      'express',
      `
import { Server } from 'http';
declare function express(): express.Application;
declare namespace express {
  interface Request { body: any; params: any; query: any; }
  interface Response { status(code: number): Response; json(body: unknown): Response; }
  interface NextFunction { (err?: unknown): void; }
  interface Application {
    use(...args: unknown[]): Application;
    get(path: string, handler: (req: Request, res: Response) => void): Application;
    post(path: string, handler: (req: Request, res: Response) => void | Promise<void>): Application;
    listen(port: number, callback?: () => void): Server;
  }
  function json(): unknown;
}
export = express;
`,
    );

    await createStubPackage(
      projectDir,
      '@types/express',
      `
import express from 'express';
export = express;
`,
    );

    // uuid
    await createStubPackage(
      projectDir,
      'uuid',
      `
export function v4(): string;
`,
    );
  }

  if (selectedModules.has('agentcore')) {
    // express — only create if not already created by A2A
    if (!selectedModules.has('a2a')) {
      await createStubPackage(
        projectDir,
        'express',
        `
import { Server } from 'http';
declare function express(): express.Application;
declare namespace express {
  interface Request {
    body: any;
    params: any;
    query: any;
  }
  interface Response {
    status(code: number): Response;
    json(body: unknown): Response;
  }
  interface NextFunction {
    (err?: unknown): void;
  }
  interface Application {
    use(...args: unknown[]): Application;
    get(path: string, handler: (req: Request, res: Response) => void): Application;
    post(path: string, handler: (req: Request, res: Response) => void | Promise<void>): Application;
    listen(port: number, callback?: () => void): Server;
  }
  function json(): unknown;
}
export = express;
`,
      );

      await createStubPackage(
        projectDir,
        '@types/express',
        `
import express from 'express';
export = express;
`,
      );
    }

    await createStubPackage(
      projectDir,
      '@aws-sdk/client-bedrock-agentcore',
      `
export class BedrockAgentCoreClient {
  constructor(config?: unknown);
}
`,
    );
  }
}

/**
 * Run `tsc --noEmit` in the given project directory and return the result.
 * Uses the workspace's TypeScript installation since the generated project
 * uses type stubs instead of real npm install.
 */
async function runTsc(
  projectDir: string,
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  // Use the workspace's tsc binary
  const tscBin = path.resolve('node_modules', '.bin', 'tsc');
  try {
    const { stdout, stderr } = await execFileAsync(
      tscBin,
      ['--noEmit', '--project', join(projectDir, 'tsconfig.json')],
      {
        cwd: projectDir,
        timeout: 60_000,
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      },
    );
    return { success: true, stdout, stderr };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string };
    return {
      success: false,
      stdout: execErr.stdout ?? '',
      stderr: execErr.stderr ?? '',
    };
  }
}

/**
 * Resolve the path to the local tsx binary installed in the project's node_modules.
 */
const tsxBin = path.resolve('node_modules', '.bin', 'tsx');

/**
 * Helper to run the CLI via tsx and capture stdout/stderr/exit code.
 * Uses the locally installed tsx binary to avoid npx registry lookups.
 */
async function runCLI(
  args: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const cliPath = path.resolve('src/index.ts');
  try {
    const { stdout, stderr } = await execFileAsync(
      tsxBin,
      [cliPath, ...args],
      {
        cwd: cwd ?? path.resolve(''),
        timeout: 15_000,
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      },
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as {
      stdout?: string;
      stderr?: string;
      code?: number;
      status?: number;
    };
    return {
      stdout: execErr.stdout ?? '',
      stderr: execErr.stderr ?? '',
      exitCode: execErr.status ?? execErr.code ?? 1,
    };
  }
}

/**
 * Detect whether the current Node.js runtime meets the CLI's minimum (v20).
 * The CLI subprocess test is skipped on Node < 20 because the CLI exits
 * at the version check before reaching the scaffolding code.
 */
const currentMajor = parseInt(process.version.slice(1).split('.')[0], 10);
const nodeIsAtLeast20 = currentMajor >= 20;

// ── Integration Tests ───────────────────────────────────────────────────────

describe('Integration: scaffold with no modules', { timeout: 60_000 }, () => {
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'integration-none-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('generates all base files, no module files, and compiles with zero errors', async () => {
    const projectDir = join(tmpDir, 'test-project');
    const config = makeConfig([], projectDir);

    // Scaffold
    const result = await scaffold(config);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    // All base files exist
    assertFilesExist(projectDir, BASE_FILES);

    // No module files exist
    for (const mod of ALL_MODULES) {
      assertFilesAbsent(projectDir, MODULE_FILES[mod]);
    }

    // Install type stubs and run tsc
    await installTypeStubs(projectDir, []);
    const tsc = await runTsc(projectDir);
    expect(tsc.success, `tsc --noEmit failed:\n${tsc.stdout}\n${tsc.stderr}`).toBe(true);
  });
});

describe('Integration: scaffold with all modules', { timeout: 60_000 }, () => {
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'integration-all-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('generates all base and module files, and compiles with zero errors', async () => {
    const projectDir = join(tmpDir, 'test-project');
    const config = makeConfig(ALL_MODULES, projectDir);

    // Scaffold
    const result = await scaffold(config);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    // All base files exist
    assertFilesExist(projectDir, BASE_FILES);

    // All module files exist
    for (const mod of ALL_MODULES) {
      assertFilesExist(projectDir, MODULE_FILES[mod]);
    }

    // Verify package.json includes all module dependencies
    const pkgContent = await readFile(join(projectDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    expect(pkg.dependencies).toHaveProperty('@a2a-js/sdk');
    expect(pkg.dependencies).toHaveProperty('express');
    expect(pkg.dependencies).toHaveProperty('@aws-sdk/client-bedrock-agentcore');
    expect(pkg.devDependencies).toHaveProperty('@types/express');

    // Install type stubs and run tsc
    await installTypeStubs(projectDir, ALL_MODULES);
    const tsc = await runTsc(projectDir);
    expect(tsc.success, `tsc --noEmit failed:\n${tsc.stdout}\n${tsc.stderr}`).toBe(true);
  });
});

describe('Integration: scaffold with each module individually', { timeout: 60_000 }, () => {
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'integration-single-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  for (const targetModule of ALL_MODULES) {
    it(`generates correct files for "${targetModule}" module only, and compiles with zero errors`, async () => {
      const projectDir = join(tmpDir, `test-${targetModule}`);
      const config = makeConfig([targetModule], projectDir, `test-${targetModule}`);

      // Scaffold
      const result = await scaffold(config);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // All base files exist
      assertFilesExist(projectDir, BASE_FILES);

      // Only the target module's files exist
      for (const mod of ALL_MODULES) {
        if (mod === targetModule) {
          assertFilesExist(projectDir, MODULE_FILES[mod]);
        } else {
          assertFilesAbsent(projectDir, MODULE_FILES[mod]);
        }
      }

      // Install type stubs and run tsc
      await installTypeStubs(projectDir, [targetModule]);
      const tsc = await runTsc(projectDir);
      expect(tsc.success, `tsc --noEmit failed for module "${targetModule}":\n${tsc.stdout}\n${tsc.stderr}`).toBe(true);
    });
  }
});

describe.skipIf(!nodeIsAtLeast20)(
  'Integration: non-interactive full run via CLI',
  { timeout: 60_000 },
  () => {
    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'integration-cli-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('scaffolds a complete project with --yes --modules memory,guardrails --no-install', async () => {
      const projectName = 'cli-integration-test';
      const projectDir = join(tmpDir, projectName);

      // Run the CLI in the temp directory so the project is created there
      const { stdout, stderr, exitCode } = await runCLI(
        [projectName, '--yes', '--modules', 'memory,guardrails', '--no-install'],
        tmpDir,
      );

      expect(
        exitCode,
        `CLI exited with code ${exitCode}:\nstdout: ${stdout}\nstderr: ${stderr}`,
      ).toBe(0);

      // Verify the project directory was created
      expect(existsSync(projectDir), 'Project directory should exist').toBe(true);

      // All base files exist
      assertFilesExist(projectDir, BASE_FILES);

      // Memory and guardrails files exist
      assertFilesExist(projectDir, MODULE_FILES.memory);
      assertFilesExist(projectDir, MODULE_FILES.guardrails);

      // A2A and AgentCore files are absent
      assertFilesAbsent(projectDir, MODULE_FILES.a2a);
      assertFilesAbsent(projectDir, MODULE_FILES.agentcore);

      // Verify package.json has correct project name and no extra deps
      const pkgContent = await readFile(join(projectDir, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgContent);
      expect(pkg.name).toBe(projectName);
      expect(pkg.dependencies).not.toHaveProperty('@a2a-js/sdk');
      expect(pkg.dependencies).not.toHaveProperty('express');

      // Verify all 4 npm scripts are present
      expect(pkg.scripts).toHaveProperty('dev');
      expect(pkg.scripts).toHaveProperty('build');
      expect(pkg.scripts).toHaveProperty('start');
      expect(pkg.scripts).toHaveProperty('lint');

      // Install type stubs and run tsc to verify TypeScript correctness
      await installTypeStubs(projectDir, ['memory', 'guardrails']);
      const tsc = await runTsc(projectDir);
      expect(tsc.success, `tsc --noEmit failed:\n${tsc.stdout}\n${tsc.stderr}`).toBe(true);
    });
  },
);
