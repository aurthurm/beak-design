# Beak Design Enhancement Plan

## Purpose

This document proposes a detailed enhancement plan for `beak-design` based on:

- direct study of the current repository implementation
- comparison with the reference projects in `references/`
- the architecture intent already documented in `docs/`

The goal is not to make `beak-design` look like the references. The goal is to identify the implementation patterns that are working well elsewhere, then adapt them to the product Beak Design is actually trying to become: a canvas-first, AI-assisted design environment with local and cloud agents, MCP tooling, durable storage, and a viable desktop runtime.

## References Studied

### Primary references

- `references/open-pencil`
  - strongest reference for design-editor architecture, tool registry design, MCP server surface, CLI surface, editor/core separation, and programmable document workflows
- `references/openpencil`
  - strongest reference for AI-native orchestration, multi-agent positioning, CLI/MCP packaging, and design-as-code product framing
- `references/onlook`
  - strongest reference for AI package boundaries, code/tool separation, toolset curation, and multi-package scaling
- `references/ui-tools`
  - useful reference for focused utility-product UX, smaller persistent state patterns, and lightweight tool experience

### Why these matter

- `open-pencil` shows how a design editor matures beyond a single web app into `core`, `mcp`, `cli`, and app-specific shells.
- `openpencil` shows how AI capabilities become product-defining only after packaging, orchestration, and export surfaces are treated as first-class.
- `onlook` shows how AI and parser concerns should be split into dedicated packages rather than mixed into UI routes and component state.
- `ui-tools` shows how small, stable feature modules are easier to polish, test, and persist than a single broad store with many responsibilities.

## Executive Summary

`beak-design` is currently a promising prototype with good direction but weak execution alignment. The architecture docs describe a richer platform than the codebase presently implements.

The biggest improvement opportunity is to move from:

- one app with broad responsibilities
- partially implemented architecture boundaries
- stubbed collaboration and template systems
- minimal test coverage
- AI tooling that exists but is not yet production-shaped

to:

- a layered editor platform with explicit package boundaries
- a smaller, hardened mutation core
- a real MCP + CLI surface
- stronger persistence and recovery behavior
- better canvas/editor ergonomics
- a narrower but more reliable AI workflow
- test coverage that enforces the intended architecture

The plan below recommends a four-track program:

1. Stabilize the current app and remove architecture drift.
2. Extract a reusable editor core and MCP/runtime boundary.
3. Expand the document, canvas, and AI tool model in a controlled way.
4. Add serious product surfaces: CLI, collaboration, templates, export, and quality gates.

## Current State Assessment

## 1. Architecture intent is ahead of implementation

The docs describe a layered system with strong separation between UI, store, command bus, MCP tools, storage, Tauri, and templates. In practice, the codebase still behaves like a single application with loosely enforced boundaries.

Examples:

- `docs/00-architecture-overview.md` describes a modular platform, but the repository is still a single app package.
- The docs mention `mcp-tools.ts` at repo root, while the implementation lives at `src/lib/mcp-tools.ts`.
- `src/routes/api/ai/chat.ts` assembles tools, prompt construction, adapter choice, streaming, and context resolution in one route instead of delegating more aggressively.
- `src/lib/ai/tool-context-provider.ts` directly bridges storage, editor runtime, and canvas state in a way that is still too application-specific.

### Recommendation

Treat the current codebase as “Phase 0 platform bootstrap”, not as a finished architecture. The first enhancement program should explicitly reconcile docs and implementation rather than continuing to add features on top of drift.

## 2. The command and tool model is only partially complete

The command system is the right direction, but it is not yet comprehensive enough to be the reliable mutation backbone the docs claim it is.

Observed gaps:

- `src/lib/mcp-tools.ts` declares command types for `component.create` and `component.instantiate`, but `src/lib/ai/command-bus.ts` does not implement them.
- The batch processor in `src/lib/mcp/batch-design-processor.ts` only supports a limited operation subset and does not yet provide the fuller semantics described in the documentation.
- The processor comment says rollback “would happen via transaction manager”, but the actual failure model is still thin.
- Several canvas shortcuts are explicitly stubbed in `src/lib/canvas/hooks/useKeyboardShortcuts.ts`.

### Reference pattern

`references/open-pencil/packages/core/src/tools/registry.ts` separates:

- core tools used in most sessions
- extended tools used less often
- a single combined registry used by MCP and other surfaces

This is a materially better pattern than one flat, evolving tool bag.

### Recommendation

Promote the mutation model from “good prototype idea” to “hard contract”:

- define a core command set that is fully implemented and tested
- define advanced commands separately
- make every tool map to those commands, never to ad hoc document mutations
- add transaction semantics that are real, not aspirational

## 3. Canvas/editor depth is still shallow compared with the product ambition

Beak Design already has a substantial canvas shell:

- `src/components/canvas/*`
- `src/lib/canvas/store.ts`
- Konva stage, rulers, guides, selection UI, transform handles

But it is not yet a deeply capable editor runtime.

Observed gaps:

- keyboard workflows are incomplete
- grouping/component flows are limited
- templates are inconsistent in maturity
- collaboration support exists only as Yjs stubs
- variable/token workflows are present but not yet a strong system
- canvas state is broad and centralized, which will become harder to evolve safely

### Reference pattern

`references/open-pencil/packages/core/src/editor/*` is important because it splits editing concerns by domain:

- pages
- selection
- viewport
- nodes
- shapes
- text
- variables
- undo

This is preferable to growing a single general-purpose store file indefinitely.

### Recommendation

Refactor the editor into smaller domain modules that own specific mutation and query responsibilities, while keeping the store as a state holder rather than the place where all behavior accumulates.

## 4. AI integration is functional but not yet product-grade

What is working:

- multiple agent types are supported conceptually
- the API streams SSE
- tool call/result events are surfaced
- adapters exist for cloud, Ollama, CLI, and MCP

What is missing:

- stronger context shaping
- toolset curation by mode or task
- a more structured distinction between read-only and mutating interactions
- better failure reporting and retries
- better conversation persistence
- better visibility into tool execution quality

### Reference patterns

`references/onlook/packages/ai/src/tools/toolset.ts` separates read-only from edit-capable toolsets.

`references/onlook/packages/ai/src/index.ts` and neighboring packages show a cleaner AI package boundary:

- agents
- apply
- chat
- contexts
- prompt
- stream
- tools

This is a better long-term shape than keeping most orchestration inside a route and a hook.

### Recommendation

Split Beak Design AI into explicit modules:

- conversation domain
- prompt/context construction
- toolset selection
- adapter lifecycle
- execution telemetry
- result application

## 5. Product surfaces are too narrow compared with the strongest references

The references consistently provide multiple surfaces over the same core:

- editor app
- CLI
- MCP server
- export pipeline
- docs
- in some cases SDK or embedded/editor runtime options

