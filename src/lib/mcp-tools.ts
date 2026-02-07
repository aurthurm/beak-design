/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Actor,
  CreateFrameInput,
  CreateLayerInput,
  CreateComponentInput,
  Document,
  DocumentId,
  ExportFramePngInput,
  FrameId,
  InstantiateComponentInput,
  LayerId,
  PageId,
  Patch,
  SCHEMA_VERSION,
  SelectionState,
  Token,
  UpsertTokenInput,
  TransactionId,
  IdFactory,
} from './schema'

/**
 * MCP Tooling (framework-neutral)
 *
 * You will wire this into your MCP server implementation:
 * - listTools -> registry.getToolDefinitions()
 * - callTool(name, input) -> registry.invoke(name, input, ctx)
 *
 * All tools mutate ONLY via the command bus + transaction manager.
 */

/** ---------- Core runtime interfaces ---------- */

export type ToolContext = {
  /** active document in the editor (or selected by user) */
  activeDocumentId: DocumentId | null;

  /** identifies who is calling */
  actor: Actor;

  /** how to persist/load documents */
  storage: StorageAdapter;

  /** access current in-memory editor state */
  editor: EditorRuntime;

  /** ids */
  ids: IdFactory;

  /** clock */
  nowISO(): string;
};

export type StorageAdapter = {
  createEmptyDocument(input: { name: string; docId: DocumentId; now: string }): Document;
  loadDocument(docId: DocumentId): Promise<Document>;
  saveDocument(doc: Document): Promise<void>;
  listRecent(): Promise<Array<{ id: DocumentId; name: string; updatedAt: string }>>;
};

export type EditorRuntime = {
  /** current live documents in memory */
  getDocument(docId: DocumentId): Document | null;
  setDocument(doc: Document): void;

  /** selection state (tldraw selection mirrored here) */
  getSelection(): SelectionState;
  setSelection(sel: SelectionState): void;

  /** optional export hook (wire to tldraw export) */
  exportFramePng(input: ExportFramePngInput): Promise<{ mimeType: "image/png"; bytesBase64: string }>;
};

/** Command bus: the ONLY way to mutate state */
export type Command =
  | { type: "doc.create"; payload: { name: string; docId: DocumentId } }
  | { type: "doc.open"; payload: { docId: DocumentId } }
  | { type: "doc.save"; payload: { docId: DocumentId } }
  | { type: "page.create"; payload: { docId: DocumentId; pageId: PageId; name: string } }
  | { type: "page.delete"; payload: { docId: DocumentId; pageId: PageId } }
  | { type: "page.rename"; payload: { docId: DocumentId; pageId: PageId; name: string } }
  | { type: "page.setActive"; payload: { docId: DocumentId; pageId: PageId } }
  | { type: "frame.create"; payload: { docId: DocumentId; frameId: FrameId; input: CreateFrameInput } }
  | { type: "frame.update"; payload: { docId: DocumentId; frameId: FrameId; patch: Patch<any> } }
  | { type: "frame.delete"; payload: { docId: DocumentId; frameId: FrameId } }
  | { type: "layer.create"; payload: { docId: DocumentId; layerId: LayerId; input: CreateLayerInput } }
  | { type: "layer.update"; payload: { docId: DocumentId; layerId: LayerId; patch: Patch<any> } }
  | { type: "layer.delete"; payload: { docId: DocumentId; layerId: LayerId } }
  | { type: "layer.group"; payload: { docId: DocumentId; groupId: LayerId; layerIds: LayerId[]; name: string } }
  | { type: "layer.ungroup"; payload: { docId: DocumentId; groupId: LayerId } }
  | { type: "layer.reorder"; payload: { docId: DocumentId; layerId: LayerId; toIndex: number } }
  | { type: "component.create"; payload: { docId: DocumentId; componentId: any; input: CreateComponentInput } }
  | { type: "component.instantiate"; payload: { docId: DocumentId; instanceLayerId: LayerId; input: InstantiateComponentInput } }
  | { type: "tokens.upsert"; payload: { docId: DocumentId; tokens: Token[] } }
  | { type: "selection.set"; payload: { docId: DocumentId; selection: SelectionState } };

export type CommandResult = {
  ok: true;
  changedIds?: string[];
} | {
  ok: false;
  error: { code: string; message: string; details?: any };
};

export type CommandBus = {
  dispatch(cmd: Command, ctx: ToolContext): Promise<CommandResult>;
};

