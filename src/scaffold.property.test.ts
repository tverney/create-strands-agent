import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scaffold, TEMPLATE_MANIFEST, toTemplateData } from './scaffold.js';
import type { ModuleName, ScaffoldConfig } from './types.js';

// ── Shared constants and helpers ────────────────────────────────────────────

const ALL_MODULES: ModuleName[] = ['memory', 'guardrails', 'a2a', 'agentcore'];

/** Files expected per module (output paths relative to project root). */
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

/** Dependencies added by each module (keys in package.json "dependencies"). */
const MODULE_DEPS: Record<ModuleName, string[]> = {
  memory: [],
  guardrails: [],
  a2a: ['@a2a-js/sdk', 'express', 'uuid'],
  agentcore: ['express', '@aws-sdk/client-bedrock-agentcore'],
};

/** Dev dependencies added by each module (keys in package.json "devDependencies"). */
const MODULE_DEV_DEPS: Record<ModuleName, string[]> = {
  memory: [],
  guardrails: [],
  a2a: ['@types/express'],
  agentcore: ['@types/express'],
};

/** Base dependencies always present. */
const BASE_DEPS = ['@strands-agents/sdk', 'zod', 'dotenv'];

/** Base dev dependencies always present. */
const BASE_DEV_DEPS = [
  'typescript',
  '@types/node',
  'eslint',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  'eslint-config-prettier',
  'eslint-plugin-prettier',
  'prettier',
  'tsx',
];

/** Base environment variables always present. */
const BASE_ENV_VARS = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'STRANDS_MODEL_ID',
];

/** Environment variables added by each module. */
const MODULE_ENV_VARS: Record<ModuleName, string[]> = {
  memory: [],
  guardrails: [],
  a2a: [],
  agentcore: ['AGENTCORE_REGION', 'AGENTCORE_ENDPOINT', 'AGENTCORE_AGENT_NAME'],
};

/** Import lines expected in src/index.ts per module. */
const MODULE_IMPORTS: Record<ModuleName, string | null> = {
  memory: "import { memory } from './memory/index.js';",
  guardrails: "import { guardrails } from './guardrails/index.js';",
  a2a: null, // A2A has a separate server file, no import in index.ts
  agentcore: null, // AgentCore has a separate server file, no import in index.ts
};

// ── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for a random subset of module names. */
const moduleSubsetArb = fc.subarray(ALL_MODULES, { minLength: 0, maxLength: 4 });

/**
 * Arbitrary for a valid npm-style project name.
 * Lowercase letters, digits, and hyphens. Must start with a letter, 1-21 chars.
 */
const projectNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/);

// ── Test helpers ────────────────────────────────────────────────────────────

let tmpDir: string;

/** Create a fresh temp directory before each test. */
async function createTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'scaffold-pbt-'));
}

/** Build a ScaffoldConfig for the given modules and project name. */
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

/**
 * Parse environment variable names from a .env.example file.
 * Extracts lines matching `VAR_NAME=...` (ignoring comments and blank lines).
 */
function parseEnvVarNames(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split('=')[0].trim())
    .filter((name) => name.length > 0);
}

// ── Property Tests ──────────────────────────────────────────────────────────

/**
 * Feature: strands-starter-kit, Property 1: Module-file correspondence
 *
 * For any subset of modules selected from {memory, guardrails, a2a, agentcore},
 * the generated scaffold SHALL contain source files for exactly the selected
 * modules — each selected module's directory and files exist, and each
 * unselected module's directory and files are absent.
 *
 * **Validates: Requirements 4.1, 4.4, 5.1, 5.5, 6.1, 6.5, 7.1, 7.4, 13.1**
 */