Beak Design currently has:

- a web app
- a Tauri shell
- internal MCP-style tools

It does not yet have:

- a proper standalone MCP server package
- a CLI for inspecting/modifying documents
- a documented headless automation path
- stronger export/codegen surfaces

### Reference patterns

- `references/open-pencil/packages/mcp/src/server.ts`
- `references/open-pencil/packages/cli/src/index.ts`
- `references/open-pencil/packages/cli/src/commands/*`
- `references/openpencil/package.json` packaging of desktop + CLI + MCP

### Recommendation

Build Beak Design as a multi-surface product, not just a UI app with hidden internals.

## 6. Quality gates are currently too weak

Current verification results:

- `pnpm build` succeeds
- `pnpm lint src` fails with a large number of issues
- `pnpm test` is currently mis-scoped and runs tests from `references/`, producing a noisy failure set unrelated to the app itself

This is not just a tooling annoyance. It means the repository does not yet enforce the quality boundary of the actual product code.

### Major issues discovered

- Test discovery is too broad and includes `references/**`.
- Lint debt is significant.
- Only a very small local test surface exists under `src/lib/ai/__tests__`.
- There are no meaningful contract tests for MCP tools, command bus flows, or canvas mutations.

### Recommendation

Treat repository hygiene as a first-class workstream:

- restrict tests and linting to owned code
- add package-level and feature-level test boundaries
- make architectural rules testable

## 7. Some subsystems are still placeholders

Examples:

- `src/lib/templates/content/halo.ts` contains a TODO placeholder
- `src/lib/templates/content/nitro.ts` contains a TODO placeholder
- `src/lib/yjs/*` is stubbed and not integrated
- some UI copy still reflects “Cloud Anthropic only for now”

These are useful prototypes, but they should not remain ambiguous. Each should be either:

- finished
- isolated behind experimental flags
- or removed until ready

## Reference Comparison Matrix

| Capability | beak-design today | open-pencil | openpencil | onlook | Implication |
| --- | --- | --- | --- | --- | --- |
| Editor core extraction | Low | High | Medium | Low | Beak should extract `core`-like editor modules |
| MCP packaging | Internal only | High | High | Medium | Beak should create standalone MCP runtime |
| CLI surface | None | High | High | Medium | Beak needs headless document operations |
| AI package boundaries | Medium-low | Medium | Medium-high | High | Beak should split AI orchestration by module |
| Tool registry maturity | Medium | High | Medium-high | High | Beak should adopt curated toolsets |
| Collaboration | Stubbed | High | Medium | Medium | Beak should either implement or defer cleanly |
| Templates/design systems | Medium-low | Medium | Medium | Low | Beak should deepen templates into usable starter kits |
| Testing discipline | Low | High | Medium | High | Beak must add proper unit/integration/e2e scopes |
| Multi-surface product design | Low | High | High | High | Beak should evolve beyond one app entrypoint |

## Target Architecture

## Recommended repository shape

Move toward a workspace structure over time:

```text
beak-design/
  apps/
    web/
    desktop/
  packages/
    editor-core/
    editor-react/
    ai/
    mcp/
    cli/
    storage/
    schema/
    export/
    templates/
  docs/
```

This does not need to happen all at once. The important part is the destination:

- `schema` owns the document contract
- `editor-core` owns mutations, selection, viewport, and command logic
- `editor-react` owns React/Konva bindings
- `ai` owns adapters, prompts, tools, and conversation execution
- `mcp` owns externalized tool serving
- `cli` owns headless workflows
- `storage` owns persistence adapters and migrations
- `templates` owns starter kits and token packs

## Recommended runtime boundaries

### UI layer

Owns:

- routing
- panel layout
- inspector, canvas shell, chat shell
- view-specific state

Must not own:

- business rules for document mutations
- low-level storage mutation logic
- tool orchestration logic

### Editor core

Owns:

- document graph queries
- command execution
- transactions
- undo/redo
- selection math
- snapping rules
- grouping/component rules

### AI layer

Owns:

- provider adapters
- prompt assembly
- toolset policy
- streaming normalization
- conversation state persistence
- telemetry

### Tool layer

Owns:

- MCP definitions
- validation
- command mapping
- read vs mutate tool segregation

### Runtime/storage layer

Owns:

- browser persistence
- Tauri filesystem persistence
- project metadata
- version migration
- recovery/autosave/checkpoints

## Detailed Workstreams

## Workstream A: Platform stabilization

### Objectives

- stop architecture drift
- reduce repo noise
- make local verification meaningful

### Tasks

1. Fix test discovery.
   - Update Vitest config so tests only run against `src/**` and other owned packages.
   - Exclude `references/**` completely.
   - Add separate opt-in scripts if reference repos ever need to be explored through tests.

2. Fix lint debt.
   - Run staged autofixes.
   - Tackle high-volume rules first:
     - `import/order`
     - `sort-imports`
     - `@typescript-eslint/array-type`
     - `@typescript-eslint/no-unnecessary-condition`
   - Add a short-lived lint debt tracker if full cleanup cannot land in one PR.

3. Align docs with code.
   - Correct inaccurate file references.
   - Mark aspirational sections explicitly as roadmap where needed.
   - Add “implemented vs planned” markers in docs.

4. Remove or flag unfinished systems.
   - Mark Yjs as experimental or remove dead-path references until collaboration is real.
   - Do the same for incomplete template packs.

### Acceptance criteria

- `pnpm test` only runs Beak Design tests
- `pnpm lint` is actionable and bounded
- docs no longer describe functionality that is absent without clearly saying so

## Workstream B: Editor-core extraction

### Objectives

- make the command bus credible
- shrink UI/business-logic coupling
- create reusable editor logic for future CLI/MCP surfaces

### Tasks

1. Split `src/lib/canvas/store.ts`.
   - Extract modules for:
     - document
     - selection
     - viewport
     - interaction
     - guides/snap
     - save status

2. Harden the command bus.
   - Implement missing declared commands:
     - `component.create`
     - `component.instantiate`
   - Audit all command types for actual usage.
   - Make command results richer where useful:
     - changed ids
     - transaction id
     - warnings

3. Improve transaction support.
   - Ensure `batch_design` actually runs inside explicit transactions.
   - Add rollback tests.
   - Add failure reporting that includes the failed operation and state safety guarantees.

4. Extract query helpers.
   - Add selectors for:
     - active page
     - frame tree
     - selection ancestry
     - token resolution
     - component dependency lookup

5. Introduce editor-core tests.
   - command unit tests
   - transaction tests
   - selection/viewport logic tests
   - schema mutation invariants

### Reference inspiration

- `references/open-pencil/packages/core/src/editor/*`
- `references/open-pencil/packages/core/src/tools/registry.ts`

