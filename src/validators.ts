/**
 * Pure validation functions for CLI input.
 * Each validator returns a ValidationResult with a `valid` boolean and optional `error` string.
 */

import type { CLIFlags, ModuleName, ValidationResult } from './types.js';

/** All valid module names that can be selected. */
const VALID_MODULES: ReadonlySet<string> = new Set<ModuleName>([
  'memory',
  'guardrails',
  'a2a',
  'agentcore',
]);

/** All valid package manager names. */
const VALID_PACKAGE_MANAGERS: ReadonlySet<string> = new Set(['npm', 'yarn', 'pnpm']);

/**
 * Validate a project name against npm package name rules.
 *
 * Rules:
 * - Must not be empty or whitespace-only
 * - Must not start with a dot or underscore
 * - Must be lowercase
 * - May contain lowercase letters, digits, hyphens, dots, underscores, and tildes
 * - Must not contain leading or trailing spaces
 */
export function validateProjectName(name: string): ValidationResult {
  if (name.length === 0 || name.trim().length === 0) {
    return { valid: false, error: 'Project name cannot be empty.' };
  }

  if (name !== name.trim()) {
    return { valid: false, error: 'Project name cannot have leading or trailing spaces.' };
  }

  if (name.startsWith('.')) {
    return { valid: false, error: 'Project name cannot start with a dot.' };
  }

  if (name.startsWith('_')) {
    return { valid: false, error: 'Project name cannot start with an underscore.' };
  }

  if (name !== name.toLowerCase()) {
    return { valid: false, error: 'Project name must be lowercase.' };
  }

  // npm package names allow: lowercase letters, digits, hyphens, dots, underscores, tildes
  const validCharsPattern = /^[a-z0-9._~-]+$/;
  if (!validCharsPattern.test(name)) {
    return {
      valid: false,
      error:
        'Project name contains invalid characters. Only lowercase letters, digits, hyphens, dots, underscores, and tildes are allowed.',
    };
  }

  return { valid: true };
}

/**
 * Validate a comma-separated module list string.
 *
 * - An empty string is valid (no modules selected).
 * - Whitespace around module names is trimmed.
 * - Unknown module names produce an error.
 */
export function validateModuleList(modules: string): ValidationResult {
  if (modules.trim().length === 0) {
    return { valid: true };
  }

  const names = modules.split(',').map((m) => m.trim());

  for (const name of names) {
    if (name.length === 0) {
      // Skip empty segments from trailing commas like "memory,"
      continue;
    }
    if (!VALID_MODULES.has(name)) {
      return {
        valid: false,
        error: `Unknown module: "${name}". Valid modules: memory, guardrails, a2a, agentcore`,
      };
    }
  }

  return { valid: true };
}

/**
 * Parse a validated comma-separated module string into a Set of ModuleName values.
 * Call `validateModuleList` first to ensure the string is valid.
 */
export function parseModuleList(modules: string): Set<ModuleName> {
  if (modules.trim().length === 0) {
    return new Set();
  }

  const names = modules
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  return new Set(names as ModuleName[]);
}

/**
 * Validate a package manager string.
 * Accepts only "npm", "yarn", or "pnpm".
 */
export function validatePackageManager(pm: string): ValidationResult {
  if (!VALID_PACKAGE_MANAGERS.has(pm)) {
    return {
      valid: false,
      error: `Unknown package manager: "${pm}". Valid options: npm, yarn, pnpm`,
    };
  }

  return { valid: true };
}

/**
 * Validate CLI flag combinations for logical conflicts.
 *
 * Current conflict rules:
 * - `--yes` combined with `--modules` containing invalid values is caught by
 *   `validateModuleList`, so this function focuses on flag-level conflicts.
 * - No strong conflicts exist in the current flag set, but this function
 *   serves as the extension point for future conflict detection.
 */
export function validateFlagCombinations(flags: CLIFlags): ValidationResult {
  // When --yes is used, --modules must be valid if provided
  if (flags.yes && flags.modules && flags.modules.trim().length > 0) {
    const moduleResult = validateModuleList(flags.modules);
    if (!moduleResult.valid) {
      return {
        valid: false,
        error: `Conflicting flags: --yes used with invalid --modules value. ${moduleResult.error}`,
      };
    }
  }

  // When --yes is used, --package-manager must be valid if provided
  if (flags.yes && flags.packageManager && flags.packageManager.trim().length > 0) {
    const pmResult = validatePackageManager(flags.packageManager);
    if (!pmResult.valid) {
      return {
        valid: false,
        error: `Conflicting flags: --yes used with invalid --package-manager value. ${pmResult.error}`,
      };
    }
  }

  return { valid: true };
}
