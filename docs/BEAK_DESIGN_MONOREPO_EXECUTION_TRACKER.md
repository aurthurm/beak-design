# Beak Design Monorepo Execution Tracker

## Goal

Reorganize `beak-design` as a fresh monorepo so the product can be built back up in clean layers:

- schema
- editor core
- UI bindings
- AI runtime
- tool core
- MCP runtime
- storage
- templates
- desktop bindings
- app shells

This tracker is intentionally operational. It is not a vision doc. It is the step-by-step sequence we should use to rebuild the repo with trackable milestones.

## Working Rules

1. Do not move everything at once.
2. Keep the current app working while extracting packages.
3. Extract from the bottom up: schema first, app shells last.
4. Every phase must have a finish line.
5. Every extraction must reduce coupling, not just relocate files.
6. Every package must have an owner boundary and a public API.
7. If a package cannot stand on its own yet, do not extract it yet.

## Target End State

```text
beak-design/
  apps/
    web/
    desktop/
  packages/
    schema/
    editor-core/
    editor-react/
    ai-core/
    tool-core/
    mcp-runtime/
    storage-core/
    storage-lowdb/
    templates/
    export-core/
    platform-tauri/
    shared-ui/
    config/
  tooling/
    eslint-config/
    tsconfig/
    test-utils/
  docs/
```

### Package names

- `@beak-design/web`
- `@beak-design/desktop`
- `@beak-design/docs`
- `@beak-design/schema`
- `@beak-design/editor-core`
- `@beak-design/editor-react`
- `@beak-design/ai-core`
- `@beak-design/tool-core`
- `@beak-design/mcp-runtime`
- `@beak-design/storage-core`
- `@beak-design/storage-lowdb`
- `@beak-design/templates`
- `@beak-design/export-core`
- `@beak-design/platform-tauri`
- `@beak-design/shared-ui`
- `@beak-design/config`
- `@beak-design/eslint-config`
- `@beak-design/tsconfig`
- `@beak-design/test-utils`

## Phase 0: Freeze the current baseline

### Objective

Establish a stable reference point before extracting anything.

### Tasks

- [ ] Decide the package naming convention.
- [ ] Decide the workspace manager and package scope prefix.
- [ ] Snapshot current behavior with build, lint, and test output.
- [ ] Identify the current root-owned files that must move first.
- [ ] Mark experimental/stubbed subsystems explicitly in docs.

### Exit criteria

- The current app still builds.
- We have a written package map.
- We know which subsystems are stable and which are not.

## Phase 1: Workspace bootstrap

### Objective

Turn the repository into a real monorepo without changing behavior yet.

### Tasks

- [x] Add `pnpm-workspace.yaml`.
- [x] Create `apps/web` and `apps/desktop` directories.
- [x] Create empty package directories under `packages/`.
- [x] Add shared root scripts for package-level build/test/lint.
- [x] Add shared tsconfig and lint config packages or root equivalents.
- [x] Add temporary compatibility exports so the existing app still resolves imports.

### Exit criteria

- Workspace installs cleanly.
- Root app still runs.
- New package directories exist with basic config.

### Dependencies

- None. This is the first structural step.

### Current status

