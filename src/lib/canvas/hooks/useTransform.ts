import { useCallback, useRef } from 'react'
import { useStore } from '@tanstack/react-store'
import { canvasStore, canvasActions } from '../store'
import { createViewportTransform } from '../viewport'
import { screenToWorld } from '../utils/coordinates'
import { snapRect } from '../utils/snap'
import type { Rect, Point } from '../../schema'

export type TransformHandle = 
  | 'nw' | 'n' | 'ne'
  | 'w' | 'e'
  | 'sw' | 's' | 'se'
  | 'rotate'

export function useTransform() {
  const state = useStore(canvasStore)
  const transformStartRef = useRef<{
    handle: TransformHandle
    startRect: Rect
    startPoint: Point
    constrainAspect: boolean
  } | null>(null)

  const startTransform = useCallback((
    handle: TransformHandle,
    rect: Rect,
    screenPoint: Point,
    screenWidth: number,
    screenHeight: number,
    shiftKey: boolean = false
  ) => {
    const transform = createViewportTransform(
      state.panX,
      state.panY,
      state.zoom,
      screenWidth,
      screenHeight
    )

    const worldPoint = screenToWorld(screenPoint, transform)
    
    transformStartRef.current = {
      handle,
      startRect: rect,
      startPoint: worldPoint,
      constrainAspect: shiftKey,
    }

    canvasActions.setIsTransforming(true)
    canvasActions.setTransformOrigin({
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
    })
  }, [state.panX, state.panY, state.zoom])

  const updateTransform = useCallback((
    screenPoint: Point,
    screenWidth: number,
    screenHeight: number,
    altKey: boolean = false
  ): Rect | null => {
    if (!transformStartRef.current) return null

    const transform = createViewportTransform(
      state.panX,
      state.panY,
      state.zoom,
      screenWidth,
      screenHeight
    )

    const { handle, startRect, startPoint, constrainAspect } = transformStartRef.current
    const currentPoint = screenToWorld(screenPoint, transform)

    let newRect: Rect = { ...startRect }

    const deltaX = currentPoint.x - startPoint.x
    const deltaY = currentPoint.y - startPoint.y

    // Calculate transform based on handle
    switch (handle) {
      case 'nw':
        newRect.x = startRect.x + deltaX
        newRect.y = startRect.y + deltaY
        newRect.w = startRect.w - deltaX
        newRect.h = startRect.h - deltaY
        if (constrainAspect) {
          const aspect = startRect.w / startRect.h
          const newAspect = Math.abs(newRect.w / newRect.h)
          if (newAspect > aspect) {
            newRect.h = Math.abs(newRect.w / aspect) * Math.sign(newRect.h)
          } else {
            newRect.w = Math.abs(newRect.h * aspect) * Math.sign(newRect.w)
          }
        }
        break

      case 'n':
        newRect.y = startRect.y + deltaY
        newRect.h = startRect.h - deltaY
        break

      case 'ne':
        newRect.y = startRect.y + deltaY
        newRect.w = startRect.w + deltaX
        newRect.h = startRect.h - deltaY
        if (constrainAspect) {
          const aspect = startRect.w / startRect.h
          const newAspect = Math.abs(newRect.w / newRect.h)
          if (newAspect > aspect) {
            newRect.h = Math.abs(newRect.w / aspect) * Math.sign(newRect.h)
          } else {
            newRect.w = Math.abs(newRect.h * aspect) * Math.sign(newRect.w)
          }
        }
        break

      case 'w':
        newRect.x = startRect.x + deltaX
        newRect.w = startRect.w - deltaX
        break

      case 'e':
        newRect.w = startRect.w + deltaX
        break

      case 'sw':
        newRect.x = startRect.x + deltaX
        newRect.w = startRect.w - deltaX
        newRect.h = startRect.h + deltaY
        if (constrainAspect) {
          const aspect = startRect.w / startRect.h
          const newAspect = Math.abs(newRect.w / newRect.h)
          if (newAspect > aspect) {
            newRect.h = Math.abs(newRect.w / aspect) * Math.sign(newRect.h)
          } else {
            newRect.w = Math.abs(newRect.h * aspect) * Math.sign(newRect.w)
          }
        }
        break

      case 's':
        newRect.h = startRect.h + deltaY
        break

      case 'se':
        newRect.w = startRect.w + deltaX
        newRect.h = startRect.h + deltaY
        if (constrainAspect) {
          const aspect = startRect.w / startRect.h
          const newAspect = Math.abs(newRect.w / newRect.h)
          if (newAspect > aspect) {
            newRect.h = Math.abs(newRect.w / aspect) * Math.sign(newRect.h)
          } else {
            newRect.w = Math.abs(newRect.h * aspect) * Math.sign(newRect.w)
          }
        }
        break

      case 'rotate':
        // Rotation will be handled separately
        return null
    }

    // Ensure minimum size
    if (newRect.w < 10) {
      newRect.w = 10
      if (handle.includes('w')) {
        newRect.x = startRect.x + startRect.w - 10
      }
    }
    if (newRect.h < 10) {
      newRect.h = 10
      if (handle.includes('n')) {
        newRect.y = startRect.y + startRect.h - 10
      }
    }

    // Apply snap if enabled
    if (state.snap.enabled && state.snap.grid) {
      newRect = snapRect(newRect, {
        gridSize: state.grid.size,
        gridEnabled: state.grid.enabled,
      })
    }

    return newRect
  }, [state.panX, state.panY, state.zoom, state.snap, state.grid])

  const endTransform = useCallback(() => {
    transformStartRef.current = null
    canvasActions.setIsTransforming(false)
    canvasActions.setTransformOrigin(null)
  }, [])

  const moveSelection = useCallback((
    deltaX: number,
    deltaY: number,
    screenWidth: number,
    screenHeight: number
  ): { deltaX: number; deltaY: number } => {
    const transform = createViewportTransform(
      state.panX,
      state.panY,
      state.zoom,
      screenWidth,
      screenHeight
    )

    // Convert screen delta to world delta
    const worldDelta = {
      x: deltaX / state.zoom,
      y: deltaY / state.zoom,
    }

    return worldDelta
  }, [state.panX, state.panY, state.zoom])

  return {
    startTransform,
    updateTransform,
    endTransform,
    moveSelection,
    isTransforming: state.isTransforming,
    transformOrigin: state.transformOrigin,
  }
}
