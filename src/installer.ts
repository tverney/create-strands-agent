/**
 * Dependency installer — runs the selected package manager to install
 * project dependencies after scaffolding completes.
 *
 * @module installer
 */

import { execFile } from 'node:child_process';
import { logger } from './utils/logger.js';
import type { InstallConfig, InstallResult } from './types.js';

/**
 * Map a package manager name to its install command and arguments.
 */
export function getInstallCommand(pm: InstallConfig['packageManager']): { command: string; args: string[] } {
  switch (pm) {
    case 'npm':
      return { command: 'npm', args: ['install'] };
    case 'yarn':
      return { command: 'yarn', args: ['install'] };
    case 'pnpm':
      return { command: 'pnpm', args: ['install'] };
  }
}

/**
 * Install project dependencies using the configured package manager.
 *
 * If `config.skipInstall` is true the function returns immediately with a
 * successful result and no child process is spawned.
 *
 * @param config - Installation configuration (project directory, package manager, skip flag).
 * @returns A promise that resolves to an {@link InstallResult}.
 */
export async function install(config: InstallConfig): Promise<InstallResult> {
  if (config.skipInstall) {
    return { success: true };
  }

  const { command, args } = getInstallCommand(config.packageManager);

  await logger.startSpinner(`Installing dependencies with ${config.packageManager}…`);

  return new Promise<InstallResult>((resolve) => {
    execFile(command, args, { cwd: config.projectDir, maxBuffer: 10 * 1024 * 1024 }, async (err, _stdout, stderr) => {
      if (err) {
        await logger.stopSpinner(false);
        const errorMessage = stderr?.trim() || err.message;
        resolve({ success: false, error: errorMessage });
      } else {
        await logger.stopSpinner(true);
        resolve({ success: true });
      }
    });
  });
}
