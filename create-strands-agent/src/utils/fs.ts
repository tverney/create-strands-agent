/**
 * File system helpers for the create-strands-agent CLI.
 * Wraps `node:fs/promises` and `node:path` with error capture and cleanup support.
 *
 * @module utils/fs
 */

import { mkdir, writeFile as fsWriteFile, unlink, rmdir, readdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Error result returned when a file write operation fails.
 */
export interface WriteFileError {
  file: string;
  error: string;
}

/**
 * Write content to a file, creating parent directories automatically.
 * Returns `undefined` on success or an error object on failure (never throws).
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<WriteFileError | undefined> {
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await fsWriteFile(filePath, content, 'utf-8');
    return undefined;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { file: filePath, error: reason };
  }
}

/**
 * Recursively create a directory and all necessary parent directories.
 * Equivalent to `mkdir -p`. Silently succeeds if the directory already exists.
 */
export async function mkdirp(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Check whether a path exists and is a directory.
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check whether a directory exists and contains no entries.
 * Returns `true` if the directory does not exist or is empty.
 */
export async function isDirectoryEmpty(dirPath: string): Promise<boolean> {
  try {
    const entries = await readdir(dirPath);
    return entries.length === 0;
  } catch {
    // Directory doesn't exist or can't be read — treat as empty
    return true;
  }
}

/**
 * Clean up created files and directories on failure or cancellation.
 * Iterates paths in reverse order (deepest first) and removes each:
 * - Files are removed with `unlink`
 * - Directories are removed with `rmdir`
 *
 * Errors during cleanup are silently ignored to ensure best-effort removal.
 */
export async function cleanupPaths(paths: string[]): Promise<void> {
  for (let i = paths.length - 1; i >= 0; i--) {
    const p = paths[i];
    try {
      const stats = await stat(p);
      if (stats.isDirectory()) {
        await rmdir(p);
      } else {
        await unlink(p);
      }
    } catch {
      // Best-effort cleanup — ignore errors (file may already be gone, dir non-empty, etc.)
    }
  }
}
