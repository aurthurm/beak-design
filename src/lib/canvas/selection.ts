import type { FrameId, LayerId, Rect, SelectionState } from '../schema'
import { canvasStore, canvasActions } from './store'

/**
 * Selection management utilities
 */
export const selectionActions = {
  /**
   * Select a single item (replaces current selection)
   */
  select: (id: FrameId | LayerId, pageId?: string) => {
    canvasActions.setSelection({
      pageId: pageId ?? canvasStore.state.selection.pageId,
      selectedIds: [id],
      bounds: undefined, // Will be calculated from selected item
    })
  },

  /**
   * Add item to selection (multi-select)
   */
  add: (id: FrameId | LayerId) => {
    canvasActions.addToSelection([id])
  },

  /**
   * Remove item from selection
   */
  remove: (id: FrameId | LayerId) => {
    canvasActions.removeFromSelection([id])
  },

  /**
   * Toggle item in selection
   */
  toggle: (id: FrameId | LayerId, pageId?: string) => {
    const state = canvasStore.state
    if (state.selection.selectedIds.includes(id)) {
      selectionActions.remove(id)
    } else {
      if (state.selection.selectedIds.length === 0 && pageId) {
        canvasActions.setSelection({
          pageId,
          selectedIds: [id],
          bounds: undefined,
        })
      } else {
        selectionActions.add(id)
      }
    }
  },

  /**
   * Select multiple items
   */
  selectMultiple: (ids: Array<FrameId | LayerId>, pageId?: string) => {
    canvasActions.setSelection({
      pageId: pageId ?? canvasStore.state.selection.pageId,
      selectedIds: ids,
      bounds: undefined,
    })
  },

  /**
   * Clear selection
   */
  clear: () => {
    canvasActions.clearSelection()
  },

  /**
   * Update selection bounds (calculated from selected items)
   */
  updateBounds: (bounds: Rect | undefined) => {
    const state = canvasStore.state
    canvasActions.setSelection({
      ...state.selection,
      bounds,
    })
  },
}

/**
 * Calculate bounding box for selected items
 */
export function calculateSelectionBounds(
  selectedIds: Array<FrameId | LayerId>,
  document: { frames: Record<FrameId, any>; layers: Record<LayerId, any> }
): Rect | undefined {
  if (selectedIds.length === 0) return undefined

  const items = selectedIds
    .map((id) => {
      // Check if it's a frame or layer
      if (document.frames[id as FrameId]) {
        return document.frames[id as FrameId]
      }
      if (document.layers[id as LayerId]) {
        return document.layers[id as LayerId]
      }
      return null
    })
    .filter(Boolean)

  if (items.length === 0) return undefined

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const item of items) {
    if (item.rect) {
      minX = Math.min(minX, item.rect.x)
      minY = Math.min(minY, item.rect.y)
      maxX = Math.max(maxX, item.rect.x + item.rect.w)
      maxY = Math.max(maxY, item.rect.y + item.rect.h)
    }
  }

  if (minX === Infinity) return undefined

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  }
}
