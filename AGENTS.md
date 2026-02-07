# Repository Guidelines

## Architecture & Core Modules
- Follow the layered architecture in `docs/00-architecture-overview.md`: React/TanStack Router UI → TanStack/Canvas stores → MCP tools/Command Bus → LowDB storage so every change follows the same flow.
- Treat `src/lib/canvas/`, `src/components/canvas/`, and Konva-backed renderers as the canvas system described in `docs/03-canvas-system.md`; they own document state, selection, interaction modes, and viewport math.
- Keep AI helpers (`src/lib/ai/`), MCP processors (`mcp-tools.ts` + `src/lib/mcp/`), chat UI (`src/components/chat/`), and `useChat` hook aligned with the module overview in `docs/01-agent-integration.md`; most TODOs live inside these pieces.
- Document-level persistence lives in `src/lib/db/` (see `docs/07-storage-database.md`); updates to storage should mirror the low-level flows defined there so client localStorage and server-side files stay in sync.
- Extras such as the tool context provider (`docs/05-tool-context-provider.md`) and command bus (`docs/04-command-bus.md`) enforce the bridge between AI tools and document mutations—always respect those boundaries when adding logic.

## Agent Integration & Usage
- `/api/ai/chat` streams every message via SSE, routes through the agent adapters, and emits tool-call/result/done events; follow `docs/01-agent-integration.md` for payload shape, error handling, and prompt customizations.
- Supported agents include Cloud Claude (Haiku/Sonnet/Opus), Ollama, CLI tools (`codex`, `geminicli`, `claudecode`), and MCP servers; detection details and manual configuration flows live in `docs/08-local-agent-integration.md`.
- Local agent detection differs by platform: Ollama uses `http://localhost:11434/api/tags`, CLI tools rely on PATH checks (`which/where`), and MCP servers read `~/.config/mcp/servers.json` (see doc 08). Tauri exposes Rust helpers while the browser relies on Node/HTTP fallbacks.
- Use `docs/09-quick-start-guide.md` whenever you need step-by-step instructions for cloud/local/CLI/MCP setups, including the optional CLI tool flow that works best in Tauri.
- Best practices from `docs/01-agent-integration.md`: always provide `selectedIDs`, route document mutations through MCP tools via the command bus, stream responses for UX, handle rate limits/validation errors with friendly copy, and remember agents can switch mid-conversation.
- Cloud usage requires `ANTHROPIC_API_KEY` (set in `.env` and typed in `src/env.ts`); local agents let users work without a key, so document the dependency clearly when touching config.

## MCP Tools & Command Bus
- Define every MCP tool in `mcp-tools.ts` and wire it through `src/lib/ai/mcp-tool-adapters.ts`; tools need names, descriptions, Zod-compatible schemas, and handlers that accept the shared `ToolContext` from `docs/02-mcp-tools.md`.
- Commands are the single mutation path (`docs/04-command-bus.md`): no direct document edits, always dispatch via the command bus, group related operations into transactions, and surface structured `CommandResult`s for success/failure.
- The Batch Design Processor (`docs/06-batch-design-processor.md`) parses JavaScript-like scripts, supports bindings, and rolls back the whole transaction on failure—use it whenever an AI prompt needs multiple steps.
- The Tool Context Provider (`docs/05-tool-context-provider.md`) bridges storage and editor state for clients/servers; tool handlers should rely on `ctx.storage`, `ctx.editor`, `ctx.ids`, and `ctx.nowISO()` rather than reaching into shared globals.

## Canvas & Storage
- The canvas store (see `docs/03-canvas-system.md`) exposes document/selection/viewport/ui state; read from `canvasStore.state` and mutate only via the provided actions to keep Konva rendering predictable.
- Selection, transform handles, and viewport helpers live in `src/lib/canvas/` and `src/components/canvas/`; keep visual feedback fast by batching updates and avoiding redundant re-renders.
- Storage uses LowDB-backed localStorage keys `'beak-users-db'` and `'beak_metadata'` on the client and a JSON file (`db/data.json`) on the server (`docs/07-storage-database.md`). Use the storage adapter in the tool context provider for persistence rather than writing to storage directly.
- When tools need the current document or selection on the client, prefer the canvas store runtime; on the server fall back to the storage adapter cache (`docs/05-tool-context-provider.md` explains the split).

## Build, Test, and Development Commands
- `pnpm dev` runs `vite dev --port 3000`; use this for local UI development with HMR.
- `pnpm build` creates the production bundle, and `pnpm preview` serves it locally for a sanity check before releasing.
- `pnpm test` runs the Vitest suites under `src/`; keep snapshots checked in whenever they change.
- `pnpm lint` (ESLint/TanStack config) and `pnpm format` (Prettier) enforce style; `pnpm check` runs both with autofixes.
- Before relying on new agent flows, consult `docs/09-quick-start-guide.md` to ensure all required services (Anthropic, Ollama, MCP, CLI) are configured and reachable.

## Coding Style & Naming Conventions
- Follow 2-space indentation, single quotes, and no semicolons to match `prettier.config.js` and `@tanstack/eslint-config`.
- Name components/hooks in PascalCase (e.g., `MyComponent.tsx`, `useAuth.ts`); route files follow their path (`src/routes/about.tsx`); shared utilities stay camelCase (`src/utils/fetcher.ts`).
- Avoid long CSS class lists in JSX; favor Tailwind utilities and, when repetition occurs, add semantic helpers in `src/styles.css`.
- Run `pnpm lint` before committing—ESLint enforces import order, unused vars, and sorting rules baked into the config.

## Testing Guidelines
- Vitest is the only test framework; place tests next to the code they exercise (`src/components/MyWidget.test.tsx`).
- Use descriptive names (`rendersChatMessage`, `handlesEmptyPrompt`) and keep suites focused; centralize mock data in `src/data` or `src/hooks`.
- Mention `pnpm test` in PR descriptions and note any skipped checks; add coverage notes if introducing new tooling that emits reports.

## Commit & Pull Request Guidelines
- Start with clear, present-tense subjects (e.g., `feat(router): add AI chat route`, `fix(auth): handle missing API key`) and explain *why* in the body.
- PRs should describe the change, link related issues/tickets, and list verification steps (commands, UI screenshots when layout changes).
- Always rerun `pnpm test` and `pnpm lint` locally before requesting review; if you skip a check, explain why.

## Security & Configuration Tips
- Keep secrets out of Git; only `ANTHROPIC_API_KEY` (and similar) live in an untracked `.env`. Update `src/env.ts` when you add new variables so `T3Env` types stay accurate.
- Local storage keys are `'beak-users-db'` and `'beak_metadata'` (`docs/07-storage-database.md`); avoid storing secrets in those blobs.
- Document that the cloud agent needs `ANTHROPIC_API_KEY`, but local agents (Ollama, CLI, MCP) let users work without hitting Anthropic, so mention dependencies when touching configuration flows.

## Documentation & References
- Keep these docs in sync: `docs/00-architecture-overview.md`, `docs/01-agent-integration.md`, `docs/02-mcp-tools.md`, `docs/03-canvas-system.md`, `docs/04-command-bus.md`, `docs/05-tool-context-provider.md`, `docs/06-batch-design-processor.md`, `docs/07-storage-database.md`, `docs/08-local-agent-integration.md`, and `docs/09-quick-start-guide.md`.
