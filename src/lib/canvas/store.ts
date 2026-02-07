import { Store } from '@tanstack/store'
import type { Document, PageId, FrameId, LayerId, SelectionState } from '../schema'

export type InteractionMode = 'select' | 'move' | 'resize' | 'rotate' | 'pan'
export type ToolType = 'select' | 'pan' | 'frame' | 'rect' | 'text' | 'image' | 'ellipse'

export type GridSettings = {
  enabled: boolean
  size: number
  color: string
  opacity: number
}

export type SnapSettings = {
  enabled: boolean
  grid: boolean
  guides: boolean
  threshold: number
}

export type GuideLine = {
  id: string
  type: 'vertical' | 'horizontal'
  position: number // World coordinate position
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export type CanvasState = {
  // Document state
  document: Document | null
  activePageId: PageId | null
  
  // Save status
  saveStatus: SaveStatus | null
  lastSavedAt: string | null
  currentFilePath: string | null
  
  // Viewport state
  panX: number
  panY: number
  zoom: number
  minZoom: number
  maxZoom: number
  
  // Selection state
  selection: SelectionState
  
  // Interaction state
  interactionMode: InteractionMode
  activeTool: ToolType
  isPanning: boolean
  isSelecting: boolean
  isTransforming: boolean
  isCreating: boolean
  
  // Grid & snap settings
  grid: GridSettings
  snap: SnapSettings
  
  // Guide lines
  guideLines: GuideLine[]
  temporaryGuideLine: GuideLine | null // Preview guide line during drag
  
  // Transform state
  transformOrigin: { x: number; y: number } | null
}

const initialState: CanvasState = {
  document: null,
  activePageId: null,
  saveStatus: null,
  lastSavedAt: null,
  currentFilePath: null,
  panX: 0,
  panY: 0,
  zoom: 1,
  minZoom: 0.1,
  maxZoom: 10,
  selection: {
    pageId: null,
    selectedIds: [],
    bounds: undefined,
  },
  interactionMode: 'select',
  activeTool: 'select',
  isPanning: false,
  isSelecting: false,
  isTransforming: false,
  isCreating: false,
  grid: {
    enabled: true,
    size: 20,
    color: '#e0e0e0',
    opacity: 0.5,
  },
  snap: {
    enabled: true,
    grid: true,
    guides: false,
    threshold: 5,
  },
  guideLines: [],
  temporaryGuideLine: null,
  transformOrigin: null,
}

export const canvasStore = new Store<CanvasState>(initialState)

// Helper functions to update canvas state
export const canvasActions = {
  setDocument: (document: Document | null) => {
    canvasStore.setState((state) => {
      // When loading a new document (or first document), use document's activePageId
      // When updating existing document, preserve current activePageId to prevent
      // switching pages during operations like dragging
      const isNewDocument = !state.document || state.document.id !== document?.id
      const isDocumentUpdate = !isNewDocument && state.document && document
      const newActivePageId = isNewDocument 
        ? (document?.activePageId ?? null)
        : (state.activePageId ?? document?.activePageId ?? null)
      
      // Save snapshot for undo/redo (unless we're already undoing/redoing)
      if (isDocumentUpdate && document) {
        const { getUndoRedoManager } = require('./undo-redo')
        const undoRedo = getUndoRedoManager()
        // Only save if not already in undo/redo operation
        if (!undoRedo.isUndoing && !undoRedo.isRedoing) {
          undoRedo.saveSnapshot()
        }
      }
      
      return {
        ...state,
        document,
        activePageId: newActivePageId,
        // Mark as unsaved if document was updated (not a new document)
        saveStatus: isDocumentUpdate && state.currentFilePath ? 'unsaved' : state.saveStatus,
      }
    })
  },
  
  setActivePage: (pageId: PageId | null) => {
    canvasStore.setState((state) => {
      // Update document's activePageId to keep it in sync
      const updatedDocument = state.document
        ? {
            ...state.document,
            activePageId: pageId,
          }
        : null
      
      // Clear selection when switching pages to prevent showing controls from previous page
      return {
        ...state,
        document: updatedDocument,
        activePageId: pageId,
        selection: {
          pageId,
          selectedIds: [],
          bounds: undefined,
        },
      }
    })
  },
  
  setViewport: (panX: number, panY: number, zoom?: number) => {
    canvasStore.setState((state) => ({
      ...state,
      panX,
      panY,
      zoom: zoom !== undefined ? Math.max(state.minZoom, Math.min(state.maxZoom, zoom)) : state.zoom,
    }))
  },
  
  setZoom: (zoom: number) => {
    canvasStore.setState((state) => ({
      ...state,
      zoom: Math.max(state.minZoom, Math.min(state.maxZoom, zoom)),
    }))
  },
  
  setSelection: (selection: SelectionState) => {
    canvasStore.setState((state) => ({
      ...state,
      selection,
    }))
  },
  
  addToSelection: (ids: Array<FrameId | LayerId>) => {
    canvasStore.setState((state) => ({
      ...state,
      selection: {
        ...state.selection,
        selectedIds: [...new Set([...state.selection.selectedIds, ...ids])],
      },
    }))
  },
  
  removeFromSelection: (ids: Array<FrameId | LayerId>) => {
    canvasStore.setState((state) => ({
      ...state,
      selection: {
        ...state.selection,
        selectedIds: state.selection.selectedIds.filter((id) => !ids.includes(id)),
      },
    }))
  },
  
  clearSelection: () => {
    canvasStore.setState((state) => ({
      ...state,
      selection: {
        ...state.selection,
        selectedIds: [],
        bounds: undefined,
      },
    }))
  },
  
  setInteractionMode: (mode: InteractionMode) => {
    canvasStore.setState((state) => ({
      ...state,
      interactionMode: mode,
    }))
  },
  
  setActiveTool: (tool: ToolType) => {
    canvasStore.setState((state) => ({
      ...state,
      activeTool: tool,
      interactionMode: tool === 'select' ? 'select' : state.interactionMode,
    }))
  },
  
  setIsCreating: (isCreating: boolean) => {
    canvasStore.setState((state) => ({
      ...state,
      isCreating,
    }))
  },
  
  setIsPanning: (isPanning: boolean) => {
    canvasStore.setState((state) => ({
      ...state,
      isPanning,
      interactionMode: isPanning ? 'pan' : state.interactionMode,
    }))
  },
  
  setIsSelecting: (isSelecting: boolean) => {
    canvasStore.setState((state) => ({
      ...state,
      isSelecting,
    }))
  },
  
  setIsTransforming: (isTransforming: boolean) => {
    canvasStore.setState((state) => ({
      ...state,
      isTransforming,
    }))
  },
  
  setGrid: (grid: Partial<GridSettings>) => {
    canvasStore.setState((state) => ({
      ...state,
      grid: { ...state.grid, ...grid },
    }))
  },
  
  setSnap: (snap: Partial<SnapSettings>) => {
    canvasStore.setState((state) => ({
      ...state,
      snap: { ...state.snap, ...snap },
    }))
  },
  
  setTransformOrigin: (origin: { x: number; y: number } | null) => {
    canvasStore.setState((state) => ({
      ...state,
      transformOrigin: origin,
    }))
  },
  
  reorderLayers: (frameId: FrameId, newOrder: LayerId[]) => {
    canvasStore.setState((state) => {
      if (!state.document) return state
      
      const frame = state.document.frames[frameId]
      if (!frame) return state
      
      const updatedDocument = {
        ...state.document,
        updatedAt: new Date().toISOString(),
        frames: {
          ...state.document.frames,
          [frameId]: {
            ...frame,
            childLayerIds: newOrder,
          },
        },
      }
      
      return {
        ...state,
        document: updatedDocument,
      }
    })
  },
  
  updatePageName: (pageId: PageId, name: string) => {
    canvasStore.setState((state) => {
      if (!state.document) return state
      
      const page = state.document.pages[pageId]
      if (!page) return state
      
      const updatedDocument = {
        ...state.document,
        updatedAt: new Date().toISOString(),
        pages: {
          ...state.document.pages,
          [pageId]: {
            ...page,
            name,
            provenance: {
              ...page.provenance,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      }
      
      return {
        ...state,
        document: updatedDocument,
      }
    })
  },
  
  deletePage: (pageId: PageId) => {
    canvasStore.setState((state) => {
      if (!state.document) return state
      
      const page = state.document.pages[pageId]
      if (!page) return state
      
      // Collect all frames and layers to delete
      const frameIdsToDelete = new Set<FrameId>(page.frameIds)
      const layerIdsToDelete = new Set<LayerId>()
      
      // Recursively collect all nested layers
      const collectNestedLayers = (layerId: LayerId) => {
        if (layerIdsToDelete.has(layerId)) return // Already processed
        layerIdsToDelete.add(layerId)
        
        const layer = state.document.layers[layerId]
        if (layer && layer.type === 'group' && layer.children) {
          // Recursively collect children of group layers
          for (const childId of layer.children) {
            collectNestedLayers(childId)
          }
        }
      }
      
      // Collect all layers from all frames
      for (const frameId of frameIdsToDelete) {
        const frame = state.document.frames[frameId]
        if (frame) {
          // Add all child layers and recursively collect their children
          for (const layerId of frame.childLayerIds) {
            collectNestedLayers(layerId)
          }
        }
      }
      
      // Create new document without the deleted page, frames, and layers
      const { [pageId]: deletedPage, ...remainingPages } = state.document.pages
      
      const remainingFrames = { ...state.document.frames }
      for (const frameId of frameIdsToDelete) {
        delete remainingFrames[frameId]
      }
      
      const remainingLayers = { ...state.document.layers }
      for (const layerId of layerIdsToDelete) {
        delete remainingLayers[layerId]
      }
      
      // Determine new active page if the deleted page was active
      let newActivePageId = state.activePageId
      if (state.activePageId === pageId) {
        const remainingPageIds = Object.keys(remainingPages) as PageId[]
        newActivePageId = remainingPageIds.length > 0 ? remainingPageIds[0] : null
      }
      
      const updatedDocument = {
        ...state.document,
        updatedAt: new Date().toISOString(),
        activePageId: newActivePageId,
        pages: remainingPages,
        frames: remainingFrames,
        layers: remainingLayers,
      }
      
      return {
        ...state,
        document: updatedDocument,
        activePageId: newActivePageId,
        selection: {
          ...state.selection,
          pageId: newActivePageId,
        },
      }
    })
  },
  
  toggleLayerVisibility: (layerId: LayerId) => {
    canvasStore.setState((state) => {
      if (!state.document) return state
      
      const layer = state.document.layers[layerId]
      if (!layer) return state
      
      const currentHidden = layer.flags?.hidden ?? false
      const updatedDocument = {
        ...state.document,
        updatedAt: new Date().toISOString(),
        layers: {
          ...state.document.layers,
          [layerId]: {
            ...layer,
            flags: {
              ...layer.flags,
              hidden: !currentHidden,
            },
          },
        },
      }
      
      return {
        ...state,
        document: updatedDocument,
      }
    })
  },
  
  toggleLayerLock: (layerId: LayerId) => {
    canvasStore.setState((state) => {
      if (!state.document) return state
      
      const layer = state.document.layers[layerId]
      if (!layer) return state
      
      const currentLocked = layer.flags?.locked ?? false
      const updatedDocument = {
        ...state.document,
        updatedAt: new Date().toISOString(),
        layers: {
          ...state.document.layers,
          [layerId]: {
            ...layer,
            flags: {
              ...layer.flags,
              locked: !currentLocked,
            },
          },
        },
      }
      
      return {
        ...state,
        document: updatedDocument,
      }
    })
  },
  
  toggleFrameVisibility: (frameId: FrameId) => {
    canvasStore.setState((state) => {
      if (!state.document) return state
      
      const frame = state.document.frames[frameId]
      if (!frame) return state
      
      const currentHidden = frame.flags?.hidden ?? false
      const updatedDocument = {
        ...state.document,
        updatedAt: new Date().toISOString(),
        frames: {
          ...state.document.frames,
          [frameId]: {
            ...frame,
            flags: {
              ...frame.flags,
              hidden: !currentHidden,
            },
          },
        },
      }
      
      return {
        ...state,
        document: updatedDocument,
      }
    })
  },
  
  toggleFrameLock: (frameId: FrameId) => {
    canvasStore.setState((state) => {
      if (!state.document) return state
      
      const frame = state.document.frames[frameId]
      if (!frame) return state
      
      const currentLocked = frame.flags?.locked ?? false
      const updatedDocument = {
        ...state.document,
        updatedAt: new Date().toISOString(),
        frames: {
          ...state.document.frames,
          [frameId]: {
            ...frame,
            flags: {
              ...frame.flags,
              locked: !currentLocked,
            },
          },
        },
      }
      
      return {
        ...state,
        document: updatedDocument,
      }
    })
  },
  
  addGuideLine: (guideLine: GuideLine) => {
    canvasStore.setState((state) => ({
      ...state,
      guideLines: [...state.guideLines, guideLine],
    }))
  },
  
  removeGuideLine: (id: string) => {
    canvasStore.setState((state) => ({
      ...state,
      guideLines: state.guideLines.filter((gl) => gl.id !== id),
    }))
  },
  
  clearGuideLines: () => {
    canvasStore.setState((state) => ({
      ...state,
      guideLines: [],
    }))
  },
  
  setTemporaryGuideLine: (guideLine: GuideLine | null) => {
    canvasStore.setState((state) => ({
      ...state,
      temporaryGuideLine: guideLine,
    }))
  },
  
  updateGuideLine: (id: string, position: number) => {
    canvasStore.setState((state) => ({
      ...state,
      guideLines: state.guideLines.map((gl) =>
        gl.id === id ? { ...gl, position } : gl
      ),
    }))
  },

  setSaveStatus: (status: SaveStatus | null) => {
    canvasStore.setState((state) => ({
      ...state,
      saveStatus: status,
      lastSavedAt: status === 'saved' ? new Date().toISOString() : state.lastSavedAt,
    }))
  },

  setCurrentFilePath: (path: string | null) => {
    canvasStore.setState((state) => ({
      ...state,
      currentFilePath: path,
    }))
  },

  markDocumentDirty: () => {
    canvasStore.setState((state) => {
      // Only mark as unsaved if we have a document and it's not already saving
      if (state.document && state.saveStatus !== 'saving') {
        return {
          ...state,
          saveStatus: 'unsaved',
        }
      }
      return state
    })
  },

  updateDocumentName: (name: string, workspacePath?: string | null) => {
    canvasStore.setState((state) => {
      if (!state.document) return state

      console.log('[updateDocumentName] Updating document name:')
      console.log('  - New name:', name)
      console.log('  - Workspace path provided:', workspacePath)
      console.log('  - Current file path:', state.currentFilePath)

      const updatedDocument = {
        ...state.document,
        name,
        updatedAt: new Date().toISOString(),
      }

      // Update file path to match new name
      let newFilePath: string | null = null
      const separator = typeof window !== 'undefined' && navigator.platform.toLowerCase().includes('win') ? '\\' : '/'
      const filename = name.endsWith('.beaki') ? name : `${name}.beaki`
      
      // If workspace is provided, use it (this takes priority)
      if (workspacePath) {
        newFilePath = workspacePath + separator + filename
        console.log('  - Path calculation: Using workspace path')
        console.log('  - Calculated path:', newFilePath)
      } else if (state.currentFilePath) {
        // If we have an existing path, preserve the directory structure
        const pathParts = state.currentFilePath.split(separator)
        pathParts[pathParts.length - 1] = filename
        newFilePath = pathParts.join(separator)
        console.log('  - Path calculation: Preserving directory structure')
        console.log('  - Original path parts:', pathParts)
        console.log('  - Calculated path:', newFilePath)
      } else {
        // If no current path and no workspace, create one from default Documents/Beak Designs
        if (typeof window !== 'undefined') {
          const platform = navigator.platform.toLowerCase()
          const root = platform.includes('win')
            ? 'C:' + separator + 'Users' + separator + 'User' + separator + 'Documents' + separator + 'Beak Designs'
            : platform.includes('mac')
            ? separator + 'Users' + separator + 'user' + separator + 'Documents' + separator + 'Beak Designs'
            : separator + 'home' + separator + 'user' + separator + 'Documents' + separator + 'Beak Designs'
          newFilePath = root + separator + filename
          console.log('  - Path calculation: Using default Documents/Beak Designs')
          console.log('  - Platform:', platform)
          console.log('  - Root directory:', root)
          console.log('  - Calculated path:', newFilePath)
          console.log('  - ⚠️  NOTE: This is a virtual path. Actual save location depends on Tauri environment.')
        } else {
          newFilePath = filename
          console.log('  - Path calculation: No window object, using filename only')
          console.log('  - Calculated path:', newFilePath)
        }
      }

      console.log('  - Final new file path:', newFilePath)

      return {
        ...state,
        document: updatedDocument,
        currentFilePath: newFilePath,
        saveStatus: 'unsaved',
      }
    })
  },
}
