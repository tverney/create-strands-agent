import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getInstallCommand } from './installer.js';
import type { PackageManager } from './types.js';

/**
 * Feature: strands-starter-kit, Property 8: Install command matches package manager
 *
 * For any valid package manager selection from {npm, yarn, pnpm},
 * the DependencyInstaller SHALL construct and execute the correct
 * install command for that package manager.
 *
 * **Validates: Requirements 8.2**
 */
describe('Property 8: Install command matches package manager', () => {
  const ALL_PACKAGE_MANAGERS: PackageManager[] = ['npm', 'yarn', 'pnpm'];

  /** Expected command mapping — the ground truth for verification. */
  const EXPECTED_COMMANDS: Record<PackageManager, { command: string; args: string[] }> = {
    npm: { command: 'npm', args: ['install'] },
    yarn: { command: 'yarn', args: ['install'] },
    pnpm: { command: 'pnpm', args: ['install'] },
  };

  /** Arbitrary for a random valid package manager. */
  const packageManagerArb = fc.constantFrom<PackageManager>(...ALL_PACKAGE_MANAGERS);

  it('getInstallCommand returns the correct command for any valid package manager', () => {
    fc.assert(
      fc.property(packageManagerArb, (pm) => {
        const result = getInstallCommand(pm);
        const expected = EXPECTED_COMMANDS[pm];

        expect(result.command).toBe(expected.command);
        expect(result.args).toEqual(expected.args);
      }),
      { numRuns: 100 },
    );
  });

  it('the command binary always matches the package manager name', () => {
    fc.assert(
      fc.property(packageManagerArb, (pm) => {
        const result = getInstallCommand(pm);

        // The command binary should always be the package manager name itself
        expect(result.command).toBe(pm);
      }),
      { numRuns: 100 },
    );
  });

  it('the args always contain "install" as the first argument', () => {
    fc.assert(
      fc.property(packageManagerArb, (pm) => {
        const result = getInstallCommand(pm);

        expect(result.args.length).toBeGreaterThanOrEqual(1);
        expect(result.args[0]).toBe('install');
      }),
      { numRuns: 100 },
    );
  });

  it('the result is always a well-formed command object with string command and string[] args', () => {
    fc.assert(
      fc.property(packageManagerArb, (pm) => {
        const result = getInstallCommand(pm);

        expect(typeof result.command).toBe('string');
        expect(result.command.length).toBeGreaterThan(0);
        expect(Array.isArray(result.args)).toBe(true);
        result.args.forEach((arg) => {
          expect(typeof arg).toBe('string');
        });
      }),
      { numRuns: 100 },
    );
  });

  it('different package managers produce different command binaries', () => {
    fc.assert(
      fc.property(
        packageManagerArb,
        packageManagerArb,
        (pm1, pm2) => {
          fc.pre(pm1 !== pm2);

          const result1 = getInstallCommand(pm1);
          const result2 = getInstallCommand(pm2);

          expect(result1.command).not.toBe(result2.command);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('the function is pure — same input always produces same output', () => {
    fc.assert(
      fc.property(packageManagerArb, (pm) => {
        const result1 = getInstallCommand(pm);
        const result2 = getInstallCommand(pm);

        expect(result1).toEqual(result2);
      }),
      { numRuns: 100 },
    );
  });
});
