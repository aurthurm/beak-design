---

# PRD: Agent-Native UI/UX Design Tool

**Code name:** CanvasMCP
**Owner:** Aurthur
**Date:** 2026-01-24
**Version:** 0.2 (Refined)

---

## 1. Overview

### 1.1 Vision

Build an **AI-native UI/UX design editor** that feels like “Figma for humans + a programmable canvas for agents.”
Designs live in one **single source of truth** document. Humans edit visually; agents edit via **MCP tools**—both through the same **command pipeline** so history, undo/redo, and validation remain consistent.

### 1.2 Product principles

1. **Single source of truth:** The design document is the canonical state.
2. **One mutation path:** Human edits and agent edits both become commands.
3. **Agents propose, humans control:** AI actions are previewable, undoable, and attributable.
4. **UI/UX first:** v1 is a serious UI editor (frames, layout primitives, tokens, components), not a general whiteboard.

### 1.3 Goals & success metrics

**Goals (v1):**

* Enable agents to generate and edit real UI screens (frames + layers + styles + components) via MCP.
* Let users refine any agent output using standard design interactions (select/move/resize/text edit).
* Produce reliable exports (PNG + JSON) suitable for “design-to-code” pipelines later.

**Candidate success metrics (first 6–12 months):**

* 200+ weekly active users (desktop).
* 30% of sessions include at least one MCP tool-call batch.
* > 90% of AI tool-call batches are “applied without rollback” (proxy for usefulness).

---

## 2. Problem

### 2.1 Pain points

* Current design tools are not designed for agentic control; automation is either limited or hacky.
* AI design flows often break the design file as a source of truth (exports, screenshots, manual transfer).
* Users want AI to do the heavy lifting, but need high-fidelity manual editing to polish.

### 2.2 Opportunity

MCP makes it feasible for multiple agent environments (Codex-like, Claude Code, Cursor) to call tools consistently. A focused UI editor with strong agent tooling can become the “agent-addressable design surface.”

---

## 3. Users & use cases

### 3.1 Primary users

* AI-savvy developers building products who want **agent-assisted UI design**.
* Product designers who want AI-generated drafts but need manual polish.
* Solo founders who need fast UI iteration.

### 3.2 Core user journeys

1. **Prompt → draft screens**

   * User describes app/screens.
   * Agent creates frames, layout, components, tokens.
   * User adjusts spacing, hierarchy, text, brand style.

2. **Refine an existing screen**

   * User selects a frame or layers.
   * Agent reworks layout/typography to improve hierarchy or fit a breakpoint.
   * User accepts, tweaks.

3. **Componentize**

   * Agent identifies repeated patterns and proposes components.
   * User approves, then edits component to update instances.

---

## 4. Scope

### 4.1 In scope (v1: UI/UX editor)

**Canvas & editing**

* Infinite canvas with pages.
* Frames (artboards) with presets: Mobile / Tablet / Desktop / Custom.
* UI primitives: Rectangle, Ellipse (optional), Line, Text, Image.
* Grouping, locking, visibility, ordering (z-index).
* Snap-to-grid, alignment guides, distribute spacing.
* Right sidebar inspector (position, size, typography, fill/stroke, radius, opacity).
* Layer tree panel with hierarchy.

**UI-specific constructs**

* Components + instances (basic).
* Design tokens (colors + typography + spacing), bindable from inspector.
* Export: PNG per frame; JSON document.

**Agent/MCP**

* Embedded MCP server exposing document resources + mutation tools.
* Tool-call history & attribution.
* Batch transactions: one “agent action” = one undo step.

### 4.2 Explicitly out of scope (v1)

* Pen tool / vector boolean ops / advanced path editing.
* Full multiplayer realtime collaboration.
* Prototyping interactions (click-through flows, animations).
* Whiteboard extras (sticky notes, freehand drawing, brainstorming) — later phase.
* Plugin marketplace.

---

## 5. Product experience

### 5.1 App structure

