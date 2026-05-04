import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkNodeVersion } from './node-version.js';

/**
 * The actual Node.js major version running these tests.
 * Tests are written to be correct regardless of the runtime version.
 */
const currentMajor = parseInt(process.version.slice(1).split('.')[0], 10);

describe('checkNodeVersion', () => {
  it('returns true when minimum is lower than current version', () => {
    const lowerVersion = String(currentMajor - 2);
    expect(checkNodeVersion(lowerVersion)).toBe(true);
  });

  it('returns true when minimum equals current version', () => {
    expect(checkNodeVersion(String(currentMajor))).toBe(true);
  });

  it('returns false when minimum is higher than current version', () => {
    const higherVersion = String(currentMajor + 1);
    expect(checkNodeVersion(higherVersion)).toBe(false);
  });

  it('returns true for minimum of "0"', () => {
    expect(checkNodeVersion('0')).toBe(true);
  });

  it('returns false for unrealistically high minimum', () => {
    expect(checkNodeVersion('999')).toBe(false);
  });

  it('handles minimum specified as full semver string', () => {
    expect(checkNodeVersion(`${currentMajor}.0.0`)).toBe(true);
    expect(checkNodeVersion(`${currentMajor + 1}.0.0`)).toBe(false);
  });

  it('handles minimum with "v" prefix', () => {
    expect(checkNodeVersion(`v${currentMajor}`)).toBe(true);
    expect(checkNodeVersion(`v${currentMajor + 1}`)).toBe(false);
  });

  it('returns true for invalid minimum string (parsed as 0)', () => {
    // Invalid strings parse to major version 0, so any real Node.js version passes
    expect(checkNodeVersion('abc')).toBe(true);
  });
});

/**
 * Feature: strands-starter-kit, Property 10: Node.js version validation
 *
 * For any Node.js version string, the version check function SHALL return true
 * if and only if the version is greater than or equal to the minimum supported version.
 *
 * **Validates: Requirements 12.4**
 */
describe('Property 10: Node.js version validation', () => {
  /**
   * The actual Node.js major version running these tests.
   * All assertions are relative to this value so the test works on any Node.js version.
   */
  const runtimeMajor = parseInt(process.version.slice(1).split('.')[0], 10);

  /** Arbitrary for a semver-style version string like "18.4.2" or "v22.0.1". */
  const semverArb = fc.record({
    prefix: fc.boolean(),
    major: fc.nat({ max: 100 }),
    minor: fc.nat({ max: 99 }),
    patch: fc.nat({ max: 99 }),
  }).map(({ prefix, major, minor, patch }) =>
    `${prefix ? 'v' : ''}${major}.${minor}.${patch}`
  );

  it('returns true iff current major >= minimum major (semver strings)', () => {
    fc.assert(
      fc.property(semverArb, (version) => {
        const minimumMajor = parseInt(
          (version.startsWith('v') ? version.slice(1) : version).split('.')[0],
          10,
        );
        const expected = runtimeMajor >= minimumMajor;
        expect(checkNodeVersion(version)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  /** Arbitrary for a bare major-only version string like "20" or "v20". */
  const majorOnlyArb = fc.record({
    prefix: fc.boolean(),
    major: fc.nat({ max: 100 }),
  }).map(({ prefix, major }) => `${prefix ? 'v' : ''}${major}`);

  it('returns true iff current major >= minimum major (major-only strings)', () => {
    fc.assert(
      fc.property(majorOnlyArb, (version) => {
        const minimumMajor = parseInt(
          (version.startsWith('v') ? version.slice(1) : version).split('.')[0],
          10,
        );
        const expected = runtimeMajor >= minimumMajor;
        expect(checkNodeVersion(version)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  /** Arbitrary for non-numeric / garbage strings that should parse to major 0. */
  const invalidVersionArb = fc.string({ minLength: 1, maxLength: 20 })
    .filter((s) => isNaN(parseInt(s.startsWith('v') ? s.slice(1) : s, 10)));

  it('returns true for any non-numeric string (parsed as major 0)', () => {
    fc.assert(
      fc.property(invalidVersionArb, (version) => {
        // Non-numeric strings parse to major 0, so any real Node.js version passes
        expect(checkNodeVersion(version)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