- Workspace directories created
- Package shell `package.json` files added
- Shared tsconfig package scaffold added
- Shared workspace scripts for build/test/lint are now in the root package
- Root and web lint configs now share the same tooling config package
- Compatibility shims are active for schema, shared UI utility, storage serialization, and viewport math
- Auth state is now package-owned under `storage-lowdb` with a compatibility bridge for the browser login flow
- Shared UI primitives and the mobile hook are now package-owned under `shared-ui` with root compatibility shims
- Tauri command and filesystem helpers are now package-owned under `platform-tauri` with root compatibility shims
- OS-aware path helpers are now package-owned under `platform-tauri` with root compatibility shims
- Template manager is now package-owned with a compatibility bridge for built-in content
- Built-in template content is now package-owned under `templates` with root compatibility shims
- The web app shell now has an independent buildable package under `apps/web` while the root route tree still acts as the compatibility host
- Agent config persistence is now package-owned with a compatibility bridge for the remaining AI runtime modules
- Chat policy helpers and SSE delta normalization are now package-owned under `ai-core`
- Agent capability summaries are now package-owned under `ai-core`
- Cloud, Ollama, and CLI agent adapters are now package-owned under `ai-core`
- ID generation is now package-owned under `schema`
- LowDB-backed document and user storage is now package-owned under `storage-lowdb`
- Client-side document API wrappers are now package-owned under `storage-lowdb`
- Metadata, workspace history, and project history storage are now package-owned under `storage-lowdb` with injected platform helpers
- Browser file-handle storage is now package-owned under `storage-lowdb`
- Storage migration helpers and recovery snapshot contracts are now package-owned under `storage-core` and `storage-lowdb`
- MCP tool contracts and registry are now package-owned under `tool-core`
- The full MCP tool registry now lives under `tool-core` with a root compatibility shim
- Read/write tool grouping and capability metadata now live in `tool-core`
- Batch design processing is now package-owned under `mcp-runtime` with a root shim preserving the existing dynamic import path
- Tool context creation and TanStack AI MCP adapters are now package-owned under `ai-core` with root shims preserving the route API
- Command bus logic now lives in `editor-core` with a root compatibility shim
- Canvas render shells and Konva-backed view primitives are now package-owned under `editor-react` with root compatibility shims
- Extracted package and app slices completed so far: `schema`, `shared-ui` primitives plus mobile hook plus utility, `storage-core` format, `storage-lowdb` document, user, metadata, and auth stores, `platform-tauri` command and filesystem helpers, `editor-core` viewport math, geometry helpers, selection helpers, interaction-state helpers, undo/redo manager, command bus, and document mutation helpers, `templates` manager plus built-in content, `ai-core` agent config plus transaction manager plus tool context plus MCP adapters plus chat policy plus stream normalization plus agent capabilities plus cloud/ollama/cli adapters, `tool-core` contracts/registry and registry implementation, `mcp-runtime` batch processor, and `apps/web` buildable shell package plus route/app composition mirror

### Validation log

- `pnpm exec vitest run packages/schema/src/schema.test.ts`
- `pnpm exec vitest run packages/shared-ui/src/utils.test.ts`
- `pnpm exec vitest run packages/storage-core/src/file-format.test.ts`
- `pnpm exec vitest run packages/editor-core/src/viewport.test.ts`
- `pnpm exec vitest run packages/schema/src/schema.test.ts packages/shared-ui/src/utils.test.ts packages/storage-core/src/file-format.test.ts packages/editor-core/src/viewport.test.ts`
- `pnpm --dir packages/schema test`
- `pnpm --dir packages/shared-ui test`
- `pnpm build`
- `pnpm --dir apps/web build`
- `pnpm --dir packages/storage-core test`
- `pnpm --dir packages/storage-lowdb test`
- `pnpm exec vitest run packages/storage-lowdb/src/document-db.test.ts packages/storage-lowdb/src/users-db.test.ts packages/storage-lowdb/src/metadata-store.test.ts`
- `pnpm exec vitest run packages/storage-lowdb/src/document-api.test.ts packages/storage-lowdb/src/file-handle-storage.test.ts`
- `pnpm exec vitest run packages/storage-core/src/migration.test.ts packages/storage-lowdb/src/recovery.test.ts`
- `pnpm --dir packages/platform-tauri test`
- `pnpm --dir packages/templates test`
- `pnpm --dir packages/editor-core test`
- `pnpm --dir packages/storage-lowdb test`
- `pnpm exec vitest run packages/editor-core/src/command-bus.test.ts packages/editor-core/src/geometry.test.ts packages/editor-core/src/selection.test.ts packages/editor-core/src/viewport.test.ts`
- `pnpm exec vitest run packages/editor-core/src/document-mutations.test.ts`
- `pnpm --dir packages/templates test`
- `pnpm --dir packages/ai-core test`
- `pnpm --dir packages/tool-core test`
- `pnpm exec vitest run packages/tool-core/src/tool-core.test.ts packages/tool-core/src/mcp-tools.test.ts`
- `pnpm --dir packages/mcp-runtime test`
- `pnpm exec vitest run packages/mcp-runtime/src/batch-design-processor.test.ts packages/tool-core/src/tool-core.test.ts`
- `pnpm exec vitest run packages/ai-core/src/tool-context-provider.test.ts packages/ai-core/src/mcp-tool-adapters.test.ts`
- `pnpm exec vitest run packages/ai-core/src/chat-policy.test.ts packages/ai-core/src/chat-stream.test.ts`
- `pnpm exec vitest run packages/ai-core/src/agent-capabilities.test.ts`
- `pnpm exec vitest run packages/ai-core/src/agent-adapters/agent-adapters.test.ts`
- `pnpm --dir packages/editor-react test`
- `pnpm build`
- `pnpm run build:workspace`
- `pnpm run lint:workspace`
- `pnpm --dir apps/web build`
- `pnpm --dir packages/storage-lowdb test`
- All listed tests passed

## Phase 2: Extract `schema`

### Objective

Move the document contract into a standalone package.

### Tasks

