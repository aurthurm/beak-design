import { canvasActions, canvasStore } from '../canvas/store'
import { createEmptyDocument } from '../canvas/document-init'
import { getAllDocuments, getDocument, saveDocument as dbSaveDocument } from '../db/index.server'
import { idGenerator } from '../db/id-generator'
import { getKonvaExporter } from '../export/konva-exporter'
import type { Actor, Document, DocumentId, ExportFramePngInput, SelectionState } from '../mcp-tools'
import { ToolContextProvider as PackageToolContextProvider } from '../../../packages/ai-core/src/tool-context-provider'
import type { ToolContextProviderDeps } from '../../../packages/ai-core/src/tool-context-provider'

function createDeps(): ToolContextProviderDeps {
  return {
    ids: idGenerator,
    nowISO: () => new Date().toISOString(),
    createEmptyDocument: (input: { name: string; docId: DocumentId; now: string }) => {
      const doc = createEmptyDocument(input.name)
      return {
        ...doc,
        id: input.docId,
        createdAt: input.now,
        updatedAt: input.now,
      }
    },
    loadDocument: async (docId: DocumentId): Promise<Document | null> => {
      const dbDoc = await getDocument(docId)
      if (dbDoc) {
        return dbDoc
      }

      const state = canvasStore.state
      if (state.document && state.document.id === docId) {
        return state.document
      }

      return null
    },
    saveDocument: async (doc: Document): Promise<void> => {
      await dbSaveDocument(doc)
      canvasActions.setDocument(doc)
    },
    listRecent: async () => {
      const docs = await getAllDocuments()
      return docs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        updatedAt: doc.updatedAt,
      }))
    },
    getCanvasDocument: () => {
      try {
        return canvasStore.state.document ?? null
      } catch {
        return null
      }
    },
    setCanvasDocument: (doc: Document) => {
      canvasActions.setDocument(doc)
    },
    getCanvasSelection: (): SelectionState => {
      try {
        return canvasStore.state.selection
      } catch {
        return { pageId: null, selectedIds: [] }
      }
    },
    setCanvasSelection: (selection: SelectionState) => {
      canvasActions.setSelection(selection)
    },
    exportFramePng: async (input: ExportFramePngInput) => {
      const exporter = getKonvaExporter()
      return exporter.exportFrameToPNG(input.frameId as never, input.scale || 1)
    },
  }
}

export class ToolContextProvider extends PackageToolContextProvider {
  constructor() {
    super(createDeps())
  }
}

let toolContextProviderInstance: ToolContextProvider | null = null

export function getToolContextProvider(): ToolContextProvider {
  if (!toolContextProviderInstance) {
    toolContextProviderInstance = new ToolContextProvider()

    const state = canvasStore.state
    if (state.document) {
      toolContextProviderInstance.setActiveDocumentId(state.document.id)
    }

    canvasStore.subscribe((storeState) => {
      if (storeState.document) {
        toolContextProviderInstance!.setActiveDocumentId(storeState.document.id)
      } else {
        toolContextProviderInstance!.setActiveDocumentId(null)
      }
    })
  }

  return toolContextProviderInstance
}

export type { Actor, Document, DocumentId, ExportFramePngInput, SelectionState }
