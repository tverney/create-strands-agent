import { describe, it, expect } from 'vitest';
import {
  validateProjectName,
  validateModuleList,
  parseModuleList,
  validatePackageManager,
  validateFlagCombinations,
} from './validators.js';

describe('validateProjectName', () => {
  it('accepts a valid lowercase name', () => {
    expect(validateProjectName('my-agent')).toEqual({ valid: true });
  });

  it('accepts names with dots, underscores, and tildes', () => {
    expect(validateProjectName('my.agent')).toEqual({ valid: true });
    expect(validateProjectName('my_agent')).toEqual({ valid: true });
    expect(validateProjectName('my~agent')).toEqual({ valid: true });
  });

  it('accepts names with digits', () => {
    expect(validateProjectName('agent42')).toEqual({ valid: true });
  });

  it('rejects empty strings', () => {
    const result = validateProjectName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects whitespace-only strings', () => {
    const result = validateProjectName('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects names with leading spaces', () => {
    const result = validateProjectName(' my-agent');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('leading or trailing spaces');
  });

  it('rejects names with trailing spaces', () => {
    const result = validateProjectName('my-agent ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('leading or trailing spaces');
  });

  it('rejects names starting with a dot', () => {
    const result = validateProjectName('.hidden');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dot');
  });

  it('rejects names starting with an underscore', () => {
    const result = validateProjectName('_private');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('underscore');
  });

  it('rejects uppercase characters', () => {
    const result = validateProjectName('MyAgent');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('lowercase');
  });

  it('rejects names with spaces', () => {
    const result = validateProjectName('my agent');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });

  it('rejects names with special characters', () => {
    const result = validateProjectName('my@agent');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });

  it('rejects names with exclamation marks', () => {
    const result = validateProjectName('my!agent');
    expect(result.valid).toBe(false);
  });
});

describe('validateModuleList', () => {
  it('accepts an empty string (no modules)', () => {
    expect(validateModuleList('')).toEqual({ valid: true });
  });

  it('accepts a single valid module', () => {
    expect(validateModuleList('memory')).toEqual({ valid: true });
    expect(validateModuleList('guardrails')).toEqual({ valid: true });
    expect(validateModuleList('a2a')).toEqual({ valid: true });
    expect(validateModuleList('agentcore')).toEqual({ valid: true });
  });

  it('accepts multiple valid modules', () => {
    expect(validateModuleList('memory,guardrails')).toEqual({ valid: true });
    expect(validateModuleList('memory,guardrails,a2a,agentcore')).toEqual({ valid: true });
  });

  it('trims whitespace around module names', () => {
    expect(validateModuleList(' memory , guardrails ')).toEqual({ valid: true });
  });

  it('accepts whitespace-only string as empty', () => {
    expect(validateModuleList('   ')).toEqual({ valid: true });
  });

  it('rejects unknown module names', () => {
    const result = validateModuleList('memory,unknown');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown module');
    expect(result.error).toContain('unknown');
  });

  it('rejects completely invalid module names', () => {
    const result = validateModuleList('foobar');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown module');
  });

  it('handles trailing commas gracefully', () => {
    expect(validateModuleList('memory,')).toEqual({ valid: true });
  });
});

describe('parseModuleList', () => {
  it('returns empty set for empty string', () => {
    expect(parseModuleList('')).toEqual(new Set());
  });

  it('parses a single module', () => {
    expect(parseModuleList('memory')).toEqual(new Set(['memory']));
  });

  it('parses multiple modules', () => {
    expect(parseModuleList('memory,guardrails,a2a')).toEqual(
      new Set(['memory', 'guardrails', 'a2a']),
    );
  });

  it('trims whitespace', () => {
    expect(parseModuleList(' memory , a2a ')).toEqual(new Set(['memory', 'a2a']));
  });

  it('deduplicates repeated modules', () => {
    expect(parseModuleList('memory,memory')).toEqual(new Set(['memory']));
  });

  it('skips empty segments from trailing commas', () => {
    expect(parseModuleList('memory,')).toEqual(new Set(['memory']));
  });
});

describe('validatePackageManager', () => {
  it('accepts npm', () => {
    expect(validatePackageManager('npm')).toEqual({ valid: true });
  });

  it('accepts yarn', () => {
    expect(validatePackageManager('yarn')).toEqual({ valid: true });
  });

  it('accepts pnpm', () => {
    expect(validatePackageManager('pnpm')).toEqual({ valid: true });
  });

  it('rejects unknown package managers', () => {
    const result = validatePackageManager('bun');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown package manager');
    expect(result.error).toContain('bun');
  });

  it('rejects empty string', () => {
    const result = validatePackageManager('');
    expect(result.valid).toBe(false);
  });

  it('rejects uppercase variants', () => {
    const result = validatePackageManager('NPM');
    expect(result.valid).toBe(false);
  });
});

describe('validateFlagCombinations', () => {
  it('returns valid for default flags', () => {
    const result = validateFlagCombinations({
      yes: false,
      modules: '',
      packageManager: '',
      noInstall: false,
    });
    expect(result.valid).toBe(true);
  });

  it('returns valid for --yes with valid modules', () => {
    const result = validateFlagCombinations({
      yes: true,
      modules: 'memory,guardrails',
      packageManager: 'npm',
      noInstall: false,
    });
    expect(result.valid).toBe(true);
  });

  it('returns valid for --yes with no modules', () => {
    const result = validateFlagCombinations({
      yes: true,
      modules: '',
      packageManager: '',
      noInstall: false,
    });
    expect(result.valid).toBe(true);
  });

  it('returns valid for --yes with --no-install', () => {
    const result = validateFlagCombinations({
      yes: true,
      modules: '',
      packageManager: '',
      noInstall: true,
    });
    expect(result.valid).toBe(true);
  });

  it('detects --yes with invalid modules', () => {
    const result = validateFlagCombinations({
      yes: true,
      modules: 'memory,invalid',
      packageManager: '',
      noInstall: false,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Conflicting flags');
    expect(result.error).toContain('--modules');
  });

  it('detects --yes with invalid package manager', () => {
    const result = validateFlagCombinations({
      yes: true,
      modules: '',
      packageManager: 'bun',
      noInstall: false,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Conflicting flags');
    expect(result.error).toContain('--package-manager');
  });

  it('returns valid when not using --yes even with invalid modules', () => {
    // Without --yes, the interactive prompts will handle validation
    const result = validateFlagCombinations({
      yes: false,
      modules: 'invalid',
      packageManager: '',
      noInstall: false,
    });
    expect(result.valid).toBe(true);
  });
});