* **Home**

  * Recent projects
  * New project templates (Mobile app, Web app, Dashboard)
  * MCP connection status + instructions

* **Editor**

  * Top bar: undo/redo, zoom, export, “AI” button, MCP status
  * Left: Pages + Layers tree (toggle tabs)
  * Center: Canvas (konvajs)
  * Right: Inspector (properties / tokens / components)

### 5.2 AI experience (must-have UX)

* **AI Panel** with:

  * Prompt input
  * “Target” selector (Current page / selected frame / selected layers)
  * **Preview / Apply / Reject** for agent batches
  * “What changed?” summary (diff)

### 5.3 Trust & control

* Every agent change set:

  * is grouped as a transaction
  * is attributed (agent name + time)
  * is undoable in one step
  * can be rejected before applying (preview mode)

---

## 6. Functional requirements

### 6.1 Document, pages, canvas

* FR-1: Create/open/save projects locally.
* FR-2: Multiple pages per document.
* FR-3: Infinite canvas per page with pan/zoom and min/max zoom.
* FR-4: Stable IDs for all entities (frames/layers/components/tokens).

### 6.2 Frames (artboards)

* FR-5: Create frames from presets or custom size.
* FR-6: Frames have name, device category, background color.
* FR-7: Export respects frame bounds (clip content to frame).

### 6.3 Layers & editing

* FR-8: Create/edit: rectangle, text, image (ellipse/line optional).
* FR-9: Select/multi-select; move/resize/rotate; duplicate; delete.
* FR-10: Group/ungroup; lock/unlock; hide/show.
* FR-11: Layer panel supports reordering and hierarchy.
* FR-12: Deterministic z-order across save/load.

### 6.4 Styling & typography

* FR-13: Fill (solid), stroke (solid), radius, opacity.
* FR-14: Text: font family, weight, size, line height, align, color.
* FR-15: Inspector edits apply immediately and are undoable.

### 6.5 Design tokens

* FR-16: Create/edit tokens: colors, typography styles, spacing scale.
* FR-17: Bind layer properties to tokens (store token reference).
* FR-18: Token updates propagate to bound layers.

### 6.6 Components

* FR-19: Convert selection/group into component definition.
* FR-20: Place component instances.
* FR-21: Editing component updates instances.
* FR-22: Instance overrides (v1 minimal): text content + fill color.

### 6.7 Export

* FR-23: Export frame to PNG (configurable scale 1x/2x/3x).
* FR-24: Export full document JSON (versioned schema).
* FR-25: Export tokens JSON separately.

---

## 7. Agent / MCP requirements (core differentiator)

### 7.1 System design constraint

**All mutations (human or agent) MUST flow through a command pipeline**:

* validates inputs
* applies changes to the document/store
* records history
* emits events for UI updates

### 7.2 MCP server

* MCP-1: Desktop app runs an embedded MCP server (on-demand + user-toggle).
* MCP-2: Server exposes:

  * **Resources** (read): document tree, selection, tokens, components
  * **Tools** (write): create/update/delete, layout ops, export
  * **Prompts**: recommended sequences

### 7.3 Resources (read)

* MCP-R1: `document_tree` (full doc or filtered by page/frame/selection)
* MCP-R2: `selection_state` (currently selected IDs + bounding box)
* MCP-R3: `design_tokens`
* MCP-R4: `component_library`

### 7.4 Tools (write)

**Document & navigation**

* MCP-T1: `create_document`, `open_document`, `save_document`
* MCP-T2: `create_page`, `delete_page`, `rename_page`
* MCP-T3: `set_active_page`, `set_selection`

**Frames**

* MCP-T4: `create_frame`, `update_frame`, `delete_frame`

**Layers**

* MCP-T5: `create_layer` (type + parent + props)
* MCP-T6: `update_layer` (patch semantics)
* MCP-T7: `delete_layer`
* MCP-T8: `group_layers`, `ungroup_layers`
* MCP-T9: `reorder_layer`
* MCP-T10: `duplicate_layers`