### Acceptance criteria

- document mutations are testable without React
- canvas UI can consume editor-core rather than encode logic itself
- batch operations are atomic

## Workstream C: Tooling and MCP maturity

### Objectives

- turn internal tools into a durable external interface
- support agents more reliably
- create a viable headless automation story

### Tasks

1. Split tool definitions into:
   - read-only tools
   - mutation tools
   - admin/export tools

2. Add a standalone MCP package.
   - move serving concerns out of app routes
   - support stdio first
   - add HTTP transport second if needed

3. Improve tool schemas.
   - move from ad hoc JSON-shape definitions to stronger schema validation
   - return structured errors consistently

4. Expand the toolset deliberately.
   - document tree queries
   - token analysis
   - component extraction/instantiation
   - selection operations
   - export and snapshot tools

5. Add MCP contract tests.
   - tool listing
   - input validation
   - deterministic mutation results
   - failure and rollback behavior

### Reference inspiration

- `references/open-pencil/packages/mcp/src/server.ts`
- `references/open-pencil/packages/cli/src/index.ts`

### Acceptance criteria

- Beak Design can be driven by an external MCP client without depending on app internals
- tools have explicit read vs write boundaries
- MCP errors are structured and debuggable

## Workstream D: AI system hardening

### Objectives

- make the AI assistant predictable
- reduce prompt/route coupling
- improve task reliability

### Tasks

1. Restructure the AI layer.
   - create modules for:
     - `prompt`
     - `contexts`
     - `stream`
     - `tool-policy`
     - `conversations`
     - `telemetry`

2. Curate toolsets by mode.
   - “Ask” mode: read-only
   - “Edit” mode: mutating tools allowed
   - “Advanced” mode: full tool surface for expert use

3. Improve prompt construction.
   - richer document summaries
   - stronger selection summaries
   - explicit mutation policy
   - context window budgeting

4. Persist conversation state properly.
   - recover tabs across sessions
   - persist tool traces
   - store selected agent and model per conversation

5. Improve failure handling.
   - provider health indicators
   - retryable vs fatal errors
   - explicit timeouts
   - user-facing guidance when local agents are unavailable

6. Add evaluation harnesses.
   - prompt/task fixtures
   - tool usage correctness checks
   - regression suite for key prompts

### Reference inspiration

- `references/onlook/packages/ai/src/*`
- `references/onlook/packages/ai/src/tools/toolset.ts`
- `references/openpencil` multi-model positioning

### Acceptance criteria

- AI behavior varies by mode in a controlled way
- route handlers become orchestration thin shells
- key prompts can be regression-tested

## Workstream E: Canvas and editor UX depth

### Objectives

- turn the prototype canvas into a compelling editor
- improve direct manipulation quality
- reduce friction for repeated design tasks

### Tasks

1. Finish keyboard command coverage.
   - delete
   - copy/cut/paste
   - select all
   - group/ungroup
   - nudge/move
   - zoom to fit/selection

2. Improve snapping and guides.
   - layer-to-layer snapping
   - frame bounds snapping
   - spacing distribution guides
   - toggleable snap policies

3. Strengthen component workflows.
   - extract selection to component
   - instantiate component
   - edit component source vs instance override
   - show component boundaries in inspector

4. Improve inspector capabilities.
   - token binding controls
   - layer hierarchy controls
   - multi-select editing
   - better text, fill, stroke, spacing controls

5. Add asset and export UX.
   - asset manager
   - frame export presets
   - copy as PNG/SVG if supported
   - screenshot or preview generation

6. Add recovery UX.
   - crash recovery
   - unsaved changes recovery
   - recent projects
   - version checkpoints

### Reference inspiration

- `references/open-pencil/packages/core/src/editor/*`
- `references/open-pencil/packages/core/src/renderer/*`
- `references/onlook` visual editing UX principles

### Acceptance criteria

- primary canvas workflows can be completed without hidden/manual workarounds
- keyboard and direct-manipulation behavior feel coherent
- component and token workflows are usable, not conceptual

## Workstream F: Templates and design systems

### Objectives

- convert templates from demo content into real accelerators
- make design systems usable by both humans and agents

### Tasks

1. Finish incomplete templates.
   - implement `Halo`
   - implement `Nitro`
   - deepen `Lunaris` and `Shadcn` consistency

2. Define a template contract.
   - tokens required
   - sample pages required
   - component coverage required
   - preview metadata required

3. Add template validation.
   - ensure all referenced tokens exist
   - ensure component samples render
   - ensure empty template placeholders cannot ship silently

4. Add AI-ready template metadata.
   - semantic descriptions
   - style tags
   - recommended use cases
   - constraints for agents

### Acceptance criteria

- each template is usable as a credible starter kit
- templates are machine-describable and human-browsable

## Workstream G: Persistence, workspaces, and collaboration

### Objectives

- make the storage layer trustworthy
- support real project lifecycle
- either implement collaboration or clearly defer it

### Tasks

1. Formalize project storage.
   - workspace abstraction
   - project metadata index
   - recent/open history
   - file format versioning

2. Add migration support.
   - schema version upgrade path
   - file format compatibility checks
   - recovery on load failure

3. Improve autosave/checkpointing.
   - debounce strategy
   - dirty state tracking
   - local recovery snapshots
   - restore-from-checkpoint UX

4. Decide on collaboration.
   - if collaboration is near-term, finish the Yjs integration with a real provider and sync strategy
   - if collaboration is not near-term, isolate the stubs behind an experimental boundary and remove roadmap ambiguity

### Reference inspiration

- `references/open-pencil` collaboration maturity
- `references/openpencil` design-as-code and file-based positioning

### Acceptance criteria

- storage behavior is deterministic and versioned
- users can recover work after interruptions
- collaboration status is explicit and technically honest

## Workstream H: Tauri and desktop runtime

### Objectives

- make desktop a first-class runtime, not just a wrapper
- improve local agent integration
- improve process safety

### Tasks

1. Split `src-tauri/src/main.rs`.
   - group commands by domain:
     - filesystem
     - dialogs
     - process/agents
     - metadata/workspaces

2. Improve local runtime capabilities.
   - better CLI discovery and versioning
   - stronger MCP process lifecycle handling
   - log capture and diagnostics
   - health checks for local agents

3. Improve security posture.
   - validate command execution boundaries
   - reduce ambient access where possible
   - make agent process permissions clearer

4. Add desktop integration features.
   - open recent
   - file association and recovery
   - better status and diagnostics panel

### Acceptance criteria

- desktop-specific behavior is observable and reliable
- local agent issues are diagnosable without guessing

## Workstream I: CLI and headless workflows

### Objectives

- let users and agents operate on documents without the UI
- make Beak Design scriptable

### Proposed CLI commands

