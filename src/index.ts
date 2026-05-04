/**
 * CLI entry point for the create-strands-agent scaffolding tool.
 * Configures Commander, orchestrates the pipeline, and handles errors.
 *
 * @module index
 */

import { Command } from 'commander';
import { collectConfig } from './prompts.js';
import { scaffold } from './scaffold.js';
import { install } from './installer.js';
import { display } from './output.js';
import { validateProjectName, validateModuleList, validatePackageManager, validateFlagCombinations } from './validators.js';
import { checkNodeVersion } from './utils/node-version.js';
import { cleanupPaths } from './utils/fs.js';
import { logger } from './utils/logger.js';
import type { CLIFlags } from './types.js';

/**
 * Minimum Node.js major version required to run the CLI.
 */
const MINIMUM_NODE_VERSION = '20';

/**
 * Paths created during scaffolding, tracked for cleanup on interruption.
 */
let createdPaths: string[] = [];

/**
 * Whether the process is currently handling a SIGINT signal.
 * Prevents double-cleanup if the user presses Ctrl+C multiple times.
 */
let isCleaningUp = false;

/**
 * Handle SIGINT (Ctrl+C) by cleaning up partially created files and exiting.
 */
async function handleSigint(): Promise<void> {
  if (isCleaningUp) return;
  isCleaningUp = true;

  console.log(''); // Move past the ^C on the terminal line
  if (createdPaths.length > 0) {
    await logger.info('Cleaning up created files…');
    await cleanupPaths(createdPaths);
  }

  process.exit(130);
}

/**
 * Create and configure the Commander program.
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('create-strands-agent')
    .description('Scaffold a production-ready Strands Agents TypeScript project')
    .version('0.1.0')
    .argument('[project-name]', 'Name of the project to create')
    .option('-y, --yes', 'Skip interactive prompts and use defaults', false)
    .option('-m, --modules <modules>', 'Comma-separated list of modules: memory,guardrails,a2a,agentcore')
    .option('--package-manager <pm>', 'Package manager to use: npm, yarn, or pnpm')
    .option('--no-install', 'Skip automatic dependency installation')
    .action(async (projectName: string | undefined, options: Record<string, unknown>) => {
      await run(projectName, options);
    });

  return program;
}

/**
 * Main CLI action — validates inputs, collects config, scaffolds, installs, and displays output.
 */
async function run(projectName: string | undefined, options: Record<string, unknown>): Promise<void> {
  // ── 1. Check Node.js version ────────────────────────────────────────
  if (!checkNodeVersion(MINIMUM_NODE_VERSION)) {
    await logger.error(`Node.js >= ${MINIMUM_NODE_VERSION} is required. You are running ${process.version}.`);
    process.exit(1);
  }

  // ── 2. Build flags object ───────────────────────────────────────────
  const flags: CLIFlags = {
    yes: options.yes as boolean,
    modules: (options.modules as string) ?? '',
    packageManager: (options.packageManager as string) ?? '',
    noInstall: options.install === false, // Commander inverts --no-install to install=false
  };

  // ── 3. Validate flags ──────────────────────────────────────────────
  // Validate project name if provided as argument
  if (projectName) {
    const nameResult = validateProjectName(projectName);
    if (!nameResult.valid) {
      await logger.error(`Invalid project name: ${nameResult.error}`);
      process.exit(1);
    }
  }

  // Validate --modules flag if provided
  if (flags.modules && flags.modules.trim().length > 0) {
    const moduleResult = validateModuleList(flags.modules);
    if (!moduleResult.valid) {
      await logger.error(moduleResult.error!);
      process.exit(1);
    }
  }

  // Validate --package-manager flag if provided
  if (flags.packageManager && flags.packageManager.trim().length > 0) {
    const pmResult = validatePackageManager(flags.packageManager);
    if (!pmResult.valid) {
      await logger.error(pmResult.error!);
      process.exit(1);
    }
  }

  // Validate flag combinations
  const flagResult = validateFlagCombinations(flags);
  if (!flagResult.valid) {
    await logger.error(flagResult.error!);
    process.exit(1);
  }

  // ── 4. Collect configuration ────────────────────────────────────────
  let config;
  try {
    config = await collectConfig({
      projectName,
      flags,
    });
  } catch (err) {
    // User may have cancelled a prompt (e.g., Ctrl+C during inquirer)
    if (err instanceof Error && err.message.includes('User force closed')) {
      await handleSigint();
      return;
    }
    const reason = err instanceof Error ? err.message : String(err);
    await logger.error(`Configuration failed: ${reason}`);
    process.exit(1);
  }

  // ── 5. Scaffold project ─────────────────────────────────────────────
  const scaffoldResult = await scaffold(config);
  createdPaths = scaffoldResult.filesCreated;

  if (!scaffoldResult.success) {
    for (const err of scaffoldResult.errors) {
      await logger.error(`Failed to write ${err.file}: ${err.error}`);
    }
    await logger.info('Cleaning up created files…');
    await cleanupPaths(createdPaths);
    process.exit(1);
  }

  // ── 6. Install dependencies ─────────────────────────────────────────
  const installResult = await install({
    projectDir: config.projectDir,
    packageManager: config.packageManager,
    skipInstall: config.skipInstall,
  });

  // ── 7. Display next steps ───────────────────────────────────────────
  await display(config, installResult);
}

// ── Wire SIGINT handler ───────────────────────────────────────────────────
process.on('SIGINT', () => {
  void handleSigint();
});

// ── Parse and execute ─────────────────────────────────────────────────────
const program = createProgram();
program.parseAsync(process.argv).catch(async (err: unknown) => {
  const reason = err instanceof Error ? err.message : String(err);
  await logger.error(`Unexpected error: ${reason}`);
  process.exit(1);
});
