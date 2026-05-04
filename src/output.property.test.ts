import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { display } from './output.js';
import type { ModuleName, PackageManager, ScaffoldConfig, InstallResult } from './types.js';

/**
 * Feature: strands-starter-kit, Property 9: Post-scaffold output matches selected modules
 *
 * For any scaffold configuration, the post-scaffold output SHALL contain the
 * `cd <projectName>` command and start instructions. Additionally, A2A endpoint
 * information SHALL appear if and only if the A2A module is selected, and
 * AgentCore deployment instructions SHALL appear if and only if the AgentCore
 * module is selected.
 *
 * **Validates: Requirements 10.1, 10.3, 10.4**
 */
describe('Property 9: Post-scaffold output matches selected modules', () => {
  const ALL_MODULES: ModuleName[] = ['memory', 'guardrails', 'a2a', 'agentcore'];
  const ALL_PACKAGE_MANAGERS: PackageManager[] = ['npm', 'yarn', 'pnpm'];

  let logOutput: string[];
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    logOutput = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = (...args: unknown[]) => {
      logOutput.push(args.map(String).join(' '));
    };
    console.error = (...args: unknown[]) => {
      logOutput.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  // --- Arbitraries ---

  /** Valid npm-style project name: lowercase letters, digits, hyphens. */
  const projectNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/);

  /** Random package manager. */
  const packageManagerArb = fc.constantFrom<PackageManager>(...ALL_PACKAGE_MANAGERS);

  /** Random subset of modules. */
  const moduleSubsetArb = fc.subarray(ALL_MODULES, { minLength: 0, maxLength: 4 });

  /** Complete ScaffoldConfig arbitrary. */
  const scaffoldConfigArb = fc
    .tuple(projectNameArb, packageManagerArb, moduleSubsetArb, fc.boolean(), fc.boolean())
    .map(([projectName, packageManager, modules, skipInstall, isNonInteractive]) => ({
      projectName,
      projectDir: `/tmp/test/${projectName}`,
      packageManager,
      modules: new Set(modules) as Set<ModuleName>,
      skipInstall,
      isNonInteractive,
    }));

  /** Optional InstallResult arbitrary. */
  const installResultArb = fc.oneof(
    fc.constant(undefined),
    fc.record({
      success: fc.constant(true),
      error: fc.constant(undefined),
    }) as fc.Arbitrary<InstallResult>,
    fc.record({
      success: fc.constant(false),
      error: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    }) as fc.Arbitrary<InstallResult>,
  );

  // --- Property tests ---

  it('output always contains "cd <projectName>"', async () => {
    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, installResultArb, async (config, installResult) => {
        logOutput = [];
        await display(config, installResult);
        const output = logOutput.join('\n');

        expect(output).toContain(`cd ${config.projectName}`);
      }),
      { numRuns: 100 },
    );
  });

  it('output always contains a dev run command for the selected package manager', async () => {
    const expectedDevCmd: Record<PackageManager, string> = {
      npm: 'npm run dev',
      yarn: 'yarn dev',
      pnpm: 'pnpm dev',
    };

    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, installResultArb, async (config, installResult) => {
        logOutput = [];
        await display(config, installResult);
        const output = logOutput.join('\n');

        expect(output).toContain(expectedDevCmd[config.packageManager]);
      }),
      { numRuns: 100 },
    );
  });

  it('output always contains Strands SDK documentation links', async () => {
    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, installResultArb, async (config, installResult) => {
        logOutput = [];
        await display(config, installResult);
        const output = logOutput.join('\n');

        expect(output).toContain('https://strandsagents.com/docs/');
      }),
      { numRuns: 100 },
    );
  });

  it('A2A endpoint info appears if and only if A2A module is selected', async () => {
    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, installResultArb, async (config, installResult) => {
        logOutput = [];
        await display(config, installResult);
        const output = logOutput.join('\n');

        const hasA2A = config.modules.has('a2a');
        const containsA2AInfo = output.includes('A2A') && output.includes('agent.json');

        if (hasA2A) {
          expect(containsA2AInfo).toBe(true);
        } else {
          expect(containsA2AInfo).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('AgentCore deployment info appears if and only if AgentCore module is selected', async () => {
    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, installResultArb, async (config, installResult) => {
        logOutput = [];
        await display(config, installResult);
        const output = logOutput.join('\n');

        const hasAgentCore = config.modules.has('agentcore');
        const containsAgentCoreInfo =
          output.includes('AgentCore') && output.includes('deploy.sh');

        if (hasAgentCore) {
          expect(containsAgentCoreInfo).toBe(true);
        } else {
          expect(containsAgentCoreInfo).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('cd command, dev command, and documentation links are present for any config', async () => {
    const expectedDevCmd: Record<PackageManager, string> = {
      npm: 'npm run dev',
      yarn: 'yarn dev',
      pnpm: 'pnpm dev',
    };

    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, installResultArb, async (config, installResult) => {
        logOutput = [];
        await display(config, installResult);
        const output = logOutput.join('\n');

        // cd command always present
        expect(output).toContain(`cd ${config.projectName}`);

        // dev command always present
        expect(output).toContain(expectedDevCmd[config.packageManager]);

        // Documentation links always present
        expect(output).toContain('https://strandsagents.com/docs/');

        // A2A iff selected
        const hasA2A = config.modules.has('a2a');
        expect(output.includes('A2A endpoint')).toBe(hasA2A);

        // AgentCore iff selected
        const hasAgentCore = config.modules.has('agentcore');
        expect(output.includes('AgentCore Deployment')).toBe(hasAgentCore);
      }),
      { numRuns: 100 },
    );
  });
});