- `beak tree file.beaki`
- `beak info file.beaki`
- `beak node file.beaki --id ...`
- `beak export file.beaki --frame ...`
- `beak tokens file.beaki`
- `beak lint file.beaki`
- `beak mcp`

### Why this matters

- easier debugging
- automation support
- CI workflows
- better AI integration
- easier future editor embedding

### Reference inspiration

- `references/open-pencil/packages/cli/src/commands/*`
- `references/openpencil` CLI product framing

### Acceptance criteria

- basic document introspection works without launching the app
- CLI shares the same schema and mutation engine as the app

## Workstream J: Documentation and developer experience

### Objectives

- make the architecture teachable
- reduce onboarding cost
- support contributors without tribal knowledge

### Tasks

1. Rewrite docs around implemented surfaces.
2. Add an architecture map for package boundaries.
3. Add sequence diagrams for:
   - AI request flow
   - command execution
   - autosave and recovery
   - MCP external call flow
4. Add contributor guides for:
   - adding a command
   - adding a tool
   - adding a template
   - adding an agent adapter
5. Add “decision records” for major architecture choices.

### Acceptance criteria

- a new contributor can add a command or tool without reverse-engineering the app
- docs state what is real, what is experimental, and what is planned

## Phased Delivery Plan

## Phase 1: Stabilize and de-risk

Duration: 1 to 2 weeks

### Deliverables

- fix test scope
- reduce lint errors materially
- align docs with reality
- mark experimental/stubbed systems clearly
- define target package map

### Success signal

The repo becomes trustworthy enough that further work is not built on noise.

## Phase 2: Extract editor-core and harden commands

Duration: 2 to 4 weeks

### Deliverables

- smaller editor domain modules
- complete command bus for declared commands
- real transaction safety
- batch processor improvements
- command and tool contract tests

### Success signal

Document mutation logic becomes reusable and testable outside the UI.

## Phase 3: Harden AI and MCP surfaces

Duration: 2 to 4 weeks

### Deliverables

- AI package split
- read/edit toolset modes
- standalone MCP package
- improved prompt/context layer
- better streaming and error semantics

### Success signal

External agents and internal chat both operate on a stable tool contract.

## Phase 4: Deepen product features

Duration: 4 to 8 weeks

### Deliverables

- improved canvas workflows
- component system maturity
- complete template packs
- export and asset improvements
- desktop quality improvements
- CLI introduction

### Success signal

Beak Design becomes meaningfully more usable as a design tool, not just a technical demo.

## Phase 5: Collaboration and advanced workflows

Duration: optional, after stabilization

### Deliverables

- real collaboration, if prioritized
- checkpoint/versioning flows
- richer automation and scriptability
- broader packaging and distribution

### Success signal

The product expands from single-user editing into team and automation workflows.

## Recommended Priorities

## Highest priority

- fix quality gates
- reconcile docs and implementation
- harden the command bus
- split editor logic from UI
- improve toolset discipline

## Second priority

- standalone MCP package
- conversation persistence
- keyboard and canvas workflow completion
- template completion

## Third priority

- CLI
- collaboration
- advanced export/codegen
- deeper desktop packaging

## Risks and Mitigations

## Risk: Over-refactoring too early

If package extraction happens before behavior is stabilized, the team may spend time moving code instead of improving it.

### Mitigation

Do extraction in waves:

- first stabilize boundaries inside the existing app
- then move modules into packages once the seams are proven

## Risk: AI complexity grows faster than editor correctness

It is easy to add more agents and tools before the document engine is stable enough to support them safely.

### Mitigation

Make command correctness the gating dependency for tool expansion.

## Risk: Collaboration remains half-built

Yjs stubs are easy to leave in place indefinitely, creating false expectations.

### Mitigation

Either schedule collaboration properly or move it behind a clearly experimental boundary.

## Risk: Reference projects create scope inflation

The references are much larger and more mature in some areas. Blind copying would slow Beak Design down.

### Mitigation

Adopt patterns, not product scope:

- package boundaries
- tool registry design
- CLI/MCP surfacing
- testing discipline

Avoid importing every feature area.

## Definition of “Improved”

Beak Design should be considered materially improved when all of the following are true:

- its docs describe the real system accurately
- tests and lint operate only on owned code
- document mutations are fully mediated by a tested command layer
- AI tools are curated, validated, and mode-aware
- external MCP access exists through a proper server surface
- templates are complete enough to use, not just demo placeholders
- desktop and storage behavior are reliable
- the project can grow without central files becoming the bottleneck

## Concrete Next Actions

1. Create a `Phase 1` milestone focused only on stabilization.
2. Fix Vitest and lint scope before adding new features.
3. Audit `src/lib/mcp-tools.ts` against `src/lib/ai/command-bus.ts` and remove or implement all drift.
4. Split `src/lib/canvas/store.ts` and `src/routes/api/ai/chat.ts` into smaller modules.
5. Design the future workspace layout and move the schema plus command/core logic first.
6. Build a standalone MCP package once the command layer is trustworthy.

## Closing Position

The current project has the right idea but not yet the right shape. The strongest lesson from the references is not “add more features”. It is “build fewer things more cleanly, then expose them through multiple surfaces”.

For Beak Design, that means:

- a harder editor core
- a cleaner AI layer
- a real external tool surface
- stronger quality gates
- and a deliberate path from prototype to platform

## Addendum: Second-Pass Reference Analysis

This addendum captures findings from the references that were skipped in the first pass and only analyzed later:

- `references/pencil-dev`
- `references/DesignCode`
- `references/aurora`
- `references/pencilplaybook`
- `references/penpot`

These references do not overturn the main plan, but they do sharpen several recommendations and add a few important new workstreams.

## A. `pencil-dev`: closest tactical reference for Beak Design

This is the most directly applicable of the second-pass references.

### High-value findings

1. Interaction is modeled as explicit states.
   - `references/pencil-dev/pencil-editor/src/managers/state-manager.ts`
   - separate classes for idle, moving, resizing, drawing, text editing, marquee selection, rotating, and hand mode

2. Selection is a real subsystem, not just a list of ids.
   - `references/pencil-dev/pencil-editor/src/managers/selection-manager.ts`
   - handles clipboard, hover, double-click behavior, paste positioning, and import-aware paste flows

3. Tool handlers are richer and more user-readable.
   - `references/pencil-dev/pencil-editor/src/tool-handlers/get-editor-state.ts`
   - returns current file, selected nodes, top-level visible nodes, and reusable components

4. `batch_design` has stronger failure semantics.
   - `references/pencil-dev/pencil-editor/src/tool-handlers/batch-design.ts`
   - uses update blocks, validation, and explicit rollback on failure

5. Desktop behavior is treated as product logic.
   - `references/pencil-dev/app.js`
   - recent files, dirty close handling, launch-time restore, and runtime agent invocation