/** Transaction manager (preview/apply support later) */
export type TransactionManager = {
  begin(name: string, ctx: ToolContext): Promise<TransactionId>;
  commit(txId: TransactionId, ctx: ToolContext): Promise<void>;
  rollback(txId: TransactionId, ctx: ToolContext): Promise<void>;
  /** group multiple commands into one undo step */
  inTransaction<T>(name: string, ctx: ToolContext, fn: () => Promise<T>): Promise<T>;
};

/** ---------- Tool definition format (MCP-friendly) ---------- */

export type ToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema-like shape (keep minimal; wire to real schema lib if you want) */
  inputSchema: any;
  outputSchema: any;
  handler: (input: any, ctx: ToolContext) => Promise<any>;
};

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  getToolDefinitions(): Array<Omit<ToolDefinition, "handler">> {
    return Array.from(this.tools.values()).map(({ handler, ...rest }) => rest);
  }

  async invoke(name: string, input: any, ctx: ToolContext) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.handler(input, ctx);
  }
}

/** ---------- Guardrails: document scoping + patch whitelist ---------- */

function requireActiveDocId(ctx: ToolContext): DocumentId {
  if (!ctx.activeDocumentId) {
    throw new Error("No active document. User must select an active document context.");
  }
  return ctx.activeDocumentId;
}

/**
 * Patch semantics:
 * - Only allow updating specific keys (prevents agents overwriting entire objects)
 * - Strip unknown keys
 */
function pickPatch<T extends Record<string, any>>(patch: any, allowed: Array<keyof T>): Partial<T> {
  const out: any = {};
  for (const k of allowed) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, k)) out[k as string] = patch[k as string];
  }
  return out;
}

/** ---------- Build the toolset ---------- */

