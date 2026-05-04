import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import type { ModuleName, PackageManager, ScaffoldConfig } from './types.js';

/**
 * Feature: strands-starter-kit, Property 12: Configuration summary reflects all selections
 *
 * For any ScaffoldConfig, the displayed summary SHALL contain the project name,
 * the selected package manager, and every selected module name.
 *
 * **Validates: Requirements 2.4**
 */
describe('Property 12: Configuration summary reflects all selections', () => {
  const ALL_MODULES: ModuleName[] = ['memory', 'guardrails', 'a2a', 'agentcore'];
  const ALL_PACKAGE_MANAGERS: PackageManager[] = ['npm', 'yarn', 'pnpm'];

  let logOutput: string[];
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    logOutput = [];
    originalConsoleLog = console.log;
    console.log = (...args: unknown[]) => {
      logOutput.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.restoreAllMocks();
  });

  /**
   * Arbitrary for a valid npm-style project name.
   * Lowercase letters, digits, and hyphens. Must start with a letter, 1-21 chars.
   */
  const projectNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/);

  /** Arbitrary for a random package manager. */
  const packageManagerArb = fc.constantFrom<PackageManager>('npm', 'yarn', 'pnpm');

  /** Arbitrary for a random subset of modules. */
  const moduleSubsetArb = fc.subarray(ALL_MODULES, { minLength: 0, maxLength: 4 });

  /** Arbitrary for a complete ScaffoldConfig. */
  const scaffoldConfigArb = fc
    .tuple(projectNameArb, packageManagerArb, moduleSubsetArb, fc.boolean(), fc.boolean())
    .map(([projectName, packageManager, modules, skipInstall, isNonInteractive]) => ({
      projectName,
      projectDir: `/tmp/test/${projectName}`,
      packageManager,
      modules: new Set(modules),
      skipInstall,
      isNonInteractive,
    }));

  it('summary output contains the project name', async () => {
    // Mock @inquirer/prompts confirm to return true without user interaction
    vi.mock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      input: vi.fn(),
      select: vi.fn(),
      checkbox: vi.fn(),
    }));

    const { displaySummary } = await import('./prompts.js');

    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, async (config) => {
        logOutput = [];
        await displaySummary(config);
        const output = logOutput.join('\n');
        expect(output).toContain(config.projectName);
      }),
      { numRuns: 100 },
    );
  });

  it('summary output contains the selected package manager', async () => {
    vi.mock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      input: vi.fn(),
      select: vi.fn(),
      checkbox: vi.fn(),
    }));

    const { displaySummary } = await import('./prompts.js');

    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, async (config) => {
        logOutput = [];
        await displaySummary(config);
        const output = logOutput.join('\n');
        expect(output).toContain(config.packageManager);
      }),
      { numRuns: 100 },
    );
  });

  it('summary output contains every selected module name', async () => {
    vi.mock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      input: vi.fn(),
      select: vi.fn(),
      checkbox: vi.fn(),
    }));

    const { displaySummary } = await import('./prompts.js');

    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, async (config) => {
        logOutput = [];
        await displaySummary(config);
        const output = logOutput.join('\n');

        for (const mod of config.modules) {
          expect(output).toContain(mod);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('summary output shows "none" when no modules are selected', async () => {
    vi.mock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      input: vi.fn(),
      select: vi.fn(),
      checkbox: vi.fn(),
    }));

    const { displaySummary } = await import('./prompts.js');

    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(projectNameArb, packageManagerArb, fc.boolean(), fc.boolean())
          .map(([projectName, packageManager, skipInstall, isNonInteractive]) => ({
            projectName,
            projectDir: `/tmp/test/${projectName}`,
            packageManager,
            modules: new Set<ModuleName>(),
            skipInstall,
            isNonInteractive,
          })),
        async (config) => {
          logOutput = [];
          await displaySummary(config);
          const output = logOutput.join('\n');
          expect(output).toContain('none');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('summary output contains project name, package manager, and all modules together', async () => {
    vi.mock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      input: vi.fn(),
      select: vi.fn(),
      checkbox: vi.fn(),
    }));

    const { displaySummary } = await import('./prompts.js');

    await fc.assert(
      fc.asyncProperty(scaffoldConfigArb, async (config) => {
        logOutput = [];
        await displaySummary(config);
        const output = logOutput.join('\n');

        // Project name is present
        expect(output).toContain(config.projectName);

        // Package manager is present
        expect(output).toContain(config.packageManager);

        // Every selected module is present
        for (const mod of config.modules) {
          expect(output).toContain(mod);
        }

        // When no modules selected, "none" is present
        if (config.modules.size === 0) {
          expect(output).toContain('none');
        }
      }),
      { numRuns: 100 },
    );
  });
});
