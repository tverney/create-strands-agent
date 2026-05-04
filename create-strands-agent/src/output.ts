/**
 * Post-scaffold output — displays next-step instructions after scaffolding
 * completes, tailored to the user's selected modules and install outcome.
 *
 * @module output
 */

import { logger } from './utils/logger.js';
import type { ScaffoldConfig, InstallResult } from './types.js';

/**
 * Build the run command for the selected package manager.
 */
function runCmd(pm: ScaffoldConfig['packageManager'], script: string): string {
  if (pm === 'npm') return `npm run ${script}`;
  if (pm === 'yarn') return `yarn ${script}`;
  return `pnpm ${script}`;
}

/**
 * Build the install command for the selected package manager.
 */
function installCmd(pm: ScaffoldConfig['packageManager']): string {
  if (pm === 'npm') return 'npm install';
  if (pm === 'yarn') return 'yarn install';
  return 'pnpm install';
}

/**
 * Display post-scaffold instructions to the user.
 *
 * Always shows:
 * - `cd <projectName>` and the dev/start commands
 * - Strands SDK documentation links
 *
 * Conditionally shows:
 * - A2A endpoint URL and testing instructions (when A2A module selected)
 * - AgentCore deployment instructions (when AgentCore module selected)
 * - Manual install instructions (when install was skipped or failed)
 *
 * @param config - The scaffold configuration used to generate the project.
 * @param installResult - Optional result from the dependency installation step.
 */
export async function display(config: ScaffoldConfig, installResult?: InstallResult): Promise<void> {
  const needsManualInstall = !installResult || !installResult.success || config.skipInstall;

  await logger.success('\nProject created successfully!\n');

  await logger.info('Next steps:\n');

  // Always: navigate and run
  await logger.info(`  cd ${config.projectName}`);

  if (needsManualInstall) {
    await logger.info(`  ${installCmd(config.packageManager)}`);
  }

  await logger.info(`  ${runCmd(config.packageManager, 'dev')}\n`);

  // A2A-specific instructions
  if (config.modules.has('a2a')) {
    await logger.info('A2A Protocol:');
    await logger.info('  Agent card:  http://localhost:3000/.well-known/agent.json');
    await logger.info('  A2A endpoint: http://localhost:3000/a2a');
    await logger.info('  Test with:   curl http://localhost:3000/.well-known/agent.json\n');
  }

  // AgentCore-specific instructions
  if (config.modules.has('agentcore')) {
    await logger.info('AgentCore Deployment:');
    await logger.info('  1. Configure AWS credentials and region in .env');
    await logger.info('  2. Review deployment/agentcore-config.json');
    await logger.info(`  3. Run: ${runCmd(config.packageManager, 'build')}`);
    await logger.info('  4. Run: bash deployment/deploy.sh');
    await logger.info('  Prerequisites: Docker, AWS CLI, and appropriate IAM permissions\n');
  }

  // Manual install instructions when install failed
  if (installResult && !installResult.success && installResult.error) {
    await logger.warn('Dependency installation failed:');
    await logger.warn(`  ${installResult.error}`);
    await logger.info(`  Run "${installCmd(config.packageManager)}" manually in the project directory.\n`);
  }

  // Documentation links (always)
  await logger.info('Documentation:');
  await logger.info('  Strands Agents SDK: https://strandsagents.com/docs/');
  await logger.info('  TypeScript Guide:   https://strandsagents.com/docs/user-guide/quickstart/typescript/');
}