### What Beak Design should borrow

- move interaction logic into a proper state machine
- split selection and clipboard into a dedicated subsystem
- make `get_editor_state` more informative
- upgrade `batch_design` from “best effort” to “transactional”
- add desktop recent-file and dirty-close quality-of-life flows

### Effect on the plan

This raises the priority of:

- interaction-state manager
- selection manager
- rollback-capable batch processing
- desktop runtime polish

## B. `DesignCode`: workbench productization and prompt bundles

`DesignCode` is not a direct canvas-engine reference, but it is a strong product-shell reference.

### High-value findings

1. Prompt generation is deterministic and configuration-driven.
   - `references/DesignCode/app/shared/prompt-engine.js`
   - combines style preset, size preset, field definitions, brief, and selected assets into a coherent prompt bundle

2. Workspace and session artifacts are first-class.
   - `references/DesignCode/app/server/design-sessions.js`
   - tracks project ids, design metadata, chat history, asset manifests, runtime backend choice, and naming conventions

3. The UI treats workspace state as a real operating surface.
   - `references/DesignCode/src/composables/useWorkspaceState.js`
   - centralizes workspace, agent, design history, assets, inspect, and save state

4. Desktop packaging is serious and backend-aware.
   - built-in preparation for Codex, Claude, Gemini, and OpenCode
   - updater support
   - Tauri runtime commands split by backend

### What Beak Design should borrow

- prompt bundles rather than ad hoc prompt assembly
- stronger project/session metadata
- visible version history
- asset-library and selected-asset manifest concepts
- backend-specific desktop preparation and diagnostics

### Effect on the plan

This adds a new emphasis:

- Beak needs a “workspace/session/version” workstream, not just a document-storage workstream
- Beak should treat AI context assembly as product logic

## C. `aurora`: brief-first flow as an optional mode

`aurora` is small, but the product lesson is useful precisely because it is small.

### High-value findings

1. It separates analysis from visual generation.
   - `references/aurora/server/server.js`
   - first produce a design brief, then produce a visual concept

2. It persists lightweight project history cleanly.
   - `references/aurora/client/src/store.js`
   - simple save/load/delete flows

3. It makes rationale visible.
   - the user receives design reasoning, not just output

### What Beak Design should borrow

- a strategy-first or brief-first mode for greenfield tasks
- optional design rationale before canvas generation
- simple persistence for “briefs” as artifacts

### Effect on the plan

This adds a new recommendation:

- create a non-mandatory “Design Brief” mode in chat for larger generation tasks

## D. `pencilplaybook`: operational discipline for AI-assisted design

This reference is not a product repo in the normal sense. It is a skill/playbook. That is exactly why it matters.

### High-value findings

1. It forces session startup discipline.
   - inspect state
   - open the target file
   - load guidelines
   - inject variables
   - verify layout

2. It encodes scaffold archetypes.
   - dashboard
   - list
   - detail
   - marketing page
   - modal
   - wizard
   - mobile screen
   - form
   - empty state

3. It encodes design heuristics as operational rules, not vague taste.

4. It improves agent performance by reducing ambiguity rather than by changing models.

### What Beak Design should borrow

- create a Beak-specific playbook layer
- standardize agent startup flows
- define scaffold archetypes for common screen classes
- encode spacing, typography, contrast, and layout-density heuristics

### Effect on the plan

This adds a major new workstream:

- AI playbook and scaffold system

This is likely more valuable in the short term than adding more providers or more tools.

## E. `penpot`: plugin architecture and standards-based extensibility

`penpot` is much larger than Beak Design, but it contributes two important long-term architecture lessons.

### High-value findings

1. Plugins are a separate extension surface.
   - `references/penpot/plugins/README.md`
   - plugin runtime, plugin styles, sample plugin apps

2. MCP is bridged through a plugin/runtime architecture.
   - `references/penpot/mcp/README.md`
   - the MCP server communicates through a plugin bridge and WebSocket connection

3. Standards-based positioning is central.
   - open formats
   - inspect mode
   - design tokens
   - code collaboration

### What Beak Design should borrow

- keep MCP and plugin extensibility conceptually separate
- design for a future plugin API even if it is not built yet
- strengthen inspect/export/token-first stories

### Effect on the plan

This adds a long-term workstream:

- future plugin architecture

This should not be a near-term build priority, but it should influence how internal APIs are shaped now.

## New and updated recommendations after the second pass

## 1. Add an AI playbook layer

Beak Design should not rely on generic system prompts plus raw tools.

It should add:

- startup checklist for agents
- canvas archaeology flow before nontrivial edits
- scaffold archetypes
- token initialization rules
- product-specific design heuristics

## 2. Add a strategy-first mode for greenfield generation

For large generation tasks:

1. create a design brief
2. confirm direction with the user
3. pick template/style/asset context
4. generate on canvas

This should be optional, not required for all editing.

## 3. Raise the priority of interaction-state and selection work

This should move up in the roadmap because `pencil-dev` demonstrates how much editor quality depends on it.

## 4. Plan for plugins separately from MCP

Do not let MCP become the only extension model. Even if plugins come later, preserve the possibility now.

## New workstreams added to the roadmap

## Workstream K: AI Playbook and Scaffold System

### Objectives

- reduce generic AI behavior
- make generated layouts more repeatable
- improve reliability on large creation tasks

### Tasks

1. Define Beak session startup recipes.
2. Add scaffold archetypes for core screen families.
3. Encode design heuristics into reusable prompt assets.
4. Add “canvas archaeology” as a standard pre-edit step.
5. Add token/bootstrap initialization for AI sessions where relevant.

### Reference inspiration

- `references/pencilplaybook`
- `references/DesignCode/app/shared/prompt-engine.js`

## Workstream L: Strategy-First Design Brief Mode

### Objectives

- improve AI generation quality
- make rationale visible before mutation

### Tasks

1. Add a brief-generation mode in chat.
2. Return structured design direction before generation.
3. Let the user accept, revise, or skip the brief.
4. Persist the brief with the project/conversation.

### Reference inspiration

- `references/aurora`
- `references/DesignCode`

## Workstream M: Future Plugin Architecture

### Objectives

- prepare for user-extensible in-product functionality
- avoid overloading MCP as the only extension surface

### Tasks

1. Define plugin capability boundaries.
2. Identify a minimal future plugin API:
   - document read
   - selection read
   - command dispatch
   - panel registration
3. Keep the interface internal until the product is ready for external plugins.

### Reference inspiration

- `references/penpot/plugins`
- `references/penpot/mcp`

## Priority changes after the second pass

### Priority raised

- interaction-state manager
- selection/clipboard subsystem
- AI playbook/scaffold system
- prompt-bundle construction
- workspace/session/version metadata

### Still intentionally lower priority

- full plugin ecosystem
- complex bridge-based multi-user runtimes