describe('Property 1: Module-file correspondence', () => {
  beforeEach(async () => {
    tmpDir = await createTmpDir();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('selected module files exist and unselected module files are absent', async () => {
    await fc.assert(
      fc.asyncProperty(moduleSubsetArb, async (modules) => {
        const projectDir = join(tmpDir, 'test-project');
        const config = makeConfig(modules, projectDir);
        const result = await scaffold(config);
        expect(result.success).toBe(true);

        const selectedSet = new Set(modules);

        for (const mod of ALL_MODULES) {
          for (const file of MODULE_FILES[mod]) {
            const filePath = join(projectDir, file);
            if (selectedSet.has(mod)) {
              expect(existsSync(filePath), `Expected ${file} to exist for module ${mod}`).toBe(true);
            } else {
              expect(existsSync(filePath), `Expected ${file} to be absent for unselected module ${mod}`).toBe(false);
            }
          }
        }

        // Clean up for next iteration
        await rm(projectDir, { recursive: true, force: true });
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: strands-starter-kit, Property 2: Dependencies match selected modules
 *
 * For any subset of modules selected, the generated package.json SHALL contain
 * exactly the union of base dependencies and the dependencies required by each
 * selected module — no more, no less.
 *
 * **Validates: Requirements 3.2, 6.4, 13.2**
 */
describe('Property 2: Dependencies match selected modules', () => {
  beforeEach(async () => {
    tmpDir = await createTmpDir();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('package.json dependencies are exactly base + selected module deps', async () => {
    await fc.assert(
      fc.asyncProperty(moduleSubsetArb, async (modules) => {
        const projectDir = join(tmpDir, 'test-project');
        const config = makeConfig(modules, projectDir);
        const result = await scaffold(config);
        expect(result.success).toBe(true);

        const pkgContent = await readFile(join(projectDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgContent);

        // Compute expected dependencies
        const expectedDeps = new Set(BASE_DEPS);
        const expectedDevDeps = new Set(BASE_DEV_DEPS);
        for (const mod of modules) {
          for (const dep of MODULE_DEPS[mod]) expectedDeps.add(dep);
          for (const dep of MODULE_DEV_DEPS[mod]) expectedDevDeps.add(dep);
        }

        const actualDeps = new Set(Object.keys(pkg.dependencies ?? {}));
        const actualDevDeps = new Set(Object.keys(pkg.devDependencies ?? {}));

        expect(actualDeps).toEqual(expectedDeps);
        expect(actualDevDeps).toEqual(expectedDevDeps);

        await rm(projectDir, { recursive: true, force: true });
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: strands-starter-kit, Property 3: Entry point imports match selected modules
 *
 * For any subset of modules selected, the generated src/index.ts SHALL import
 * and initialize exactly the selected modules. Imports for unselected modules
 * SHALL be absent.
 *
 * **Validates: Requirements 3.5, 4.3, 5.4, 13.3**
 */
describe('Property 3: Entry point imports match selected modules', () => {
  beforeEach(async () => {
    tmpDir = await createTmpDir();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('src/index.ts imports match selected modules', async () => {
    await fc.assert(
      fc.asyncProperty(moduleSubsetArb, async (modules) => {
        const projectDir = join(tmpDir, 'test-project');
        const config = makeConfig(modules, projectDir);
        const result = await scaffold(config);
        expect(result.success).toBe(true);

        const indexContent = await readFile(join(projectDir, 'src', 'index.ts'), 'utf-8');
        const selectedSet = new Set(modules);

        for (const mod of ALL_MODULES) {
          const expectedImport = MODULE_IMPORTS[mod];
          if (expectedImport === null) {
            // This module doesn't add an import to index.ts
            continue;
          }
          if (selectedSet.has(mod)) {
            expect(indexContent, `Expected index.ts to contain import for ${mod}`).toContain(expectedImport);
          } else {
            expect(indexContent, `Expected index.ts to NOT contain import for ${mod}`).not.toContain(expectedImport);
          }
        }

        await rm(projectDir, { recursive: true, force: true });
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: strands-starter-kit, Property 4: package.json round-trip
 *
 * For any generated scaffold, parsing the generated package.json with
 * JSON.parse, then serializing with JSON.stringify, then parsing again
 * SHALL produce a value deeply equal to the first parse result.
 *
 * **Validates: Requirements 13.4**
 */
describe('Property 4: package.json round-trip', () => {
  beforeEach(async () => {
    tmpDir = await createTmpDir();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('JSON.parse → JSON.stringify → JSON.parse produces deep equality', async () => {
    await fc.assert(
      fc.asyncProperty(moduleSubsetArb, async (modules) => {
        const projectDir = join(tmpDir, 'test-project');
        const config = makeConfig(modules, projectDir);
        const result = await scaffold(config);
        expect(result.success).toBe(true);

        const pkgContent = await readFile(join(projectDir, 'package.json'), 'utf-8');
        const firstParse = JSON.parse(pkgContent);
        const serialized = JSON.stringify(firstParse);
        const secondParse = JSON.parse(serialized);

        expect(secondParse).toEqual(firstParse);

        await rm(projectDir, { recursive: true, force: true });
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: strands-starter-kit, Property 5: Project name flows from input to directory
 *
 * For any valid project name provided as a CLI argument, the scaffold
 * configuration SHALL use that name as the project name, and the generated
 * project directory SHALL be created with that exact name.
 *
 * **Validates: Requirements 1.2, 3.1**
 */
describe('Property 5: Project name flows from input to directory', () => {
  beforeEach(async () => {
    tmpDir = await createTmpDir();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('project directory is created with the exact project name', async () => {
    await fc.assert(
      fc.asyncProperty(projectNameArb, async (projectName) => {
        const projectDir = join(tmpDir, projectName);
        const config = makeConfig([], projectDir, projectName);
        const result = await scaffold(config);
        expect(result.success).toBe(true);

        // The directory with the exact project name should exist
        expect(existsSync(projectDir), `Expected directory ${projectName} to exist`).toBe(true);

        // The generated package.json should contain the project name
        const pkgContent = await readFile(join(projectDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgContent);
        expect(pkg.name).toBe(projectName);

        await rm(projectDir, { recursive: true, force: true });
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: strands-starter-kit, Property 6: Environment variables match selected modules
 *
 * For any subset of modules selected, the generated .env.example file SHALL
 * contain the base environment variables plus exactly the environment variables
 * required by each selected module.
 *
 * **Validates: Requirements 3.4, 7.3**
 */
describe('Property 6: Environment variables match selected modules', () => {
  beforeEach(async () => {
    tmpDir = await createTmpDir();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('.env.example contains exactly base + selected module env vars', async () => {
    await fc.assert(
      fc.asyncProperty(moduleSubsetArb, async (modules) => {
        const projectDir = join(tmpDir, 'test-project');
        const config = makeConfig(modules, projectDir);
        const result = await scaffold(config);
        expect(result.success).toBe(true);

        const envContent = await readFile(join(projectDir, '.env.example'), 'utf-8');
        const actualVars = parseEnvVarNames(envContent);

        // Compute expected env vars
        const expectedVars = new Set(BASE_ENV_VARS);
        for (const mod of modules) {
          for (const v of MODULE_ENV_VARS[mod]) expectedVars.add(v);
        }

        // All expected vars should be present
        for (const v of expectedVars) {
          expect(actualVars, `Expected .env.example to contain ${v}`).toContain(v);
        }

        // No unexpected module-specific vars should be present
        for (const mod of ALL_MODULES) {
          if (!modules.includes(mod)) {
            for (const v of MODULE_ENV_VARS[mod]) {
              expect(actualVars, `Expected .env.example to NOT contain ${v} for unselected module ${mod}`).not.toContain(v);
            }
          }
        }

        await rm(projectDir, { recursive: true, force: true });
      }),
      { numRuns: 100 },
    );
  });
});
