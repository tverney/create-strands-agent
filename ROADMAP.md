# Roadmap

Feature ideas and planned improvements for `create-strands-agent`. Items are grouped by theme, not strictly by release. Priorities may shift based on community feedback.

Contributions welcome for any of these — see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Developer Experience

- [ ] **Multi-model provider templates** — prompt users to choose a model provider (Bedrock, OpenAI, Google Gemini) and generate the corresponding setup code and dependencies
- [ ] **Vended tools selection** — the Strands SDK ships built-in tools (`bash`, `file_read`, etc.); let users pick which ones to include during setup
- [ ] **Test framework pre-configured** — add Vitest to generated projects with an example test for the agent
- [ ] **Hot-reload for A2A server** — `npm run dev:a2a` script using tsx watch on the A2A server entry point
- [ ] **Custom tool scaffolding** — `npx create-strands-agent add-tool my-tool` to generate a new tool file with Zod schema boilerplate
- [ ] **Interactive tool builder** — guided prompts to define tool name, description, input schema, and generate the full tool definition
- [ ] **Workspace presets** — predefined configurations (e.g., "minimal", "full-stack", "deployment-ready") to skip module selection

## Production Readiness

- [ ] **Docker Compose template** — local development setup with all services (agent, A2A server, AgentCore) running together
- [ ] **Observability setup** — structured logging, traces, and metrics extraction from `AgentResult`
- [ ] **Environment validation** — startup check that verifies AWS credentials, model access, and required env vars before running the agent
- [ ] **`.env.local` support** — gitignored local overrides for team-specific configuration
- [ ] **Health check endpoint** — `/health` endpoint in generated Express servers for container orchestration
- [ ] **Graceful shutdown** — signal handling (SIGTERM/SIGINT) in generated server code for clean container stops

## Advanced Agent Patterns

- [ ] **Multi-agent template** — orchestrator + worker agent pattern with inter-agent communication
- [ ] **Streaming response template** — SSE or WebSocket endpoint for real-time agent responses
- [ ] **Conversation history** — template code for maintaining multi-turn conversation state
- [ ] **RAG (Retrieval-Augmented Generation) template** — example setup with document retrieval and context injection
- [ ] **MCP server template** — Model Context Protocol server module for exposing tools to MCP-compatible clients
- [ ] **Agent chaining** — template for sequential agent pipelines where output of one agent feeds into the next

## Deployment & Infrastructure

- [ ] **CDK / CloudFormation template** — infrastructure-as-code for deploying the agent stack to AWS
- [ ] **Lambda deployment module** — generate Lambda handler wrapper and SAM/Serverless config
- [ ] **ECS Fargate template** — task definition and service config for containerized deployment
- [ ] **CI/CD pipeline template** — GitHub Actions workflow for build, test, and deploy
- [ ] **Multi-environment config** — `.env.development`, `.env.staging`, `.env.production` with environment-aware loading

## CLI Improvements

- [ ] **`npx create-strands-agent upgrade`** — update an existing project when templates change (diff and apply)
- [ ] **`npx create-strands-agent add-module <name>`** — add a module to an existing project without re-scaffolding
- [ ] **Dry run mode** — `--dry-run` flag to preview what files would be generated without writing anything
- [ ] **Custom templates** — `--template <path-or-url>` flag to use community or team-specific templates
- [ ] **Config file support** — `.create-strands-agentrc` for team-wide defaults (default modules, package manager, etc.)
- [ ] **Telemetry (opt-in)** — anonymous usage stats to understand which modules and configurations are most popular

## Ecosystem

- [ ] **Plugin system** — allow community-contributed modules to be installed and used alongside built-in ones
- [ ] **Template registry** — browsable catalog of community templates
- [ ] **Monorepo support** — generate agent projects within an existing monorepo (Turborepo, Nx, npm workspaces)
- [ ] **Python companion** — `create-strands-agent` equivalent for the Python SDK

---

## How to Contribute

Pick any item, open an issue to discuss the approach, and submit a PR. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions.

If you have ideas not listed here, open a [feature request](https://github.com/tverney/create-strands-agent/issues/new?template=feature_request.md).
