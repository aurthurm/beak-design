import type { FrameId, LayerId, Rect, SelectionState } from '../schema'
import {
  addToSelection,
  calculateSelectionBounds,
  clearSelection,
  removeFromSelection,
  selectMultiple,
  selectSingle,
  toggleSelection,
} from '../../../packages/editor-core/src'
import { canvasStore, canvasActions } from './store'

/**
 * Selection management utilities
 */
export const selectionActions = {
  /**
   * Select a single item (replaces current selection)
   */
  select: (id: FrameId | LayerId, pageId?: string) => {
    canvasActions.setSelection(selectSingle(canvasStore.state.selection, id, pageId))
  },

  /**
   * Add item to selection (multi-select)
   */
  add: (id: FrameId | LayerId) => {
    canvasActions.setSelection(addToSelection(canvasStore.state.selection, [id]))
  },

  /**
   * Remove item from selection
   */
  remove: (id: FrameId | LayerId) => {
    canvasActions.setSelection(removeFromSelection(canvasStore.state.selection, [id]))
  },

  /**
   * Toggle item in selection
   */
  toggle: (id: FrameId | LayerId, pageId?: string) => {
    canvasActions.setSelection(toggleSelection(canvasStore.state.selection, id, pageId))
  },

  /**
   * Select multiple items
   */
  selectMultiple: (ids: Array<FrameId | LayerId>, pageId?: string) => {
    canvasActions.setSelection(selectMultiple(canvasStore.state.selection, ids, pageId))
  },

  /**
   * Clear selection
   */
  clear: () => {
    canvasActions.setSelection(clearSelection(canvasStore.state.selection))
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

export { calculateSelectionBounds }
