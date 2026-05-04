/**
 * EJS template rendering logic for the create-strands-agent CLI.
 * Reads `.ejs` template files and renders them with the provided TemplateData.
 *
 * @module renderer
 */

import { readFileSync } from 'node:fs';
import * as ejs from 'ejs';
import type { TemplateData } from './types.js';

/**
 * Render an EJS template file with the given data.
 *
 * @param templatePath - Absolute or relative path to the `.ejs` template file.
 * @param data - Template data containing project name, module flags, and version info.
 * @returns The rendered template string.
 * @throws An error with the template path and reason if reading or rendering fails.
 */
export function render(templatePath: string, data: TemplateData): string {
  let templateContent: string;

  try {
    templateContent = readFileSync(templatePath, 'utf-8');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read template ${templatePath}: ${reason}`);
  }

  try {
    return ejs.render(templateContent, data, { filename: templatePath });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to render template ${templatePath}: ${reason}`);
  }
}
