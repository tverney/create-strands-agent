# create-strands-agent

Scaffold a production-ready [Strands Agents](https://strandsagents.com/) TypeScript project with one command.

```bash
npx create-strands-agent
```

`create-strands-agent` is an interactive CLI that generates a fully configured TypeScript project built on the Strands Agents SDK. It supports optional modules for agent memory, input/output guardrails, Google's Agent-to-Agent (A2A) protocol, and AWS AgentCore deployment.

## Quick Start

```bash
npx create-strands-agent my-agent
cd my-agent
npm run dev
```

That's it. You'll have a working Strands agent running locally.

## Features

- **Interactive setup** — guided prompts walk you through project configuration
- **Non-interactive mode** — use flags for CI/CD pipelines and automation
- **Modular architecture** — pick only the modules you need
- **TypeScript-first** — strict mode, ESM, ES2022 target
- **Multiple package managers** — npm, yarn, or pnpm

### Optional Modules

| Module | Description |
|--------|-------------|
| **Memory** | Persist and recall agent context across interactions. Includes a local file-based provider for development with inline guidance on swapping to production stores. |
| **Guardrails** | Input and output safety constraints. Generates example guardrails demonstrating content validation and response filtering. |
| **A2A** | Google's [Agent-to-Agent protocol](https://github.com/a2aproject/a2a-js) support. Generates an A2A server and agent card so your agent can communicate with other agents. |
| **AgentCore** | AWS AgentCore deployment configuration. Generates a Dockerfile, deployment script, and AgentCore config for deploying to AWS. |

## Usage

### Interactive Mode

Run without arguments to get the full interactive experience:

```bash
npx create-strands-agent
```

You'll be prompted for:

1. **Project name** — the directory name and package name
2. **Package manager** — npm, yarn, or pnpm
3. **Modules** — select from Memory, Guardrails, A2A, and AgentCore
4. **Confirmation** — review your selections before generating

If the target directory already exists and is non-empty, you'll be asked to overwrite, merge, or cancel.

### With a Project Name

Pass the project name as an argument to skip that prompt:

```bash
npx create-strands-agent my-agent
```

### Non-Interactive Mode

Use `--yes` to skip all prompts and use defaults:

```bash
npx create-strands-agent my-agent --yes
```

Defaults: npm as package manager, no optional modules, dependencies installed automatically.

### CLI Flags

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip interactive prompts, use defaults |
| `-m, --modules <list>` | Comma-separated modules: `memory`, `guardrails`, `a2a`, `agentcore` |
| `--package-manager <pm>` | Package manager: `npm`, `yarn`, or `pnpm` |
| `--no-install` | Skip automatic dependency installation |
| `-V, --version` | Display the CLI version |
| `-h, --help` | Display usage information |

### Examples

Scaffold with memory and guardrails using yarn:

```bash
npx create-strands-agent my-agent --modules memory,guardrails --package-manager yarn
```

Scaffold with all modules, no install (useful in CI):

```bash
npx create-strands-agent my-agent --yes --modules memory,guardrails,a2a,agentcore --no-install
```

Scaffold with A2A support using pnpm:

```bash
npx create-strands-agent my-agent --modules a2a --package-manager pnpm
```

## Generated Project Structure

A scaffold with all modules selected produces:

```
my-agent/
├── src/
│   ├── index.ts                  # Agent entry point
│   ├── memory/
│   │   ├── index.ts              # Memory initialization
│   │   └── provider.ts           # Local file-based memory provider
│   ├── guardrails/
│   │   ├── index.ts              # Guardrail registration
│   │   ├── input-guardrail.ts    # Example input validation
│   │   └── output-guardrail.ts   # Example output filtering
│   ├── a2a/
│   │   ├── server.ts             # A2A protocol server
│   │   └── agent-card.json       # Agent capabilities descriptor
│   └── server.ts                 # Express server for AgentCore
├── deployment/
│   ├── Dockerfile                # Docker build for AgentCore
│   ├── deploy.sh                 # Deployment script
│   └── agentcore-config.json     # AgentCore configuration
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .env.example
├── .gitignore
└── README.md
```

Module directories are only included when their corresponding module is selected.

## Generated Project Scripts

Every generated project includes these npm scripts:

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch src/index.ts` | Run the agent in development mode with hot-reload |
| `build` | `tsc` | Compile TypeScript to JavaScript |
| `start` | `node dist/index.ts` | Run the compiled agent in production mode |
| `lint` | `eslint src/` | Run ESLint on the project source |

## Requirements

- **Node.js >= 20** — the CLI checks your Node version at startup and exits with a clear message if it's too low.

## How It Works

The CLI follows a pipeline architecture:

1. **Parse CLI args** — Commander.js handles flags and the positional project name
2. **Collect config** — interactive prompts via `@inquirer/prompts`, or defaults from flags
3. **Render templates** — EJS templates are filtered by selected modules and rendered with your configuration
4. **Install dependencies** — runs the selected package manager's install command
5. **Display next steps** — shows commands to run, documentation links, and module-specific instructions

Templates are bundled in the package under `templates/`. Each module has its own template directory, and a manifest controls which files are generated based on your selections.

## Development

### Setup

```bash
git clone https://github.com/tverney/create-strands-agent.git
cd create-strands-agent
npm install
```

### Running Tests

```bash
npm test
```

The test suite includes:

- **Property-based tests** (fast-check) — verify correctness properties across all valid input combinations with 100+ iterations each
- **Unit tests** (Vitest) — cover validators, utilities, CLI argument parsing, and error handling
- **Integration tests** — scaffold real projects to temp directories and run `tsc --noEmit` to verify TypeScript compilation

### Building

```bash
npm run build
```

### Testing Locally

After building, you can test the CLI locally:

```bash
node bin/create-strands-agent.js my-test-project
```

Or link it globally:

```bash
npm link
create-strands-agent my-test-project
```

## License

MIT
