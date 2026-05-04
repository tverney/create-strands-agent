/**
 * PromptEngine — interactive prompts for collecting scaffold configuration.
 * Uses `@inquirer/prompts` for modern, tree-shakeable prompt components.
 *
 * @module prompts
 */

import path from 'node:path';
import { input, select, checkbox, confirm } from '@inquirer/prompts';
import type { CLIFlags, ModuleName, PackageManager, ScaffoldConfig } from './types.js';
import {
  validateProjectName,
  validateModuleList,
  parseModuleList,
  validatePackageManager,
} from './validators.js';
import { directoryExists, isDirectoryEmpty } from './utils/fs.js';
import { logger } from './utils/logger.js';

/** Arguments passed from the CLI entry point to the prompt engine. */
export interface CollectConfigArgs {
  /** Project name from the positional CLI argument (may be undefined). */
  projectName?: string;
  /** Parsed CLI flags. */
  flags: CLIFlags;
}

/** Sentinel value used when the user cancels a directory conflict prompt. */
const CANCEL_SENTINEL = '__cancel__';

/**
 * Default project name used when none is provided and `--yes` is active.
 */
const DEFAULT_PROJECT_NAME = 'my-strands-agent';

/**
 * Default package manager used when none is provided and `--yes` is active.
 */
const DEFAULT_PACKAGE_MANAGER: PackageManager = 'npm';

/**
 * Collect a complete scaffold configuration from the user.
 *
 * In non-interactive mode (`--yes`), defaults are applied immediately.
 * In interactive mode, the user is guided through prompts and shown a summary
 * for confirmation. If the summary is rejected, prompting restarts.
 */
export async function collectConfig(args: CollectConfigArgs): Promise<ScaffoldConfig> {
  const { flags } = args;

  // ── Non-interactive mode ──────────────────────────────────────────────
  if (flags.yes) {
    return buildNonInteractiveConfig(args);
  }

  // ── Interactive mode (loop until user confirms summary) ───────────────
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const config = await promptForConfig(args);
    const confirmed = await displaySummary(config);
    if (confirmed) {
      return config;
    }
    // User rejected — restart prompting
    await logger.info('Starting over…\n');
  }
}

// ─── Non-interactive helpers ──────────────────────────────────────────────────

/**
 * Build a ScaffoldConfig from CLI flags without any interactive prompts.
 */
function buildNonInteractiveConfig(args: CollectConfigArgs): ScaffoldConfig {
  const { flags } = args;

  const projectName = args.projectName ?? DEFAULT_PROJECT_NAME;

  const packageManager: PackageManager =
    flags.packageManager && flags.packageManager.trim().length > 0
      ? (flags.packageManager as PackageManager)
      : DEFAULT_PACKAGE_MANAGER;

  const modules: Set<ModuleName> =
    flags.modules && flags.modules.trim().length > 0
      ? parseModuleList(flags.modules)
      : new Set<ModuleName>();

  return {
    projectName,
    projectDir: path.resolve(process.cwd(), projectName),
    packageManager,
    modules,
    skipInstall: flags.noInstall,
    isNonInteractive: true,
  };
}

// ─── Interactive prompt flow ──────────────────────────────────────────────────

/**
 * Walk the user through each prompt and return the resulting config.
 */
async function promptForConfig(args: CollectConfigArgs): Promise<ScaffoldConfig> {
  // 1. Project name
  const projectName = await promptProjectName(args.projectName);

  // 2. Directory conflict check
  const projectDir = path.resolve(process.cwd(), projectName);
  await handleDirectoryConflict(projectDir);

  // 3. Package manager
  const packageManager = await promptPackageManager(args.flags.packageManager);

  // 4. Modules
  const modules = await promptModules(args.flags.modules);

  return {
    projectName,
    projectDir,
    packageManager,
    modules,
    skipInstall: args.flags.noInstall,
    isNonInteractive: false,
  };
}

/**
 * Prompt for the project name, or use the one supplied via CLI argument.
 */