export function buildMcpTools(deps: {
  commands: CommandBus;
  tx: TransactionManager;
}): ToolRegistry {
  const { commands, tx } = deps;

  const registry = new ToolRegistry();

  /** ---- Resources (implemented as tools for simplicity; MCP can expose as resources too) ---- */

  registry.register({
    name: "document_tree",
    description: "Return the full document graph, or filtered by page/frame/selectionOnly.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string" },
        pageId: { type: "string" },
        frameId: { type: "string" },
        selectionOnly: { type: "boolean" },
      },
      required: [],
    },
    outputSchema: { type: "object" },
    handler: async (input, ctx) => {
      const docId = (input?.documentId as DocumentId) ?? requireActiveDocId(ctx);
      const doc = ctx.editor.getDocument(docId) ?? (await ctx.storage.loadDocument(docId));
      // For v1: return whole document; you can filter later.
      return doc;
    },
  });

  registry.register({
    name: "selection_state",
    description: "Return the current selection (IDs + bounds).",
    inputSchema: { type: "object", properties: {}, required: [] },
    outputSchema: { type: "object" },
    handler: async (_input, ctx) => ctx.editor.getSelection(),
  });

  registry.register({
    name: "design_tokens",
    description: "Return design tokens for the active document.",
    inputSchema: { type: "object", properties: { documentId: { type: "string" } }, required: [] },
    outputSchema: { type: "object" },
    handler: async (input, ctx) => {
      const docId = (input?.documentId as DocumentId) ?? requireActiveDocId(ctx);
      const doc = ctx.editor.getDocument(docId) ?? (await ctx.storage.loadDocument(docId));
      return doc.tokens;
    },
  });

  /** ---- Mutations ---- */

  registry.register({
    name: "create_document",
    description: "Create a new document and set it active.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    outputSchema: {
      type: "object",
      properties: { documentId: { type: "string" }, schemaVersion: { type: "string" } },
      required: ["documentId", "schemaVersion"],
    },
    handler: async (input, ctx) => {
      const docId = ctx.ids.doc();
      const now = ctx.nowISO();
      const empty = ctx.storage.createEmptyDocument({ name: input.name, docId, now });
      // Ensure schema version
      empty.schemaVersion = SCHEMA_VERSION;

      ctx.editor.setDocument(empty);
      await ctx.storage.saveDocument(empty);

      ctx.activeDocumentId = docId as any; // if ctx is mutable in your server; otherwise return and let caller set
      return { documentId: docId, schemaVersion: SCHEMA_VERSION };
    },
  });

  registry.register({
    name: "open_document",
    description: "Load a document into the editor and set it active.",
    inputSchema: {
      type: "object",
      properties: { documentId: { type: "string" } },
      required: ["documentId"],
    },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input, ctx) => {
      const doc = await ctx.storage.loadDocument(input.documentId);
      ctx.editor.setDocument(doc);
      ctx.activeDocumentId = input.documentId;
      return { ok: true };
    },
  });

  registry.register({
    name: "save_document",
    description: "Persist the active document to disk.",
    inputSchema: { type: "object", properties: { documentId: { type: "string" } }, required: [] },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input, ctx) => {
      const docId = (input?.documentId as DocumentId) ?? requireActiveDocId(ctx);
      const doc = ctx.editor.getDocument(docId);
      if (!doc) throw new Error("Document not in editor memory.");
      await ctx.storage.saveDocument(doc);
      return { ok: true };
    },
  });

  registry.register({
    name: "create_page",
    description: "Create a page in the active document.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    outputSchema: { type: "object", properties: { pageId: { type: "string" } }, required: ["pageId"] },
    handler: async (input, ctx) => {
      const docId = requireActiveDocId(ctx);
      const pageId = ctx.ids.page();
      const cmd = { type: "page.create", payload: { docId, pageId, name: input.name } } as const;
      const res = await commands.dispatch(cmd, ctx);
      if (!res.ok) throw new Error(res.error.message);
      return { pageId };
    },
  });

  registry.register({
    name: "set_active_page",
    description: "Set the active page for subsequent operations.",
    inputSchema: {
      type: "object",
      properties: { pageId: { type: "string" } },
      required: ["pageId"],
    },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input, ctx) => {
      const docId = requireActiveDocId(ctx);
      const res = await commands.dispatch(
        { type: "page.setActive", payload: { docId, pageId: input.pageId } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { ok: true };
    },
  });

  registry.register({
    name: "create_frame",
    description: "Create a UI frame (artboard).",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        name: { type: "string" },
        platform: { type: "string" },
        rect: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } },
          required: ["x", "y", "w", "h"],
        },
        background: { type: "object" },
      },
      required: ["pageId", "name", "platform", "rect"],
    },
    outputSchema: { type: "object", properties: { frameId: { type: "string" } }, required: ["frameId"] },
    handler: async (input: CreateFrameInput, ctx) => {
      const docId = requireActiveDocId(ctx);
      const frameId = ctx.ids.frame();

      const res = await commands.dispatch(
        { type: "frame.create", payload: { docId, frameId, input } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { frameId };
    },
  });

  registry.register({
    name: "update_frame",
    description: "Update a frame. Patch is restricted to safe keys.",
    inputSchema: {
      type: "object",
      properties: {
        frameId: { type: "string" },
        patch: { type: "object" },
      },
      required: ["frameId", "patch"],
    },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input, ctx) => {
      const docId = requireActiveDocId(ctx);
      const allowed = ["name", "platform", "rect", "background"] as const;
      const patch = pickPatch<any>(input.patch, allowed as any);

      const res = await commands.dispatch(
        { type: "frame.update", payload: { docId, frameId: input.frameId, patch } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { ok: true };
    },
  });

  registry.register({
    name: "create_layer",
    description: "Create a layer (rect/text/image/group/line/ellipse) within a frame.",
    inputSchema: {
      type: "object",
      properties: { /* keep flexible */ },
      required: ["frameId", "type", "name", "rect"],
    },
    outputSchema: { type: "object", properties: { layerId: { type: "string" } }, required: ["layerId"] },
    handler: async (input: CreateLayerInput, ctx) => {
      const docId = requireActiveDocId(ctx);
      const layerId = ctx.ids.layer();

      const res = await commands.dispatch(
        { type: "layer.create", payload: { docId, layerId, input } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { layerId };
    },
  });

  registry.register({
    name: "update_layer",
    description: "Update a layer. Patch is restricted to safe keys.",
    inputSchema: {
      type: "object",
      properties: {
        layerId: { type: "string" },
        patch: { type: "object" },
      },
      required: ["layerId", "patch"],
    },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input, ctx) => {
      const docId = requireActiveDocId(ctx);

      // IMPORTANT: only allow safe changes; prevents “replace whole layer” damage.
      const allowed = [
        "name",
        "rect",
        "rotation",
        "style",
        "layout",
        "flags",
        // text specifics
        "text",
        "typography",
        "color",
        "align",
        "verticalAlign",
        // image specifics
        "assetId",
        "crop",
        // line specifics
        "points",
      ] as const;

      const patch = pickPatch<any>(input.patch, allowed as any);

      const res = await commands.dispatch(
        { type: "layer.update", payload: { docId, layerId: input.layerId, patch } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { ok: true };
    },
  });

  registry.register({
    name: "delete_layer",
    description: "Delete a layer (and its children if it is a group).",
    inputSchema: {
      type: "object",
      properties: { layerId: { type: "string" } },
      required: ["layerId"],
    },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input, ctx) => {
      const docId = requireActiveDocId(ctx);
      const res = await commands.dispatch(
        { type: "layer.delete", payload: { docId, layerId: input.layerId } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { ok: true };
    },
  });

  registry.register({
    name: "group_layers",
    description: "Group layers under a new group layer.",
    inputSchema: {
      type: "object",
      properties: {
        layerIds: { type: "array", items: { type: "string" } },
        name: { type: "string" },
      },
      required: ["layerIds", "name"],
    },
    outputSchema: { type: "object", properties: { groupId: { type: "string" } }, required: ["groupId"] },
    handler: async (input, ctx) => {
      const docId = requireActiveDocId(ctx);
      const groupId = ctx.ids.layer();
      const res = await commands.dispatch(
        { type: "layer.group", payload: { docId, groupId, layerIds: input.layerIds, name: input.name } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { groupId };
    },
  });

  registry.register({
    name: "create_component",
    description: "Create a component from a set of layers.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        rootLayerId: { type: "string" },
        layerIds: { type: "array", items: { type: "string" } },
      },
      required: ["name", "rootLayerId", "layerIds"],
    },
    outputSchema: { type: "object", properties: { componentId: { type: "string" } }, required: ["componentId"] },
    handler: async (input: CreateComponentInput, ctx) => {
      const docId = requireActiveDocId(ctx);
      const componentId = ctx.ids.component();

      const res = await commands.dispatch(
        { type: "component.create", payload: { docId, componentId, input } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { componentId };
    },
  });

  registry.register({
    name: "instantiate_component",
    description: "Instantiate a component as a componentInstance layer.",
    inputSchema: { type: "object", properties: {}, required: ["frameId", "componentId", "name", "rect"] },
    outputSchema: { type: "object", properties: { instanceLayerId: { type: "string" } }, required: ["instanceLayerId"] },
    handler: async (input: InstantiateComponentInput, ctx) => {
      const docId = requireActiveDocId(ctx);
      const instanceLayerId = ctx.ids.layer();

      const res = await commands.dispatch(
        { type: "component.instantiate", payload: { docId, instanceLayerId, input } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { instanceLayerId };
    },
  });

  registry.register({
    name: "upsert_tokens",
    description: "Create or update design tokens. Tokens are keyed by tokenId.",
    inputSchema: {
      type: "object",
      properties: { tokens: { type: "array", items: { type: "object" } } },
      required: ["tokens"],
    },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input: { tokens: UpsertTokenInput[] }, ctx) => {
      const docId = requireActiveDocId(ctx);
      const res = await commands.dispatch(
        { type: "tokens.upsert", payload: { docId, tokens: input.tokens as Token[] } },
        ctx
      );
      if (!res.ok) throw new Error(res.error.message);
      return { ok: true };
    },
  });

  registry.register({
    name: "set_selection",
    description: "Set selection in the editor (frame/layer IDs).",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        selectedIds: { type: "array", items: { type: "string" } },
      },
      required: ["pageId", "selectedIds"],
    },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input, ctx) => {
      const docId = requireActiveDocId(ctx);
      const selection: SelectionState = { pageId: input.pageId, selectedIds: input.selectedIds };
      const res = await commands.dispatch({ type: "selection.set", payload: { docId, selection } }, ctx);
      if (!res.ok) throw new Error(res.error.message);
      return { ok: true };
    },
  });

  /** ---- Transaction helpers (agent batches) ---- */

  registry.register({
    name: "begin_transaction",
    description: "Begin a grouped transaction (one undo step).",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    outputSchema: { type: "object", properties: { txId: { type: "string" } }, required: ["txId"] },
    handler: async (input, ctx) => {
      const txId = await tx.begin(input.name, ctx);
      return { txId };
    },
  });

  registry.register({
    name: "commit_transaction",
    description: "Commit a grouped transaction.",
    inputSchema: { type: "object", properties: { txId: { type: "string" } }, required: ["txId"] },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input, ctx) => {
      await tx.commit(input.txId as TransactionId, ctx);
      return { ok: true };
    },
  });

  registry.register({
    name: "rollback_transaction",
    description: "Rollback a grouped transaction.",
    inputSchema: { type: "object", properties: { txId: { type: "string" } }, required: ["txId"] },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    handler: async (input, ctx) => {
      await tx.rollback(input.txId as TransactionId, ctx);
      return { ok: true };
    },
  });

  /** ---- Batch Design Operations ---- */

  registry.register({
    name: "batch_design",
    description: "Execute multiple design operations in a batch. Supports Insert (I), Copy (C), Replace (R), Move (M), Delete (D), Update (U) operations.",
    inputSchema: {
      type: "object",
      properties: {
        operations: { type: "string", description: "JavaScript-like operations string (e.g., 'foo=I(\"parent\", {...})')" },
        id: { type: "string", description: "Unique ID for this batch operation" },
        partial: { type: "boolean", description: "Whether this is a partial (streaming) update" },
      },
      required: ["operations", "id"],
    },
    outputSchema: {
      type: "object",
      properties: { success: { type: "boolean" }, message: { type: "string" } },
      required: ["success", "message"],
    },
    handler: async (input, ctx) => {
      requireActiveDocId(ctx)
      // Import and use batch design processor
      const { BatchDesignProcessor } = await import('./mcp/batch-design-processor')
      const batchDesignProcessor = new BatchDesignProcessor(commands)
      const result = await batchDesignProcessor.process(
        ctx,
        input.partial || false,
        input.operations,
        input.id
      )
      if (!result) {
        return { success: true, message: "Processing..." }
      }
      return result
    },
  })

  registry.register({
    name: "search_design_nodes",
    description: "Search for nodes in the document tree by patterns or node IDs.",
    inputSchema: {
      type: "object",
      properties: {
        patterns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              name: { type: "string" },
              reusable: { type: "boolean" },
            },
          },
        },
        nodeIds: { type: "array", items: { type: "string" } },
        readDepth: { type: "number" },
        searchDepth: { type: "number" },
        parentId: { type: "string" },
      },
      required: [],
    },
    outputSchema: { type: "object" },
    handler: async (input, ctx) => {
      const docId = requireActiveDocId(ctx)
      const doc = ctx.editor.getDocument(docId) ?? (await ctx.storage.loadDocument(docId))

      let results: any[] = []

      if (input.nodeIds && input.nodeIds.length > 0) {
        // Return specific nodes
        for (const nodeId of input.nodeIds) {
          if (doc.frames[nodeId as FrameId]) {
            results.push(doc.frames[nodeId as FrameId])
          } else if (doc.layers[nodeId as LayerId]) {
            results.push(doc.layers[nodeId as LayerId])
          }
        }
      } else if (input.patterns && input.patterns.length > 0) {
        // Search by patterns
        for (const pattern of input.patterns) {
          // Search frames
          for (const frame of Object.values(doc.frames)) {
            if (
              (!pattern.type || frame.type === pattern.type) &&
              (!pattern.name || frame.name?.match(new RegExp(pattern.name, 'i')))
            ) {
              results.push(frame)
            }
          }
          // Search layers
          for (const layer of Object.values(doc.layers)) {
            if (
              (!pattern.type || layer.type === pattern.type) &&
              (!pattern.name || layer.name?.match(new RegExp(pattern.name, 'i')))
            ) {
              results.push(layer)
            }
          }
        }
      } else {
        // Return all top-level frames
        const activePageId = doc.activePageId
        if (activePageId && doc.pages[activePageId]) {
          const page = doc.pages[activePageId]
          results = page.frameIds.map((id) => doc.frames[id]).filter(Boolean)
        }
      }

      return { nodes: results }
    },
  })

  registry.register({
    name: "get_editor_state",
    description: "Get the current editor state including active document, selection, and viewport.",
    inputSchema: { type: "object", properties: {}, required: [] },
    outputSchema: { type: "object" },
    handler: async (_input, ctx) => {
      const docId = ctx.activeDocumentId
      const doc = docId ? (ctx.editor.getDocument(docId) ?? null) : null
      const selection = ctx.editor.getSelection()

      return {
        activeDocumentId: docId,
        document: doc,
        selection,
        viewport: {
          // Viewport state would come from canvas store
          panX: 0,
          panY: 0,
          zoom: 1,
        },
      }
    },
  })

  /** ---- Export ---- */

  registry.register({
    name: "export_frame_png",
    description: "Export a frame as PNG (base64 bytes).",
    inputSchema: {
      type: "object",
      properties: { frameId: { type: "string" }, scale: { type: "number", enum: [1, 2, 3] } },
      required: ["frameId", "scale"],
    },
    outputSchema: {
      type: "object",
      properties: { mimeType: { type: "string" }, bytesBase64: { type: "string" } },
      required: ["mimeType", "bytesBase64"],
    },
    handler: async (input: ExportFramePngInput, ctx) => {
      requireActiveDocId(ctx);
      return ctx.editor.exportFramePng(input);
    },
  });

  return registry;
}
