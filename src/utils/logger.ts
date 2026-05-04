/**
 * Logger utility wrapping `ora` (spinner) and `chalk` (colors) for consistent CLI output.
 * Gracefully falls back to plain `console.log` in non-TTY environments or when ora/chalk fail.
 *
 * @module utils/logger
 */

import type { Ora } from 'ora';

let oraInstance: typeof import('ora').default | undefined;
let chalkInstance: typeof import('chalk').default | undefined;

/**
 * Dynamically load ESM-only dependencies (ora and chalk).
 * Returns silently on failure — the logger falls back to console.log.
 */
async function loadDependencies(): Promise<void> {
  try {
    const oraModule = await import('ora');
    oraInstance = oraModule.default;
  } catch {
    // ora unavailable — spinner will fall back to console.log
  }

  try {
    const chalkModule = await import('chalk');
    chalkInstance = chalkModule.default;
  } catch {
    // chalk unavailable — colors will be omitted
  }
}

// Eagerly start loading dependencies
const depsReady = loadDependencies();

let activeSpinner: Ora | undefined;

/**
 * Ensure dynamic dependencies have finished loading.
 * Called internally before first use.
 */
async function ensureReady(): Promise<void> {
  await depsReady;
}

/**
 * Display an informational message (blue text when chalk is available).
 */
export async function info(message: string): Promise<void> {
  await ensureReady();
  if (chalkInstance) {
    console.log(chalkInstance.blue(message));
  } else {
    console.log(message);
  }
}

/**
 * Display a success message (green text when chalk is available).
 */
export async function success(message: string): Promise<void> {
  await ensureReady();
  if (chalkInstance) {
    console.log(chalkInstance.green(message));
  } else {
    console.log(message);
  }
}

/**
 * Display an error message (red text when chalk is available).
 */
export async function error(message: string): Promise<void> {
  await ensureReady();
  if (chalkInstance) {
    console.error(chalkInstance.red(message));
  } else {
    console.error(message);
  }
}

/**
 * Display a warning message (yellow text when chalk is available).
 */
export async function warn(message: string): Promise<void> {
  await ensureReady();
  if (chalkInstance) {
    console.log(chalkInstance.yellow(message));
  } else {
    console.log(message);
  }
}

/**
 * Start a spinner with the given message.
 * Falls back to a plain console.log if ora is unavailable or not in a TTY.
 */
export async function startSpinner(message: string): Promise<void> {
  await ensureReady();
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = undefined;
  }

  if (oraInstance) {
    try {
      activeSpinner = oraInstance(message).start();
      return;
    } catch {
      // ora failed to start — fall through to console.log
    }
  }

  console.log(message);
}

/**
 * Update the active spinner's text.
 * Falls back to a plain console.log if no spinner is active.
 */
export async function updateSpinner(message: string): Promise<void> {
  await ensureReady();
  if (activeSpinner) {
    activeSpinner.text = message;
  } else {
    console.log(message);
  }
}

/**
 * Stop the active spinner.
 * @param ok - If true (default), show a success mark. If false, show a failure mark.
 */
export async function stopSpinner(ok: boolean = true): Promise<void> {
  await ensureReady();
  if (activeSpinner) {
    if (ok) {
      activeSpinner.succeed();
    } else {
      activeSpinner.fail();
    }
    activeSpinner = undefined;
  }
}

/**
 * Convenience object that groups all logger functions under a single namespace.
 */
export const logger = {
  info,
  success,
  error,
  warn,
  startSpinner,
  updateSpinner,
  stopSpinner,
} as const;