- [x] Move `src/lib/schema.ts` to `packages/schema`.
- [x] Move id helpers and domain-only types with it.
- [x] Ensure no React, storage, or Tauri imports remain in schema.
- [x] Export a stable `index.ts` API.
- [x] Add schema tests.

### Exit criteria

- `schema` can be imported from any future package.
- No UI package owns the source of truth for IDs or document types.

### Dependencies

- Phase 1

## Phase 3: Extract `shared-ui`

### Objective

Split reusable UI primitives away from application logic.

### Tasks

- [x] Move `src/components/ui/*` into `packages/shared-ui`.
- [x] Remove app-specific imports from the primitives.
- [x] Standardize exports.
- [x] Add a basic package test harness for shared UI utilities.

### Exit criteria

- App shell components can import UI primitives from a package.
- The UI package has no editor business logic.

### Dependencies

- Phase 1

## Phase 4: Extract `platform-tauri`

### Objective

Isolate desktop/native bindings from the rest of the app.

### Tasks

- [x] Move `src/lib/tauri.ts` into `packages/platform-tauri`.
- [x] Move `src/lib/utils/tauri-fs.ts` into the same package.
- [x] Keep the package runtime-specific and thin.
- [x] Add desktop-only tests or smoke checks where practical.

### Exit criteria

- Desktop wrappers are separated from editor logic.
- Non-desktop packages can avoid importing Tauri by default.
- The shared TypeScript AI runtime stays simple without a separate Tauri adapter package.

### Dependencies

- Phase 1

## Phase 5: Extract `templates`

### Objective

Make templates a reusable starter-kit package rather than app-local content.

### Tasks

- [x] Move `src/lib/templates/*` into `packages/templates`.
- [x] Complete placeholder templates during the move or mark them experimental.
- [x] Add template metadata, validation, and previews.
- [x] Ensure templates depend only on schema and shared utilities.

### Exit criteria

- Templates can be loaded independently of the app shell.
- Template completeness is explicit.

### Dependencies

- Phase 2

## Phase 6: Extract storage

### Objective

Separate storage contracts from storage implementations.

### Tasks

- [x] Create `packages/storage-core`.
- [x] Move storage serialization contracts out of app-local code.
- [x] Create `packages/storage-lowdb`.
- [x] Move lowdb/local persistence implementation there.
- [x] Add migration and recovery interfaces.

### Exit criteria

- Storage behavior is swappable by runtime.
- Editor core does not know LowDB details.

### Dependencies

- Phase 2

## Phase 7: Extract `tool-core`

### Objective

Make tools a reusable contract across chat, MCP, and future CLI surfaces.

### Tasks

- [x] Move `src/lib/mcp-tools.ts` into `packages/tool-core`.
- [x] Split read tools from mutating tools.
- [x] Add tool categories and capability metadata.
- [x] Make tool schemas explicit and reusable.

### Exit criteria

- Tool definitions are no longer coupled to the route handler.
- Tool policy can be reused by AI and MCP runtimes.

### Dependencies

- Phase 2
- Phase 6

## Phase 8: Extract `editor-core`

### Objective

Move the actual editing engine into a reusable package.

### Tasks

- [x] Move command bus logic into `packages/editor-core`.
- [x] Keep editor undo/redo in `packages/editor-core` and grouped AI/MCP transaction management in `packages/ai-core`.
- [x] Move selection logic into `packages/editor-core`.
- [x] Move viewport math and interaction-state logic into `packages/editor-core`.
- [x] Move undo/redo into `packages/editor-core`.
- [ ] Move component/token mutation rules into `packages/editor-core` if and when those command types are implemented.
- [x] Add unit tests for command and state transitions.

### Exit criteria

- Core document mutations can run without React.
- The editor engine can be reused by app, MCP, or CLI surfaces.

### Dependencies

- Phase 2
- Phase 6
- Phase 7

## Phase 9: Extract `editor-react`

### Objective

Turn canvas rendering and editor UI into a thin consumer of editor-core.

### Tasks

- [x] Move canvas rendering bindings into `packages/editor-react`.
- [x] Move Konva-specific view logic into the package.
- [x] Keep React components free of mutation rules.
- [x] Add render or integration tests for the package.

### Exit criteria

- Canvas UI is a client of editor-core.
- UI does not encode document semantics.

### Dependencies

- Phase 8

### Current status

- Canvas shell and render primitives are package-owned under `packages/editor-react`.
- Root imports remain stable through compatibility shims in `src/components/canvas/*`.
- The package currently owns `CanvasViewport`, `FloatingCanvasToolbar`, `KonvaStage`, `Grid`, `GuideLines`, `FrameRenderer`, `LayerRenderer`, `SelectionBox`, `TransformHandles`, `CreationPreview`, and `Ruler`.
- `editor-react` has package-level Vitest coverage for the exported shell surface plus a server-render smoke test for `Grid` and `FrameRenderer`.

