/**
 * Shared TypeScript types for the create-strands-agent CLI.
 */

/** Supported package managers for dependency installation. */
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/** Optional modules that can be included in the scaffold. */
export type ModuleName = 'memory' | 'guardrails' | 'a2a' | 'agentcore';

/** Raw CLI flags parsed from Commander arguments. */
export interface CLIFlags {
  yes: boolean;
  modules: string;
  packageManager: string;
  noInstall: boolean;
}

/**
 * Central configuration object that flows through the entire scaffold pipeline.
 * Built from CLI flags and/or interactive prompts.
 */
export interface ScaffoldConfig {
  projectName: string;
  projectDir: string;
  packageManager: PackageManager;
  modules: Set<ModuleName>;
  skipInstall: boolean;
  isNonInteractive: boolean;
}

/** Data passed to EJS templates during rendering. */
export interface TemplateData {
  projectName: string;
  hasMemory: boolean;
  hasGuardrails: boolean;
  hasA2A: boolean;
  hasAgentCore: boolean;
  strandsVersion: string;
  nodeVersion: string;
}

/** A single template file entry in the manifest. */
export interface TemplateFile {
  templatePath: string;
  outputPath: string;
  condition?: (data: TemplateData) => boolean;
}

/** The full list of template files to process during scaffolding. */
export type TemplateManifest = TemplateFile[];

/** Result of the scaffolding operation. */
export interface ScaffoldResult {
  success: boolean;
  filesCreated: string[];
  errors: Array<{ file: string; error: string }>;
}

/** Result of a dependency installation attempt. */
export interface InstallResult {
  success: boolean;
  error?: string;
}

/** Configuration for the dependency installer. */
export interface InstallConfig {
  projectDir: string;
  packageManager: PackageManager;
  skipInstall: boolean;
}

/** Result of an input validation check. */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}
