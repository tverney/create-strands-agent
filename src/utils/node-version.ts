/**
 * Node.js version check utility.
 * Ensures the runtime meets the minimum version requirement for the CLI.
 *
 * @module utils/node-version
 */

/**
 * Check whether the current Node.js version meets the minimum major version requirement.
 *
 * @param minimum - A version string like "20" or "20.0.0". Only the major version is compared.
 * @returns `true` if the current Node.js major version >= the minimum major version.
 */
export function checkNodeVersion(minimum: string): boolean {
  const currentMajor = parseMajorVersion(process.version);
  const minimumMajor = parseMajorVersion(minimum);
  return currentMajor >= minimumMajor;
}

/**
 * Extract the major version number from a version string.
 * Handles formats like "v20.11.0", "20.11.0", "20.0.0", or just "20".
 */
function parseMajorVersion(version: string): number {
  // Strip leading "v" if present
  const cleaned = version.startsWith('v') ? version.slice(1) : version;
  const major = parseInt(cleaned.split('.')[0], 10);
  return isNaN(major) ? 0 : major;
}
