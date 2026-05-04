# Contributing to create-strands-agent

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/tverney/create-strands-agent.git
cd create-strands-agent
npm install
```

## Project Structure

```
src/              # CLI source code (TypeScript)
templates/        # EJS templates for generated projects
bin/              # CLI entry point
```

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
```

The test suite includes property-based tests (fast-check), unit tests, and integration tests that scaffold real projects and verify TypeScript compilation.

## Building

```bash
npm run build
```

## Linting and Formatting

```bash
npm run lint          # Check for lint errors
npm run lint:fix      # Auto-fix lint errors
npm run format        # Format code with Prettier
npm run format:check  # Check formatting
```

## Making Changes

1. Fork the repository and create a branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Run `npm test` and ensure all tests pass
5. Run `npm run lint` and `npm run format:check`
6. Submit a pull request

## Templates

Generated project files live in `templates/`. Each module has its own directory:

- `templates/base/` — always included (package.json, tsconfig, index.ts, etc.)
- `templates/memory/` — memory module files
- `templates/guardrails/` — guardrails module files
- `templates/a2a/` — A2A protocol files
- `templates/agentcore/` — AgentCore deployment files

Templates use [EJS](https://ejs.co/) syntax. The template manifest in `src/scaffold.ts` controls which files are generated based on module selection.

## Adding a New Module

1. Create a new template directory under `templates/<module-name>/`
2. Add template entries to `TEMPLATE_MANIFEST` in `src/scaffold.ts`
3. Add the module name to the `ModuleName` type in `src/types.ts`
4. Update the prompt choices in `src/prompts.ts`
5. Add dependency mappings if the module requires new npm packages
6. Add tests for the new module
7. Update the README

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new features
- `fix:` — bug fixes
- `docs:` — documentation changes
- `refactor:` — code changes that neither fix bugs nor add features
- `test:` — adding or updating tests

## Reporting Issues

Use [GitHub Issues](https://github.com/tverney/create-strands-agent/issues) to report bugs or request features. Please include:

- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Node.js version and OS
- CLI flags used

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
