# Beak Design

Beak Design is a canvas-based design tool with AI-assisted editing. It supports cloud and local agents and routes document mutations through MCP tools and a command bus.


<img width="1916" height="1043" alt="image" src="https://github.com/user-attachments/assets/d32fdef3-099a-4624-8cfc-4a4f521e3964" />

## Tech Stack

- TanStack Start + TanStack Router
- React + TypeScript
- TanStack Store for app state
- Konva / React Konva for canvas rendering
- LowDB for persistence
- Tauri (optional desktop runtime)

## Requirements

- Node.js
- pnpm
- Rust toolchain (only required for Tauri desktop development/builds)

## Development

Install dependencies:

```bash
pnpm install
```

Run web app (Vite on port 3000):

```bash
pnpm dev
```

## Build

Web build:

```bash
pnpm build
```

Preview production build:

```bash
pnpm preview
```

Tauri desktop:

```bash
pnpm tauri:dev
pnpm tauri:build
```

## Quality Checks

Run tests:

```bash
pnpm test
```

Run lint:

```bash
pnpm lint
```

Run formatter:

```bash
pnpm format
```

Run formatter + eslint autofix:

```bash
pnpm check
```

## AI Agent Configuration

### Cloud Agent (Anthropic)

Set `ANTHROPIC_API_KEY` in your environment (for example in `.env`/`.env.local`):

```env
ANTHROPIC_API_KEY=your_api_key_here
```

`ANTHROPIC_API_KEY` is optional if you only use local agents.

### Local Agents

Beak Design supports:

- Ollama
- CLI agents (`codex`, `geminicli`, `claudecode`) when available on `PATH`
- MCP servers from local MCP config

See setup details in `docs/09-quick-start-guide.md` and `docs/08-local-agent-integration.md`.

## Architecture Notes

High-level flow:

1. UI (TanStack Router + React) interacts with canvas and chat state
2. AI/chat requests stream through `/api/ai/chat`
3. MCP tools execute through the command bus
4. Storage adapters persist document data via LowDB-backed layers

Reference docs:

- `docs/00-architecture-overview.md`
- `docs/01-agent-integration.md`
- `docs/02-mcp-tools.md`
- `docs/03-canvas-system.md`
- `docs/04-command-bus.md`
- `docs/05-tool-context-provider.md`
- `docs/06-batch-design-processor.md`
- `docs/07-storage-database.md`
- `docs/08-local-agent-integration.md`
- `docs/09-quick-start-guide.md`

Full docs index: `docs/README.md`

## Persistence Notes

Client storage keys used by the app:

- `beak-users-db`
- `beak_metadata`
