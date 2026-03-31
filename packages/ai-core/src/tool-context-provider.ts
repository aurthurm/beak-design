import type {
  Actor,
  Document,
  DocumentId,
  EditorRuntime,
  ExportFramePngInput,
  IdFactory,
  SelectionState,
  StorageAdapter,
  ToolContext,
} from '../../schema/src'

export type ToolContextProviderDeps = {
  ids: IdFactory
  nowISO: () => string
  createEmptyDocument: (input: { name: string; docId: DocumentId; now: string }) => Document
  loadDocument: (docId: DocumentId) => Promise<Document | null>
  saveDocument: (doc: Document) => Promise<void>
  listRecent: () => Promise<Array<{ id: DocumentId; name: string; updatedAt: string }>>
  getCanvasDocument: () => Document | null
  setCanvasDocument: (doc: Document) => void
  getCanvasSelection: () => SelectionState
  setCanvasSelection: (selection: SelectionState) => void
  exportFramePng: (
    input: ExportFramePngInput
  ) => Promise<{ mimeType: 'image/png'; bytesBase64: string }>
}

export class ToolContextProvider {
  private activeDocumentId: DocumentId | null = null
  private actor: Actor = { kind: 'agent', agentName: 'claude' }

  constructor(private readonly deps: ToolContextProviderDeps) {}

  createToolContext(): ToolContext {
    return {
      activeDocumentId: this.activeDocumentId,
      actor: this.actor,
      storage: this.createStorageAdapter(),
      editor: this.createEditorRuntime(),
      ids: this.deps.ids,
      nowISO: this.deps.nowISO,
    }
  }

  setActiveDocumentId(docId: DocumentId | null): void {
    this.activeDocumentId = docId
  }

  getActiveDocumentId(): DocumentId | null {
    return this.activeDocumentId
  }

  setActor(actor: Actor): void {
    this.actor = actor
  }

  private createStorageAdapter(): StorageAdapter {
    return {
      createEmptyDocument: (input) => this.deps.createEmptyDocument(input),
      loadDocument: async (docId) => {
        const doc = await this.deps.loadDocument(docId)
        if (!doc) {
          throw new Error(`Document ${docId} not found`)
        }
        return doc
      },
      saveDocument: async (doc) => {
        await this.deps.saveDocument(doc)
      },
      listRecent: async () => this.deps.listRecent(),
    }
  }

  private createEditorRuntime(): EditorRuntime {
    const documentCache = new Map<DocumentId, Document>()

    return {
      getDocument: (docId) => {
        if (documentCache.has(docId)) {
          return documentCache.get(docId) ?? null
        }

        const doc = this.deps.getCanvasDocument()
        if (doc && doc.id === docId) {
          documentCache.set(docId, doc)
          return doc
        }

        return null
      },
      setDocument: (doc) => {
        documentCache.set(doc.id, doc)
        this.deps.setCanvasDocument(doc)
        if (!this.activeDocumentId) {
          this.activeDocumentId = doc.id
        }
      },
      getSelection: () => this.deps.getCanvasSelection(),
      setSelection: (selection) => this.deps.setCanvasSelection(selection),
      exportFramePng: async (input) => this.deps.exportFramePng(input),
    }
  }
}
