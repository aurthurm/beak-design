import { useCallback, useRef } from 'react'
import { useStore } from '@tanstack/react-store'
import { canvasStore, canvasActions } from '../store'
import { selectionActions } from '../selection'
import { createViewportTransform } from '../viewport'
import { screenToWorld, pointInRect, rectsIntersect } from '../utils/coordinates'
import type { FrameId, LayerId, Point, Rect } from '../../schema'

export function useSelection() {
  const state = useStore(canvasStore)
  const selectionBoxStartRef = useRef<Point | null>(null)
  const isSelectingRef = useRef(false)

  const select = useCallback((id: FrameId | LayerId, pageId?: string) => {
    selectionActions.select(id, pageId)
  }, [])

  const addToSelection = useCallback((id: FrameId | LayerId) => {
    selectionActions.add(id)
  }, [])

  const removeFromSelection = useCallback((id: FrameId | LayerId) => {
    selectionActions.remove(id)
  }, [])

  const toggleSelection = useCallback((id: FrameId | LayerId, pageId?: string) => {
    selectionActions.toggle(id, pageId)
  }, [])

  const clearSelection = useCallback(() => {
    selectionActions.clear()
  }, [])

  const startSelectionBox = useCallback((screenPoint: Point) => {
    selectionBoxStartRef.current = screenPoint
    isSelectingRef.current = true
    canvasActions.setIsSelecting(true)
  }, [])

  const updateSelectionBox = useCallback((
    screenPoint: Point,
    screenWidth: number,
    screenHeight: number
  ): Rect | null => {
    if (!selectionBoxStartRef.current || !isSelectingRef.current) return null

    const transform = createViewportTransform(
      state.panX,
      state.panY,
      state.zoom,
      screenWidth,
      screenHeight
    )

    const startWorld = screenToWorld(selectionBoxStartRef.current, transform)
    const endWorld = screenToWorld(screenPoint, transform)

    const rect: Rect = {
      x: Math.min(startWorld.x, endWorld.x),
      y: Math.min(startWorld.y, endWorld.y),
      w: Math.abs(endWorld.x - startWorld.x),
      h: Math.abs(endWorld.y - startWorld.y),
    }

    return rect
  }, [state.panX, state.panY, state.zoom])

  const endSelectionBox = useCallback((
    screenPoint: Point,
    screenWidth: number,
    screenHeight: number,
    frames: Record<FrameId, any>,
    layers: Record<LayerId, any>
  ) => {
    if (!selectionBoxStartRef.current || !isSelectingRef.current) {
      isSelectingRef.current = false
      canvasActions.setIsSelecting(false)
      return
    }

    const selectionRect = updateSelectionBox(screenPoint, screenWidth, screenHeight)
    
    if (selectionRect && selectionRect.w > 5 && selectionRect.h > 5) {
      // Find all layers and frames that intersect with selection box
      const selectedIds: Array<FrameId | LayerId> = []

      // Check frames
      for (const [frameId, frame] of Object.entries(frames)) {
        if (pointInRect({ x: frame.rect.x, y: frame.rect.y }, selectionRect) ||
            pointInRect({ x: frame.rect.x + frame.rect.w, y: frame.rect.y + frame.rect.h }, selectionRect)) {
          selectedIds.push(frameId as FrameId)
        }
      }

      // Check layers
      for (const [layerId, layer] of Object.entries(layers)) {
        const layerRect = layer.rect
        if (rectsIntersect(layerRect, selectionRect)) {
          selectedIds.push(layerId as LayerId)
        }
      }

      if (selectedIds.length > 0) {
        selectionActions.selectMultiple(selectedIds, state.selection.pageId ?? undefined)
      }
    }

    selectionBoxStartRef.current = null
    isSelectingRef.current = false
    canvasActions.setIsSelecting(false)
  }, [state.selection.pageId, updateSelectionBox])

  const hitTest = useCallback((
    screenPoint: Point,
    screenWidth: number,
    screenHeight: number,
    frames: Record<FrameId, any>,
    layers: Record<LayerId, any>
  ): FrameId | LayerId | null => {
    const transform = createViewportTransform(
      state.panX,
      state.panY,
      state.zoom,
      screenWidth,
      screenHeight
    )

    const worldPoint = screenToWorld(screenPoint, transform)

    // Check layers first (they're on top)
    for (const [layerId, layer] of Object.entries(layers).reverse()) {
      if (layer.flags?.hidden) continue
      
      const layerRect = layer.rect
      if (pointInRect(worldPoint, layerRect)) {
        return layerId as LayerId
      }
    }

    // Check frames
    for (const [frameId, frame] of Object.entries(frames).reverse()) {
      const frameRect = frame.rect
      if (pointInRect(worldPoint, frameRect)) {
        return frameId as FrameId
      }
    }

    return null
  }, [state.panX, state.panY, state.zoom])

  return {
    selection: state.selection,
    select,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection,
    startSelectionBox,
    updateSelectionBox,
    endSelectionBox,
    hitTest,
    isSelecting: state.isSelecting,
  }
}

// Helper function for rect intersection
function rectsIntersect(rect1: Rect, rect2: Rect): boolean {
  return (
    rect1.x < rect2.x + rect2.w &&
    rect1.x + rect1.w > rect2.x &&
    rect1.y < rect2.y + rect2.h &&
    rect1.y + rect1.h > rect2.y
  )
}