async function promptProjectName(cliName?: string): Promise<string> {
  if (cliName && cliName.trim().length > 0) {
    return cliName;
  }

  return input({
    message: 'What is your project name?',
    default: DEFAULT_PROJECT_NAME,
    validate(value: string) {
      const result = validateProjectName(value);
      return result.valid ? true : (result.error ?? 'Invalid project name.');
    },
  });
}

/**
 * Check whether the target directory exists and is non-empty.
 * If so, prompt the user to overwrite, merge, or cancel.
 */
async function handleDirectoryConflict(projectDir: string): Promise<void> {
  const exists = await directoryExists(projectDir);
  if (!exists) return;

  const empty = await isDirectoryEmpty(projectDir);
  if (empty) return;

  const action = await select<string>({
    message: `Directory "${path.basename(projectDir)}" already exists and is not empty. What would you like to do?`,
    choices: [
      { name: 'Overwrite — remove existing files and create fresh', value: 'overwrite' },
      { name: 'Merge — write into the existing directory', value: 'merge' },
      { name: 'Cancel — abort scaffolding', value: CANCEL_SENTINEL },
    ],
  });

  if (action === CANCEL_SENTINEL) {
    await logger.info('Scaffolding cancelled.');
    process.exit(0);
  }

  // For "overwrite" or "merge", the scaffold step will handle the actual FS work.
  // We just need to let the flow continue.
}

/**
 * Prompt the user to select a package manager.
 * If a valid value was already provided via `--package-manager`, use it directly.
 */
async function promptPackageManager(cliValue?: string): Promise<PackageManager> {
  if (cliValue && cliValue.trim().length > 0) {
    const result = validatePackageManager(cliValue);
    if (result.valid) {
      return cliValue as PackageManager;
    }
  }

  return select<PackageManager>({
    message: 'Which package manager do you want to use?',
    choices: [
      { name: 'npm', value: 'npm' },
      { name: 'yarn', value: 'yarn' },
      { name: 'pnpm', value: 'pnpm' },
    ],
  });
}

/**
 * Prompt the user to select optional modules via a multi-select checkbox.
 * If a valid `--modules` flag was provided, parse and use it directly.
 */
async function promptModules(cliModules?: string): Promise<Set<ModuleName>> {
  if (cliModules && cliModules.trim().length > 0) {
    const result = validateModuleList(cliModules);
    if (result.valid) {
      return parseModuleList(cliModules);
    }
  }

  const selected = await checkbox<ModuleName>({
    message: 'Which optional modules would you like to include?',
    choices: [
      { name: 'Memory — persist and recall agent context', value: 'memory' },
      { name: 'Guardrails — input/output safety constraints', value: 'guardrails' },
      { name: 'A2A — Google Agent-to-Agent protocol support', value: 'a2a' },
      { name: 'AgentCore — AWS AgentCore deployment config', value: 'agentcore' },
    ],
  });

  return new Set(selected);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Display a formatted summary of the scaffold configuration and ask the user
 * to confirm before proceeding.
 *
 * @returns `true` if the user confirms, `false` if they want to start over.
 */
export async function displaySummary(config: ScaffoldConfig): Promise<boolean> {
  const moduleList =
    config.modules.size > 0
      ? [...config.modules].join(', ')
      : 'none';

  console.log('');
  console.log('┌──────────────────────────────────────┐');
  console.log('│        Project Configuration          │');
  console.log('├──────────────────────────────────────┤');
  console.log(`│  Name:            ${config.projectName}`);
  console.log(`│  Directory:       ${config.projectDir}`);
  console.log(`│  Package Manager: ${config.packageManager}`);
  console.log(`│  Modules:         ${moduleList}`);
  console.log(`│  Skip Install:    ${config.skipInstall ? 'yes' : 'no'}`);
  console.log('└──────────────────────────────────────┘');
  console.log('');

  return confirm({
    message: 'Proceed with this configuration?',
    default: true,
  });
}