**Layout helpers (v1 minimal)**

* MCP-T11: `align_layers` (left/center/right/top/middle/bottom)
* MCP-T12: `distribute_layers` (horizontal/vertical spacing)
* MCP-T13: `apply_grid_layout` (simple columns/rows constraints)

**Components & tokens**

* MCP-T14: `create_component`, `instantiate_component`, `update_component`
* MCP-T15: `upsert_tokens`

**Export**

* MCP-T16: `export_frame_png`
* MCP-T17: `export_document_json`

### 7.5 Transaction + preview model

* MCP-X1: Server supports **batch transactions**:

  * `begin_transaction(name)`
  * tool calls…
  * `commit_transaction()` OR `rollback_transaction()`
* MCP-X2: “Preview mode”:

  * apply changes to a temporary draft state
  * user chooses Apply/Reject
  * only Apply merges into real history

### 7.6 Security / permissions

* MCP-S1: MCP disabled by default on first install (user explicitly enables).
* MCP-S2: Read-only mode toggle.
* MCP-S3: Active-document sandbox: tools can only access active document unless user grants access.
* MCP-S4: Tool-call log UI panel (timestamp, tool name, params summary, agent id).

---

## 8. Non-functional requirements

### 8.1 Performance

* NFR-1: Smooth interaction target ~50+ fps with ~2k layers on mid-range laptop.
* NFR-2: Save/load typical project (10 frames, 500 layers) < 2 seconds (SSD).

### 8.2 Reliability

* NFR-3: Autosave every 30 seconds + on transaction commit.
* NFR-4: Safe save (write temp → atomic rename).
* NFR-5: Crash recovery: reopen last autosaved state.

### 8.3 Usability

* NFR-6: Keyboard shortcuts for core actions (duplicate, group, undo/redo, zoom, frame preset).
* NFR-7: First-run onboarding explaining MCP + how to connect agents.

---

## 9. Technical architecture (tldraw-first)

### 9.1 Editor core

* React + TypeScript
* tldraw as canvas + selection/interaction
* Custom shapes: Frame, Text, Rect, Image, ComponentInstance (and optional Line/Ellipse)

### 9.2 Data model & schema

* Versioned schema: `schemaVersion`
* Normalized entities:

  * Document → Pages → Frames → Layers
  * Tokens
  * Components + Instances
* Stable IDs used across:

  * UI
  * MCP calls
  * exports

### 9.3 Command bus (must-have)

* Commands are the unit of history, permissions, validation.
* Agent tool calls translate into commands.
* User interactions also emit commands (even if internally).

---

## 10. Acceptance criteria (v1 “done means done”)

1. A connected agent can:

   * create a page, create 3 frames, populate each frame with UI layers, and apply tokens.
2. User can:

   * manually edit any layer (move/resize/edit text) after AI generation without glitches.
3. AI operations are:

   * previewable, attributable, and undoable in one step.
4. Export:

   * PNG of any frame matches what user sees (within acceptable rendering tolerance).
   * JSON export round-trips (export → import) with no loss of structure.

---

## 11. Risks & mitigations

* **Schema churn breaks agents** → versioned schema + backward compatible tool inputs.
* **AI creates messy layers** → enforce naming conventions, grouping rules, layout helpers, validation.
* **Conflicts between user + AI edits** → selection scoping + preview/apply + single mutation path.
* **Scope creep into “everything canvas”** → hard gate: UI/UX only until v1 hits acceptance criteria.

---

## 12. Milestones (tighter, UI-first)

* **M0 – Spike (2 weeks)**

  * tldraw editor shell + custom Frame shape + JSON export/import

* **M1 – UI Editor MVP (6 weeks)**

  * frames, layers, inspector, layer tree, save/load, PNG export

* **M2 – MCP Alpha (4 weeks)**

  * resources + core tools + transactions + tool-call log + one agent integration

* **M3 – v1 Beta (6–8 weeks)**

  * tokens, components, preview/apply workflow, templates, onboarding

---