These should influence design decisions now, but they do not need to be built immediately.

## MCP and Agent Architecture Update

This section refines the original plan based on the MCP and agent handling patterns seen in:

- `references/open-pencil`
- `references/openpencil`
- `references/pencil-dev`
- `references/penpot/mcp`

The short version: Beak Design currently has the right ingredients, but the MCP and AI agent architecture is still too app-local, too route-centric, and too loosely separated from editor state. The stronger references treat MCP and agent execution as product surfaces with their own runtime boundaries.

## What the references do better

## 1. `open-pencil` treats MCP as a standalone product surface

Key patterns:

- dedicated MCP package: `references/open-pencil/packages/mcp`
- dedicated server entrypoint: `references/open-pencil/packages/mcp/src/server.ts`
- one canonical tool registry reused across surfaces: `references/open-pencil/packages/core/src/tools/registry.ts`
- clear distinction between:
  - core tools
  - extended tools
  - all tools

Why this is better than Beak Design today:

- Beak currently builds tools inside the app request path in `src/routes/api/ai/chat.ts`
- MCP is not yet a clearly externalized runtime
- tool registration and agent orchestration are still too coupled to the web app

What Beak should adopt:

- move MCP serving into its own package/runtime
- build tools once, reuse them everywhere
- keep chat route logic thin and make it consume the same MCP/tool surface as external agents

## 2. `openpencil` treats AI agents as first-class runtime backends

Key patterns:

- desktop and CLI packaging assumes multiple agent backends are normal
- model/provider capability differences are part of system design, not an afterthought
- MCP is distributed as an installable binary surface, not just an internal convenience

Why this is better than Beak Design today:

- Beak has adapters for cloud, Ollama, CLI, and MCP, but runtime behavior is still centered around “pick adapter inside the route”
- agent capability policy is implicit rather than enforced
- there is no strong packaging story yet for MCP or CLI agent interoperability

What Beak should adopt:

- define agent backends as runtime modules with explicit capability metadata
- distinguish:
  - supports tools
  - supports streaming
  - supports multimodal input
  - supports long-running sessions
  - supports local execution
- package MCP as an explicit external entrypoint

## 3. `pencil-dev` shows better transactional tool execution

Key patterns:

- `batch_design` uses an update block
- operations are validated
- failures produce rollback
- editor-state tool returns information that is useful for agents before they mutate anything

Why this matters:

Beak’s current `batch_design` path is still too thin to be the safe backbone for agent-driven mutation. The better pattern is:

1. inspect state
2. validate operation sequence
3. execute in transaction
4. rollback on failure
5. return structured success or failure context

## 4. `penpot/mcp` shows a bridge architecture worth keeping in mind

Key patterns:

- MCP is not hardwired into the editor process
- a plugin/runtime bridge connects the design surface to the MCP server
- transports are explicit:
  - streamable HTTP
  - SSE
  - stdio via proxy where needed

Why this matters:

Beak does not need this full bridge design immediately, but it should avoid assuming that app-local in-process MCP is the only future shape.

This is especially relevant if Beak wants to support:

- browser-only usage with restricted runtime access
- desktop-specific automation
- remote or headless agent control
- multi-client tool access

## Current Beak Design weaknesses in MCP and agent handling

## 1. MCP tool creation is too request-local

Current pattern:

- `src/routes/api/ai/chat.ts` creates the command bus, transaction manager, tool registry, tool context, and AI tool mapping inside the route

Problem:

- this makes MCP/tool execution feel like a chat implementation detail instead of a reusable system boundary

## 2. Tool context is too application-specific

Current pattern:

- `src/lib/ai/tool-context-provider.ts` directly mixes:
  - storage access
  - canvas store coupling
  - editor runtime cache
  - singleton lifecycle

Problem:

- hard to reuse outside the current app runtime
- difficult to reason about server vs client behavior cleanly

## 3. Agent selection and tool policy are too implicit

Current pattern:

- `src/routes/api/ai/chat.ts` asks the adapter whether tools are supported
- the route then decides whether to pass tools

Problem:

- not enough policy separation
- no clear read-only vs edit-mode tool gating
- no strong capability registry

## 4. External MCP is not yet a first-class runtime

Current pattern:

- Beak has MCP-style tools and MCP-related adapters, but not a mature standalone MCP runtime comparable to `open-pencil`

Problem:

- harder to integrate with external coding agents cleanly
- harder to test independently
- harder to package for desktop or CLI workflows

## Recommended target architecture for MCP and agents

## Layer 1: Editor core

Owns:

- schema
- command execution
- transactions
- document queries
- selection and viewport state

Must not know about:

- HTTP
- SSE
- provider-specific AI APIs
- chat UI

## Layer 2: Tool core

Owns:

- canonical tool definitions
- tool schemas
- read-only vs mutating tool classes
- command mapping
- tool execution contracts

This should be reusable by:

- internal chat
- standalone MCP server
- future CLI
- test harnesses

## Layer 3: MCP runtime

Owns:

- stdio transport
- HTTP/SSE transport if needed
- tool listing and invocation
- session-scoped tool context creation
- runtime diagnostics and auth/policy checks

This should be able to run:

- independently from the web chat route
- with desktop-backed or headless-backed editor contexts

## Layer 4: Agent runtime

Owns:

- provider adapters
- capability registry
- model/runtime policy
- conversation execution
- stream normalization
- toolset selection

This layer should consume the tool core, not own it.

## Layer 5: App surfaces

Examples:

- chat panel
- `/api/ai/chat`
- Tauri desktop integration
- future CLI

These should orchestrate, not define system behavior.

## Concrete MCP improvements Beak Design should make

## Improvement 1: create a standalone MCP package

Proposed destination:

```text
packages/mcp/
  src/server.ts
  src/transport/
  src/session-context.ts
```

Responsibilities:

- expose the canonical tool registry
- support stdio first
- add HTTP/SSE second only if needed
- create per-session tool contexts
- log tool calls and failures

Why:

- aligns with `open-pencil`
- makes Beak interoperable with external coding agents in a clean way

## Improvement 2: split tool definitions from tool serving

Current Beak state conflates:

- tool definition
- tool adaptation
- tool serving
- route orchestration

Target shape:

- `packages/tool-core` or equivalent owns definitions
- `packages/mcp` owns serving
- `packages/ai` owns AI adaptation

## Improvement 3: add explicit tool classes

Recommended categories:

- `read`
- `mutate`
- `export`
- `admin`

And explicit policies:

- read-only chat mode gets `read`
- edit mode gets `read + mutate`
- expert mode gets all approved categories

This is strongly supported by the `open-pencil` and `onlook` patterns.

## Improvement 4: add session-scoped context objects

Instead of one app-global singleton context provider, Beak should support:

