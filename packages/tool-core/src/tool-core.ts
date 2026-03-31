import type {
  Actor,
  CreateComponentInput,
  CreateFrameInput,
  CreateLayerInput,
  Document,
  DocumentId,
  ExportFramePngInput,
  FrameId,
  IdFactory,
  InstantiateComponentInput,
  LayerId,
  PageId,
  Patch,
  SelectionState,
  Token,
  TransactionId,
} from '../../schema/src'

export type ToolContext = {
  activeDocumentId: DocumentId | null
  actor: Actor
  storage: StorageAdapter
  editor: EditorRuntime
  ids: IdFactory
  nowISO(): string
}

export type StorageAdapter = {
  createEmptyDocument(input: { name: string; docId: DocumentId; now: string }): Document
  loadDocument(docId: DocumentId): Promise<Document>
  saveDocument(doc: Document): Promise<void>
  listRecent(): Promise<Array<{ id: DocumentId; name: string; updatedAt: string }>>
}

export type EditorRuntime = {
  getDocument(docId: DocumentId): Document | null
  setDocument(doc: Document): void
  getSelection(): SelectionState
  setSelection(sel: SelectionState): void
  exportFramePng(input: ExportFramePngInput): Promise<{ mimeType: 'image/png'; bytesBase64: string }>
}

export type Command =
  | { type: 'doc.create'; payload: { name: string; docId: DocumentId } }
  | { type: 'doc.open'; payload: { docId: DocumentId } }
  | { type: 'doc.save'; payload: { docId: DocumentId } }
  | { type: 'page.create'; payload: { docId: DocumentId; pageId: PageId; name: string } }
  | { type: 'page.delete'; payload: { docId: DocumentId; pageId: PageId } }
  | { type: 'page.rename'; payload: { docId: DocumentId; pageId: PageId; name: string } }
  | { type: 'page.setActive'; payload: { docId: DocumentId; pageId: PageId } }
  | { type: 'frame.create'; payload: { docId: DocumentId; frameId: FrameId; input: CreateFrameInput } }
  | { type: 'frame.update'; payload: { docId: DocumentId; frameId: FrameId; patch: Patch<any> } }
  | { type: 'frame.delete'; payload: { docId: DocumentId; frameId: FrameId } }
  | { type: 'layer.create'; payload: { docId: DocumentId; layerId: LayerId; input: CreateLayerInput } }
  | { type: 'layer.update'; payload: { docId: DocumentId; layerId: LayerId; patch: Patch<any> } }
  | { type: 'layer.delete'; payload: { docId: DocumentId; layerId: LayerId } }
  | { type: 'layer.group'; payload: { docId: DocumentId; groupId: LayerId; layerIds: LayerId[]; name: string } }
  | { type: 'layer.ungroup'; payload: { docId: DocumentId; groupId: LayerId } }
  | { type: 'layer.reorder'; payload: { docId: DocumentId; layerId: LayerId; toIndex: number } }
  | { type: 'component.create'; payload: { docId: DocumentId; componentId: any; input: CreateComponentInput } }
  | { type: 'component.instantiate'; payload: { docId: DocumentId; instanceLayerId: LayerId; input: InstantiateComponentInput } }
  | { type: 'tokens.upsert'; payload: { docId: DocumentId; tokens: Token[] } }
  | { type: 'selection.set'; payload: { docId: DocumentId; selection: SelectionState } }

export type CommandResult =
  | { ok: true; changedIds?: string[] }
  | { ok: false; error: { code: string; message: string; details?: any } }

export type CommandBus = {
  dispatch(cmd: Command, ctx: ToolContext): Promise<CommandResult>
}

export type TransactionManager = {
  begin(name: string, ctx: ToolContext): Promise<TransactionId>
  commit(txId: TransactionId, ctx: ToolContext): Promise<void>
  rollback(txId: TransactionId, ctx: ToolContext): Promise<void>
  inTransaction<T>(name: string, ctx: ToolContext, fn: () => Promise<T>): Promise<T>
}

export type ToolDefinition = {
  name: string
  description: string
  inputSchema: any
  outputSchema: any
  category?: ToolCategory
  capabilities?: ToolCapabilities
  handler: (input: any, ctx: ToolContext) => Promise<any>
}

export type ToolCategory = 'read' | 'mutate' | 'transaction' | 'batch' | 'export' | 'utility'

export type ToolCapabilities = {
  access: 'read' | 'mutate'
  requiresActiveDocument?: boolean
  usesTransactions?: boolean
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`)
    this.tools.set(tool.name, tool)
  }

  getToolDefinitions(): Array<Omit<ToolDefinition, 'handler'>> {
    return Array.from(this.tools.values()).map(({ handler, ...rest }) => rest)
  }

  async invoke(name: string, input: any, ctx: ToolContext) {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    return tool.handler(input, ctx)
  }
}

export function requireActiveDocId(ctx: ToolContext): DocumentId {
  if (!ctx.activeDocumentId) {
    throw new Error('No active document. User must select an active document context.')
  }
  return ctx.activeDocumentId
}

export function pickPatch<T extends Record<string, any>>(patch: any, allowed: Array<keyof T>): Partial<T> {
  const out: any = {}
  for (const k of allowed) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, k)) out[k as string] = patch[k as string]
  }
  return out
}
