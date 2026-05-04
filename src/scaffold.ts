/**
 * Template engine and scaffold orchestrator for the create-strands-agent CLI.
 * Defines the template manifest and orchestrates file generation from EJS templates.
 *
 * @module scaffold
 */

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { render } from './renderer.js';
import { writeFile, mkdirp } from './utils/fs.js';
import { logger } from './utils/logger.js';
import type {
  ScaffoldConfig,
  ScaffoldResult,
  TemplateData,
  TemplateFile,
  TemplateManifest,
} from './types.js';

/**
 * Pinned version of the Strands Agents SDK used in generated projects.
 */
const STRANDS_VERSION = '1.0.0';

/**
 * Minimum Node.js version required by generated projects.
 */
const NODE_VERSION = '20.0.0';

// ---------------------------------------------------------------------------
// Template Manifest
// ---------------------------------------------------------------------------

/**
 * The complete template manifest mapping template paths to output paths.
 * Each entry optionally includes a condition predicate that determines
 * whether the file should be included based on the selected modules.
 *
 * Template paths are relative to the `templates/` directory.
 * Output paths are relative to the generated project root.
 */
export const TEMPLATE_MANIFEST: TemplateManifest = [
  // ── Base templates (always included) ──────────────────────────────────
  {
    templatePath: 'base/package.json.ejs',
    outputPath: 'package.json',
  },
  {
    templatePath: 'base/tsconfig.json.ejs',
    outputPath: 'tsconfig.json',
  },
  {
    templatePath: 'base/.env.example.ejs',
    outputPath: '.env.example',
  },
  {
    templatePath: 'base/.gitignore.ejs',
    outputPath: '.gitignore',
  },
  {
    templatePath: 'base/.eslintrc.json.ejs',
    outputPath: '.eslintrc.json',
  },
  {
    templatePath: 'base/README.md.ejs',
    outputPath: 'README.md',
  },
  {
    templatePath: 'base/src/index.ts.ejs',
    outputPath: 'src/index.ts',
  },

  // ── Memory module templates ───────────────────────────────────────────
  {
    templatePath: 'memory/src/memory/index.ts.ejs',
    outputPath: 'src/memory/index.ts',
    condition: (data: TemplateData) => data.hasMemory,
  },
  {
    templatePath: 'memory/src/memory/provider.ts.ejs',
    outputPath: 'src/memory/provider.ts',
    condition: (data: TemplateData) => data.hasMemory,
  },

  // ── Guardrails module templates ───────────────────────────────────────
  {
    templatePath: 'guardrails/src/guardrails/index.ts.ejs',
    outputPath: 'src/guardrails/index.ts',
    condition: (data: TemplateData) => data.hasGuardrails,
  },
  {
    templatePath: 'guardrails/src/guardrails/input-guardrail.ts.ejs',
    outputPath: 'src/guardrails/input-guardrail.ts',
    condition: (data: TemplateData) => data.hasGuardrails,
  },
  {
    templatePath: 'guardrails/src/guardrails/output-guardrail.ts.ejs',
    outputPath: 'src/guardrails/output-guardrail.ts',
    condition: (data: TemplateData) => data.hasGuardrails,
  },

  // ── A2A module templates ──────────────────────────────────────────────
  {
    templatePath: 'a2a/src/a2a/server.ts.ejs',
    outputPath: 'src/a2a/server.ts',
    condition: (data: TemplateData) => data.hasA2A,
  },
  {
    templatePath: 'a2a/src/a2a/agent-card.json.ejs',
    outputPath: 'src/a2a/agent-card.json',
    condition: (data: TemplateData) => data.hasA2A,
  },

  // ── AgentCore module templates ────────────────────────────────────────
  {
    templatePath: 'agentcore/deployment/Dockerfile.ejs',
    outputPath: 'deployment/Dockerfile',
    condition: (data: TemplateData) => data.hasAgentCore,
  },
  {
    templatePath: 'agentcore/deployment/deploy.sh.ejs',
    outputPath: 'deployment/deploy.sh',
    condition: (data: TemplateData) => data.hasAgentCore,
  },
  {
    templatePath: 'agentcore/deployment/agentcore-config.json.ejs',
    outputPath: 'deployment/agentcore-config.json',
    condition: (data: TemplateData) => data.hasAgentCore,
  },
  {
    templatePath: 'agentcore/src/server.ts.ejs',
    outputPath: 'src/server.ts',
    condition: (data: TemplateData) => data.hasAgentCore,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the absolute path to the `templates/` directory.
 * Works both when running from source (via tsx) and from compiled output (dist/).
 */
export function getTemplatesDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  // From src/ or dist/, go up one level to the package root, then into templates/
  return resolve(currentDir, '..', 'templates');
}

/**
 * Convert a ScaffoldConfig into the TemplateData consumed by EJS templates.
 */
export function toTemplateData(config: ScaffoldConfig): TemplateData {
  return {
    projectName: config.projectName,
    hasMemory: config.modules.has('memory'),
    hasGuardrails: config.modules.has('guardrails'),
    hasA2A: config.modules.has('a2a'),
    hasAgentCore: config.modules.has('agentcore'),
    strandsVersion: STRANDS_VERSION,
    nodeVersion: NODE_VERSION,
  };
}

/**
 * Filter the manifest to only include files whose condition is met (or unconditional).
 */
export function filterManifest(
  manifest: TemplateManifest,
  data: TemplateData,
): TemplateFile[] {
  return manifest.filter((entry) => !entry.condition || entry.condition(data));
}

// ---------------------------------------------------------------------------
// Scaffold Orchestrator
// ---------------------------------------------------------------------------

/**
 * Scaffold a new Strands agent project based on the provided configuration.
 *
 * 1. Creates the project directory.
 * 2. Filters the template manifest by selected modules.
 * 3. Renders each template with EJS and writes the output file.
 * 4. Tracks created files for potential cleanup on failure.
 * 5. Reports progress via the logger spinner.
 *
 * On the first file-write error the scaffold aborts and returns the error details.
 *
 * @param config - The scaffold configuration collected from prompts or CLI flags.
 * @returns A ScaffoldResult indicating success/failure, files created, and any errors.
 */
export async function scaffold(config: ScaffoldConfig): Promise<ScaffoldResult> {
  const filesCreated: string[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  const templateData = toTemplateData(config);
  const templatesDir = getTemplatesDir();
  const filesToGenerate = filterManifest(TEMPLATE_MANIFEST, templateData);

  // 1. Create the project directory
  try {
    await mkdirp(config.projectDir);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    errors.push({ file: config.projectDir, error: reason });
    return { success: false, filesCreated, errors };
  }

  await logger.startSpinner('Generating project files…');

  // 2. Render and write each template
  for (const entry of filesToGenerate) {
    const templateAbsPath = join(templatesDir, entry.templatePath);
    const outputAbsPath = join(config.projectDir, entry.outputPath);

    await logger.updateSpinner(`Creating ${entry.outputPath}`);

    // Render the template
    let rendered: string;
    try {
      rendered = render(templateAbsPath, templateData);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push({ file: entry.outputPath, error: reason });
      await logger.stopSpinner(false);
      return { success: false, filesCreated, errors };
    }

    // Write the rendered content to disk
    const writeError = await writeFile(outputAbsPath, rendered);
    if (writeError) {
      errors.push({ file: writeError.file, error: writeError.error });
      await logger.stopSpinner(false);
      return { success: false, filesCreated, errors };
    }

    filesCreated.push(outputAbsPath);
  }

  await logger.stopSpinner(true);

  return { success: true, filesCreated, errors };
}