- per-chat-session context
- per-MCP-session context
- desktop session context
- test session context

Each session context should declare:

- active document id
- actor identity
- storage adapter
- editor runtime binding
- capabilities available

This will make the system more deterministic and testable.

## Improvement 5: make `get_editor_state` a mandatory preflight tool

Borrowing from `pencil-dev` and `pencilplaybook`, Beak should encourage or require a preflight flow:

1. get editor state
2. inspect selection
3. inspect document tree if needed
4. mutate only after context is known

Beak’s `get_editor_state` should include:

- active document id and name
- active page id
- current selection ids
- visible top-level frames
- reusable components
- token summary
- current viewport summary

## Improvement 6: make `batch_design` truly transactional

Required upgrades:

- begin transaction/update block
- validate operations before commit where possible
- rollback on any failure
- structured response including:
  - succeeded operations
  - failed operation
  - rollback confirmation
  - validation warnings

This is non-negotiable if Beak wants agents to mutate design state safely.

## Improvement 7: define an agent capability registry

Each agent backend should explicitly declare:

- `supportsTools`
- `supportsStreaming`
- `supportsImages`
- `supportsLongSession`
- `supportsLocalExecution`
- `preferredToolMode`
- `maxPromptClass`

This avoids scattering policy across route handlers and UI conditionals.

## Improvement 8: separate agent orchestration from chat transport

Right now `/api/ai/chat` does too much.

It should become roughly:

1. resolve conversation + agent request
2. call AI runtime
3. stream normalized events back

And delegate to:

- prompt builder
- capability policy
- toolset selector
- session context factory
- stream normalizer

## Proposed new workstream

## Workstream N: MCP and Agent Runtime Refactor

### Objectives

- turn MCP into a first-class external runtime
- make agent execution policy explicit
- reduce app-local coupling

### Tasks

1. Extract canonical tool registry from app route setup.
2. Create standalone MCP server package with stdio transport first.
3. Introduce session-scoped tool contexts.
4. Add capability metadata to all agent adapters.
5. Split `/api/ai/chat` into:
   - request parsing
   - prompt/context assembly
   - agent runtime execution
   - stream conversion
6. Upgrade `batch_design` transaction and validation semantics.
7. Expand `get_editor_state` into a richer preflight inspection tool.
8. Add MCP contract tests and agent-runtime integration tests.

### Reference inspiration

- `references/open-pencil/packages/mcp/src/server.ts`
- `references/open-pencil/packages/core/src/tools/registry.ts`
- `references/openpencil`
- `references/pencil-dev/pencil-editor/src/tool-handlers/*`
- `references/penpot/mcp`

## Priority impact

This workstream should be treated as high priority, on the same tier as:

- command bus hardening
- editor-core extraction
- quality gate cleanup

Because without it, Beak’s AI and MCP story remains architecturally weaker than the best references even if individual features are added.

## Monorepo Reorganization and Modularization Update

Beak Design also needs a clearer path from its current single-app structure into a modular monorepo. The earlier sections recommended a package-based future shape, but this section makes that concrete.

The main problem today is not just “too many files in one app”. It is that multiple architectural layers are still co-located:

- schema and domain types
- editor core logic
- React/Konva bindings
- AI orchestration
- MCP tool definitions
- storage adapters
- Tauri runtime bindings
- templates
- app-specific UI

That makes it harder to:

- test layers independently
- reuse the same core for CLI/MCP/desktop
- enforce boundaries
- scale contributions safely

The references handle this better:

- `open-pencil` uses workspaces for `core`, `mcp`, `cli`, `vue`, and docs
- `openpencil` uses `apps/*` and `packages/*`
- `onlook` uses a larger monorepo split across apps, packages, and tooling

Beak Design should move in that direction deliberately.

## Monorepo goals

The monorepo should make the following true:

1. The design document model is owned by one package.
2. The mutation engine is owned by one package.
3. React canvas rendering is a consumer of editor-core, not the place where editor rules live.
4. AI orchestration can be reused by the web app, desktop app, CLI, and tests.
5. MCP runtime can be packaged and tested independently.
6. Storage implementations can vary by runtime without duplicating document logic.

## Recommended target monorepo shape

```text
beak-design/
  apps/
    web/
    desktop/
    docs/
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
```

This is the target shape. Beak Design does not need to jump there in one move.

## Package responsibilities

## `packages/schema`

Owns:

- document schema
- ids
- shared domain types
- version metadata
- migration interfaces

Move here first:

- `src/lib/schema.ts`
- id and schema helpers that should not depend on UI/runtime

Rules:

- no React
- no TanStack Store
- no Tauri
- no fetch/network logic

## `packages/editor-core`

Owns:

- command bus
- transactions
- document queries/selectors
- selection logic
- interaction-state logic
- viewport math
- undo/redo
- grouping/components/tokens mutation rules

Likely migration targets:

- `src/lib/ai/command-bus.ts`
- `src/lib/ai/transaction-manager.ts`
- large parts of `src/lib/canvas/*`
- variable and token mutation logic

Rules:

- no React components
- no route logic
- no storage-specific code

## `packages/editor-react`

Owns:

- React bindings for editor-core
- Konva stage integration
- React hooks around editor state
- renderer-specific helpers

Likely migration targets:

- `src/components/canvas/*`
- React-oriented canvas hooks
- app-independent inspector bindings if they can be separated

Rules:

- may depend on `editor-core`
- must not own document business rules

## `packages/ai-core`

Owns:

- agent adapters
- prompt builders
- context builders
- stream normalization
- conversation execution logic
- agent capability registry

Likely migration targets:

- `src/lib/ai/agent-adapters/*`
- `src/lib/ai/connection-manager.ts`
- parts of `src/hooks/useChat.ts`
- future prompt/context modules

Rules:

- should not depend on React UI
- should not define tool mutations itself

## `packages/tool-core`

Owns:

- canonical tool definitions
- tool schemas
- tool categories
- tool adapters to command execution

Likely migration targets:

- `src/lib/mcp-tools.ts`
- `src/lib/ai/mcp-tool-adapters.ts`
- tool-specific validation helpers

Rules:

- reusable by AI runtime, MCP runtime, and tests

## `packages/mcp-runtime`

Owns:

- MCP server implementation
- stdio transport
- optional HTTP/SSE transport
- session context creation
- runtime diagnostics

Likely migration targets:

- new code first
- later absorbs app-local MCP serving logic currently assembled in `/api/ai/chat`

Rules:

- consumes `tool-core`, `editor-core`, and storage/session adapters
- must not depend on app UI

## `packages/storage-core`

Owns:

- storage interfaces
- project metadata interfaces
- autosave/checkpoint contracts
- migration contracts

## `packages/storage-lowdb`

Owns:

- LowDB implementation
- browser/localStorage implementation if still needed
- file-backed implementation details for current storage model