## Phase 10: Extract `ai-core`

### Objective

Separate AI orchestration from the web route and UI.

### Tasks

- [x] Move agent adapters into `packages/ai-core`.
- [x] Add agent capability metadata.
- [x] Add prompt/context builder modules.
- [x] Add stream normalization and conversation execution logic.
- [ ] Remove direct route ownership of policy where possible.

### Exit criteria

- AI logic can run outside the app route.
- Chat UI becomes a consumer, not the owner, of agent behavior.

### Dependencies

- Phase 7
- Phase 8

## Phase 11: Extract `mcp-runtime`

### Objective

Make MCP a true runtime package and not a route-side convenience.

### Tasks

- [x] Create `packages/mcp-runtime`.
- [x] Reuse `tool-core` definitions.
- [ ] Reuse editor/storage contexts where needed.
- [ ] Add stdio transport first.
- [ ] Add optional HTTP/SSE transport if needed.
- [ ] Add session-scoped context creation.
- [x] Add MCP contract tests.

### Exit criteria

- External tools can connect without the app route being the host.
- MCP has a stable transport and tool contract.

### Dependencies

- Phase 7
- Phase 8
- Phase 10

## Phase 12: Move `apps/web`

### Objective

Convert the current root app into a real web app shell.

### Tasks

- [x] Move routes and app composition into `apps/web`.
- [ ] Keep only shell orchestration at the app layer.
- [ ] Update imports to consume package APIs.
- [ ] Remove direct dependence on moved internals.

### Exit criteria

- The web app runs from `apps/web`.
- Business logic lives in packages, not routes.

### Dependencies

- Phase 3 through Phase 11, as applicable

## Phase 13: Move `apps/desktop`

### Objective

Make the desktop runtime its own shell around shared packages.

### Tasks

- [ ] Move `src-tauri` into `apps/desktop`.
- [ ] Update native bindings to use shared package APIs.
- [ ] Keep desktop-specific code isolated.

### Exit criteria

- Desktop is a wrapper around the same core packages.
- Native bindings are not mixed into app logic.

### Dependencies

- Phase 4
- Phase 6
- Phase 10

## Phase 14: Tighten boundaries

### Objective

Make the monorepo maintainable after extraction.

### Tasks

- [ ] Add boundary lint rules.
- [ ] Add package-level test and build scripts.
- [ ] Remove temporary compatibility exports.
- [ ] Reduce deep imports across packages.
- [ ] Document allowed dependency directions.

### Exit criteria

- Package boundaries are enforced.
- Reintroducing coupling becomes hard.

### Dependencies

- Phases 1 through 13

## Trackable Milestones

## Milestone A: Workspace live

- [ ] Workspace installs
- [x] Package shells exist
- [x] Root app still runs

## Milestone B: Contracts extracted

- [x] `schema`
- [x] `shared-ui`
- [x] `platform-tauri`

## Milestone C: Core runtime extracted

- [x] `templates`
- [x] `storage-core`
- [x] `storage-lowdb`
- [x] `tool-core`
- [x] `editor-core`

## Milestone D: App consumers extracted

- [x] `editor-react`
- [x] `ai-core`
- [x] `mcp-runtime`

## Milestone E: App shells split

- [x] `apps/web`
- [ ] `apps/desktop`

## Milestone F: Boundaries enforced

- [ ] dependency rules
- [ ] package tests
- [ ] package builds
- [ ] no accidental cross-layer imports

## Suggested Execution Order

If we want the shortest safe path, do this in order:

1. Bootstrap the workspace.
2. Extract `schema`.
3. Extract `shared-ui`.
4. Extract `platform-tauri`.
5. Extract `templates`.
6. Extract storage contracts and LowDB implementation.
7. Extract tool-core.
8. Extract editor-core.
9. Extract editor-react.
10. Extract ai-core.
11. Extract mcp-runtime.
12. Move `apps/web`.
13. Move `apps/desktop`.
14. Enforce boundaries and remove compatibility shims.

## What We Should Not Do

- do not extract packages before their APIs are clear
- do not split into too many tiny packages on day one
- do not move app routes before core logic is reusable
- do not let AI or MCP remain route-owned after the core packages exist
- do not treat the monorepo as cosmetic reorganization

## Tracking Rule

Before starting each phase, record:

- files moved
- imports updated
- tests added
- tests passing
- residual coupling left behind

That makes the migration measurable instead of vague.
