import type {
  ToolContext,
  StorageAdapter,
  EditorRuntime,
  Actor,
  DocumentId,
  SelectionState,
  ExportFramePngInput,
  Document,
} from '../mcp-tools'
import { canvasStore, canvasActions } from '../canvas/store'
import { idGenerator } from '../db/id-generator'
import { getKonvaExporter } from '../export/konva-exporter'
import {
  getDocument,
  saveDocument as dbSaveDocument,
  getAllDocuments,
  createEmptyDocument as dbCreateEmptyDocument,
} from '../db/index.server'
import { createEmptyDocument } from '../canvas/document-init'
import type { FrameId } from '../schema'

/**
 * Tool Context Provider
 * Bridges TanStack AI and MCP tool system
 * Provides ToolContext for MCP tools
 */
export class ToolContextProvider {
  private activeDocumentId: DocumentId | null = null
  private actor: Actor = { kind: 'agent', agentName: 'claude' }

  /**
   * Create a ToolContext for MCP tools
   */
  createToolContext(): ToolContext {
    return {
      activeDocumentId: this.activeDocumentId,
      actor: this.actor,
      storage: this.createStorageAdapter(),
      editor: this.createEditorRuntime(),
      ids: idGenerator,
      nowISO: () => new Date().toISOString(),
    }
  }

  /**
   * Set active document ID
   */
  setActiveDocumentId(docId: DocumentId | null): void {
    this.activeDocumentId = docId
  }

  /**
   * Get active document ID
   */
  getActiveDocumentId(): DocumentId | null {
    return this.activeDocumentId
  }

  /**
   * Set actor (who is calling)
   */
  setActor(actor: Actor): void {
    this.actor = actor
  }

  /**
   * Create StorageAdapter implementation
   */
  private createStorageAdapter(): StorageAdapter {
    return {
      createEmptyDocument: (input: { name: string; docId: DocumentId; now: string }) => {
        // Use canvas document init for consistency
        const doc = createEmptyDocument(input.name)
        return {
          ...doc,
          id: input.docId,
          createdAt: input.now,
          updatedAt: input.now,
        }
      },

      loadDocument: async (docId: DocumentId): Promise<Document> => {
        // Try to load from database first
        const dbDoc = await getDocument(docId)
        if (dbDoc) {
          return dbDoc
        }

        // Fallback to canvas store
        const state = canvasStore.state
        if (state.document && state.document.id === docId) {
          return state.document
        }

        throw new Error(`Document ${docId} not found`)
      },

      saveDocument: async (doc: Document): Promise<void> => {
        // Save to database
        await dbSaveDocument(doc)
        // Also update canvas store
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
    }
  }

  /**
   * Create EditorRuntime implementation
   * Note: On server-side, canvasStore is not available, so we use storage adapter
   */
  private createEditorRuntime(): EditorRuntime {
    // In-memory document cache for server-side operations
    const documentCache = new Map<DocumentId, Document>()

    return {
      getDocument: (docId: DocumentId): Document | null => {
        // Check cache first
        if (documentCache.has(docId)) {
          return documentCache.get(docId)!
        }

        // On client-side, try canvas store
        if (typeof window !== 'undefined') {
          try {
            const state = canvasStore.state
            if (state.document && state.document.id === docId) {
              documentCache.set(docId, state.document)
              return state.document
            }
          } catch (error) {
            // canvasStore might not be available
          }
        }

        // For server-side, documents should be loaded into cache before use
        // This is handled by the storage adapter when documents are accessed
        return null
      },

      setDocument: (doc: Document): void => {
        // Update cache
        documentCache.set(doc.id, doc)

        // On client-side, update canvas store
        if (typeof window !== 'undefined') {
          try {
            canvasActions.setDocument(doc)
            // Update active document ID if it matches
            if (doc.id === this.activeDocumentId) {
              // Already set
            } else if (!this.activeDocumentId) {
              this.activeDocumentId = doc.id
            }
          } catch (error) {
            // canvasStore might not be available
          }
        }
      },

      getSelection: (): SelectionState => {
        // On client-side, get from canvas store
        if (typeof window !== 'undefined') {
          try {
            const state = canvasStore.state
            return state.selection
          } catch (error) {
            // canvasStore might not be available
          }
        }

        // Default selection for server-side
        return { pageId: null, selectedIds: [] }
      },

      setSelection: (sel: SelectionState): void => {
        // On client-side, update canvas store
        if (typeof window !== 'undefined') {
          try {
            canvasActions.setSelection(sel)
          } catch (error) {
            // canvasStore might not be available
          }
        }
      },

      exportFramePng: async (input: ExportFramePngInput): Promise<{ mimeType: 'image/png'; bytesBase64: string }> => {
        // Export only works on client-side
        if (typeof window === 'undefined') {
          throw new Error('Export is only available on client-side')
        }
        const exporter = getKonvaExporter()
        return exporter.exportFrameToPNG(input.frameId as FrameId, input.scale || 1)
      },
    } as EditorRuntime
  }
}

// Singleton instance
let toolContextProviderInstance: ToolContextProvider | null = null

export function getToolContextProvider(): ToolContextProvider {
  if (!toolContextProviderInstance) {
    toolContextProviderInstance = new ToolContextProvider()
    
    // Initialize active document from canvas store
    const state = canvasStore.state
    if (state.document) {
      toolContextProviderInstance.setActiveDocumentId(state.document.id)
    }

    // Subscribe to document changes
    canvasStore.subscribe((state) => {
      if (state.document) {
        toolContextProviderInstance!.setActiveDocumentId(state.document.id)
      } else {
        toolContextProviderInstance!.setActiveDocumentId(null)
      }
    })
  }
  return toolContextProviderInstance
}