Likely migration targets:

- `src/lib/db/*`

Rules:

- implements storage-core interfaces
- should not know about React views

## `packages/templates`

Owns:

- built-in templates
- template metadata
- template validation
- AI/template descriptors

Likely migration targets:

- `src/lib/templates/*`

## `packages/export-core`

Owns:

- export interfaces
- PNG/SVG/PDF export orchestration
- screenshot/export job contracts

Likely migration targets:

- `src/lib/export/*`

## `packages/platform-tauri`

Owns:

- JS wrappers around Tauri APIs
- runtime-specific commands and bindings
- desktop-only helpers

Likely migration targets:

- `src/lib/tauri.ts`
- `src/lib/utils/tauri-fs.ts`

Rules:

- must not own document logic

## `packages/shared-ui`

Owns:

- design-system primitives and app-agnostic UI building blocks

Likely migration targets:

- `src/components/ui/*`

Rules:

- should not import app routes or editor business logic

## `apps/web`

Owns:

- TanStack Router app
- app layout
- feature composition
- route handlers
- web-specific initialization

Likely migration targets:

- current `src/routes/*`
- app-level components like panels, menus, shell layout

## `apps/desktop`

Owns:

- Tauri shell
- Rust entrypoints
- desktop-specific wiring
- updater and native integrations

Likely migration targets:

- current `src-tauri/*`
- desktop bootstrap code

## Modularization principles

## Principle 1: dependencies should point inward

Allowed direction:

- apps -> packages
- ui/render packages -> core packages
- runtime packages -> core packages

Avoid:

- core packages importing app packages
- schema importing storage or UI
- tool-core importing route or chat components

## Principle 2: separate domain logic from runtime bindings

Example:

- `editor-core` should define what a command means
- `platform-tauri` should define how desktop file access works
- `apps/web` should define how the user triggers the command

## Principle 3: prefer thin adapters over mixed modules

If a module currently does both business logic and runtime logic, split it into:

- core module
- adapter module

This is especially relevant for:

- tool context provider
- storage
- AI request execution
- export logic

## Principle 4: monorepo packages should expose narrow public APIs

Each package should have:

- an `index.ts` entrypoint
- a small set of exported types/functions/classes
- internal files not imported directly by apps unless there is a good reason

## Suggested migration order

Do not start by moving everything.

## Phase A: establish workspace infrastructure

1. Add workspace support.
   - `pnpm-workspace.yaml`
   - shared TS config package or root TS project references
2. Create empty package shells.
3. Keep current app working during transition.

## Phase B: extract the least controversial packages first

Extract in this order:

1. `schema`
2. `templates`
3. `shared-ui`
4. `platform-tauri`

Why:

- these have clearer seams
- lower risk than moving editor-core first

## Phase C: extract storage and tool definitions

Extract:

1. `storage-core`
2. `storage-lowdb`
3. `tool-core`

Why:

- this starts enforcing boundaries without immediately moving the full canvas system

## Phase D: extract editor-core

This is the most important extraction, but not the first one.

Move:

- command bus
- transactions
- selection logic
- viewport math
- interaction states
- undo/redo

Only do this after the seams are clearer.

## Phase E: extract AI and MCP runtimes

Move:

- agent adapters
- prompt/context logic
- chat execution core
- MCP runtime

This is easier after `tool-core` and `editor-core` are already real packages.

## Phase F: split app shells

Finalize:

- `apps/web`
- `apps/desktop`

At this stage the current root app should mostly become composition code.

## Proposed immediate package map from current files

### Move first

- `src/lib/schema.ts` -> `packages/schema/src/index.ts`
- `src/lib/templates/*` -> `packages/templates/src/*`
- `src/components/ui/*` -> `packages/shared-ui/src/*`
- `src/lib/tauri.ts` and `src/lib/utils/tauri-fs.ts` -> `packages/platform-tauri/src/*`

### Move second

- `src/lib/db/*` -> `packages/storage-lowdb/src/*`
- storage interfaces currently mixed into `src/lib/mcp-tools.ts` -> `packages/storage-core/src/*`
- tool definitions in `src/lib/mcp-tools.ts` -> `packages/tool-core/src/*`

### Move third

- `src/lib/ai/command-bus.ts`
- `src/lib/ai/transaction-manager.ts`
- `src/lib/canvas/*`
- `src/lib/variables/*`

to:

- `packages/editor-core/src/*`

### Move fourth

- `src/lib/ai/agent-adapters/*`
- `src/lib/ai/connection-manager.ts`
- future prompt/context modules

to:

- `packages/ai-core/src/*`

### Move last

- `src/routes/*`
- app-level composed components

to:

- `apps/web/src/*`

## Monorepo tooling recommendations

## Use `pnpm` workspaces

This fits the current dependency/tooling direction and is already consistent with several references.

## Add project references or strict TS boundaries

At minimum:

- each package has its own `tsconfig.json`
- root config defines shared compiler rules
- build/test/lint can target packages independently

## Add package-level scripts

Examples:

- `pnpm --filter @beak/schema build`
- `pnpm --filter @beak/editor-core test`
- `pnpm --filter @beak/mcp-runtime dev`

## Add boundary lint rules

Examples:

- app packages cannot be imported by core packages
- `shared-ui` cannot import app routes
- `schema` cannot import React or storage

## Risks of monorepo migration

## Risk: package explosion before boundaries are clear

Mitigation:

- extract only when the boundary is real
- do not create packages for every folder

## Risk: moving files without reducing coupling

Mitigation:

- require each extraction to reduce imports across layers
- track forbidden dependencies explicitly

## Risk: broken velocity during migration

Mitigation:

- migrate in small steps
- keep old import aliases temporarily
- add compatibility exports where needed

## New workstream

## Workstream O: Monorepo Reorganization and Modularization

### Objectives

- turn Beak Design into a modular workspace
- make core layers reusable across web, desktop, CLI, and MCP
- reduce architectural coupling

### Tasks

1. Add workspace infrastructure and package shells.
2. Extract `schema`, `templates`, `shared-ui`, and `platform-tauri`.
3. Extract `storage-core`, `storage-lowdb`, and `tool-core`.
4. Extract `editor-core` with command, selection, viewport, and transaction logic.
5. Extract `ai-core` and `mcp-runtime`.
6. Move the current router app into `apps/web`.
7. Add boundary linting and package-level test/build scripts.

### Reference inspiration

- `references/open-pencil/package.json`
- `references/open-pencil/packages/*`
- `references/openpencil/package.json`
- `references/onlook/package.json`
- `references/onlook/packages/*`

## Priority impact

This workstream is high priority, but it should be sequenced carefully:

- start after quality-gate cleanup begins
- start before large new feature expansion
- execute in phases so it strengthens the architecture rather than freezing delivery
