import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateModuleList, parseModuleList, validateFlagCombinations } from './validators.js';
import type { CLIFlags, ModuleName } from './types.js';

/**
 * Feature: strands-starter-kit, Property 7: Modules flag parsing
 *
 * For any valid comma-separated string of module names from
 * {memory, guardrails, a2a, agentcore}, parsing the `--modules` flag
 * SHALL produce a set containing exactly those modules.
 *
 * **Validates: Requirements 9.2**
 */
describe('Property 7: Modules flag parsing', () => {
  const ALL_MODULES: ModuleName[] = ['memory', 'guardrails', 'a2a', 'agentcore'];

  /** Arbitrary for a random subset of valid module names. */
  const moduleSubsetArb = fc.subarray(ALL_MODULES, { minLength: 0, maxLength: 4 });

  it('validateModuleList accepts any valid subset as a comma-separated string', () => {
    fc.assert(
      fc.property(moduleSubsetArb, (modules) => {
        const input = modules.join(',');
        const result = validateModuleList(input);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('parseModuleList produces exactly the input set of modules', () => {
    fc.assert(
      fc.property(moduleSubsetArb, (modules) => {
        const input = modules.join(',');
        const parsed = parseModuleList(input);
        const expected = new Set(modules);
        expect(parsed).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });

  /** Arbitrary that adds random whitespace around module names in the comma-separated string. */
  const paddedModuleStringArb = moduleSubsetArb.chain((modules) => {
    if (modules.length === 0) {
      return fc.constant('');
    }
    // Generate random whitespace padding (0-3 spaces) for each side of each module name
    return fc
      .array(
        fc.tuple(
          fc.nat({ max: 3 }),
          fc.nat({ max: 3 }),
        ),
        { minLength: modules.length, maxLength: modules.length },
      )
      .map((paddings) =>
        modules.map((mod, i) => `${' '.repeat(paddings[i][0])}${mod}${' '.repeat(paddings[i][1])}`).join(','),
      )
      .map((str) => ({ str, expected: new Set(modules) }));
  });

  it('parseModuleList handles whitespace-padded module names correctly', () => {
    fc.assert(
      fc.property(paddedModuleStringArb, (data) => {
        if (typeof data === 'string') {
          // Empty string case
          expect(parseModuleList(data)).toEqual(new Set());
          return;
        }
        const result = validateModuleList(data.str);
        expect(result.valid).toBe(true);

        const parsed = parseModuleList(data.str);
        expect(parsed).toEqual(data.expected);
      }),
      { numRuns: 100 },
    );
  });

  /** Arbitrary that may include trailing commas after the module list. */
  const trailingCommaArb = moduleSubsetArb.chain((modules) => {
    return fc.nat({ max: 3 }).map((extraCommas) => {
      const base = modules.join(',');
      const trailing = ','.repeat(extraCommas);
      return { str: base + trailing, expected: new Set(modules) };
    });
  });

  it('parseModuleList handles trailing commas without producing extra entries', () => {
    fc.assert(
      fc.property(trailingCommaArb, ({ str, expected }) => {
        const result = validateModuleList(str);
        expect(result.valid).toBe(true);

        const parsed = parseModuleList(str);
        expect(parsed).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('validateModuleList rejects any string containing an invalid module name', () => {
    /** Arbitrary for a string that is NOT a valid module name. */
    const invalidModuleArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => !ALL_MODULES.includes(s as ModuleName) && s.trim().length > 0 && !s.includes(','));

    fc.assert(
      fc.property(moduleSubsetArb, invalidModuleArb, (validModules, invalidModule) => {
        const input = [...validModules, invalidModule].join(',');
        const result = validateModuleList(input);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unknown module');
      }),
      { numRuns: 100 },
    );
  });

  it('round-trip: validate then parse produces the same set regardless of order', () => {
    /** Arbitrary that shuffles the module subset. */
    const shuffledSubsetArb = moduleSubsetArb.chain((modules) => {
      return fc.shuffledSubarray(modules, { minLength: modules.length, maxLength: modules.length });
    });

    fc.assert(
      fc.property(shuffledSubsetArb, (modules) => {
        const input = modules.join(',');
        const result = validateModuleList(input);
        expect(result.valid).toBe(true);

        const parsed = parseModuleList(input);
        // Set equality is order-independent
        expect(parsed).toEqual(new Set(modules));
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: strands-starter-kit, Property 11: Conflicting flags produce errors
 *
 * For any set of CLI flags that contains a logical conflict,
 * the flag validator SHALL return an error result identifying the conflict.
 *
 * **Validates: Requirements 9.5**
 */
describe('Property 11: Conflicting flags produce errors', () => {
  const ALL_MODULES: ModuleName[] = ['memory', 'guardrails', 'a2a', 'agentcore'];
  const VALID_PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm'] as const;

  /**
   * Arbitrary for a string that is NOT a valid module name.
   * Filtered to avoid commas (which would split into multiple names)
   * and to ensure it's non-empty after trimming.
   */
  const invalidModuleArb = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter(
      (s) =>
        !ALL_MODULES.includes(s.trim() as ModuleName) &&
        s.trim().length > 0 &&
        !s.includes(','),
    );

  /**
   * Arbitrary for a string that is NOT a valid package manager.
   * Filtered to ensure it's non-empty after trimming.
   */
  const invalidPMArb = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter(
      (s) =>
        !VALID_PACKAGE_MANAGERS.includes(s.trim() as (typeof VALID_PACKAGE_MANAGERS)[number]) &&
        s.trim().length > 0,
    );

  /** Arbitrary for a valid comma-separated module string (may be empty). */
  const validModulesArb = fc
    .subarray(ALL_MODULES, { minLength: 0, maxLength: 4 })
    .map((mods) => mods.join(','));

  /** Arbitrary for a valid package manager string (may be empty). */
  const validPMArb = fc.constantFrom('npm', 'yarn', 'pnpm', '');

  /** Arbitrary for the boolean flags that don't affect conflict detection. */
  const boolFlagArb = fc.boolean();

  it('--yes with invalid --modules always produces an error mentioning the conflict', () => {
    fc.assert(
      fc.property(
        invalidModuleArb,
        validPMArb,
        boolFlagArb,
        (invalidModule, pm, noInstall) => {
          // Build a modules string that contains at least one invalid module name.
          // Optionally prepend some valid modules to make the input more realistic.
          const validPrefix = fc.sample(
            fc.subarray(ALL_MODULES, { minLength: 0, maxLength: 2 }),
            1,
          )[0];
          const modulesStr = [...validPrefix, invalidModule].join(',');

          const flags: CLIFlags = {
            yes: true,
            modules: modulesStr,
            packageManager: pm,
            noInstall,
          };

          const result = validateFlagCombinations(flags);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Conflicting flags');
          expect(result.error).toContain('--modules');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('--yes with invalid --package-manager always produces an error mentioning the conflict', () => {
    fc.assert(
      fc.property(
        invalidPMArb,
        validModulesArb,
        boolFlagArb,
        (invalidPM, modules, noInstall) => {
          const flags: CLIFlags = {
            yes: true,
            modules,
            packageManager: invalidPM,
            noInstall,
          };

          const result = validateFlagCombinations(flags);
          // If modules is also invalid, the modules conflict fires first.
          // But if modules is valid, the PM conflict must fire.
          if (validateModuleList(modules).valid || modules.trim().length === 0) {
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Conflicting flags');
            expect(result.error).toContain('--package-manager');
          } else {
            // Modules conflict fires first — still an error
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Conflicting flags');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('--yes with both invalid --modules and invalid --package-manager always produces an error', () => {
    fc.assert(
      fc.property(
        invalidModuleArb,
        invalidPMArb,
        boolFlagArb,
        (invalidModule, invalidPM, noInstall) => {
          const flags: CLIFlags = {
            yes: true,
            modules: invalidModule,
            packageManager: invalidPM,
            noInstall,
          };

          const result = validateFlagCombinations(flags);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Conflicting flags');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('valid flag combinations never produce a conflict error', () => {
    fc.assert(
      fc.property(
        boolFlagArb,
        validModulesArb,
        validPMArb,
        boolFlagArb,
        (yes, modules, pm, noInstall) => {
          const flags: CLIFlags = {
            yes,
            modules,
            packageManager: pm,
            noInstall,
          };

          const result = validateFlagCombinations(flags);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('without --yes, any modules/packageManager values are accepted (interactive handles validation)', () => {
    fc.assert(
      fc.property(
        invalidModuleArb,
        invalidPMArb,
        boolFlagArb,
        (modules, pm, noInstall) => {
          const flags: CLIFlags = {
            yes: false,
            modules,
            packageManager: pm,
            noInstall,
          };

          const result = validateFlagCombinations(flags);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});
