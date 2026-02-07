import type { Document, PageId, FrameId, LayerId, Rect, Point } from '../schema'
import { canvasStore, canvasActions } from './store'
import { createFramePreset, createEmptyDocument } from './document-init'
import { screenToWorld, screenRectToWorld } from './utils/coordinates'
import { createViewportTransform } from './viewport'
import type { ToolType } from './store'
import { idGenerator } from '../db/id-generator'

/**
 * Create a frame at the specified world coordinates
 */
export function createFrameAt(
  screenPoint: Point,
  screenWidth: number,
  screenHeight: number,
  preset: 'mobile' | 'tablet' | 'desktop' = 'mobile'
): void
export function createFrameAt(
  screenRect: Rect,
  screenWidth: number,
  screenHeight: number,
  preset?: 'mobile' | 'tablet' | 'desktop'
): void
export function createFrameAt(
  screenPointOrRect: Point | Rect,
  screenWidth: number,
  screenHeight: number,
  preset: 'mobile' | 'tablet' | 'desktop' = 'mobile'
): void {
  const state = canvasStore.state
  if (!state.document || !state.activePageId) {
    // Create a default document if none exists
    const newDoc = createEmptyDocument('Untitled')
    canvasActions.setDocument(newDoc)
    canvasActions.setActivePage(newDoc.activePageId)
  }

  const document = canvasStore.state.document!
  const pageId = canvasStore.state.activePageId!

  const transform = createViewportTransform(
    state.panX,
    state.panY,
    state.zoom,
    screenWidth,
    screenHeight
  )

  // Handle both Point and Rect inputs
  let worldRect: Rect
  if ('x' in screenPointOrRect && 'y' in screenPointOrRect && !('w' in screenPointOrRect)) {
    // It's a Point
    const worldPoint = screenToWorld(screenPointOrRect as Point, transform)
    const framePreset = createFramePreset(preset, worldPoint.x, worldPoint.y)
    worldRect = framePreset.rect
  } else {
    // It's a Rect
    worldRect = screenRectToWorld(screenPointOrRect as Rect, transform)
  }

  const frameId = idGenerator.frame()
  const now = new Date().toISOString()

  // Create frame directly in document (simplified - will use command bus later)
  const framePreset = createFramePreset(preset, worldRect.x, worldRect.y)
  
  // Generate unique frame name by checking existing frames on the page
  const pageFrames = document.pages[pageId]?.frameIds || []
  const existingFrameNames = pageFrames
    .map((id) => document.frames[id]?.name)
    .filter(Boolean) as string[]
  
  let frameName = framePreset.name
  if (existingFrameNames.includes(frameName)) {
    // Find the highest number suffix
    const baseName = framePreset.name
    const namePattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: (\\d+))?$`)
    let maxNumber = 0
    
    existingFrameNames.forEach((name) => {
      const match = name.match(namePattern)
      if (match) {
        const num = match[1] ? parseInt(match[1], 10) : 1
        maxNumber = Math.max(maxNumber, num)
      }
    })
    
    frameName = `${baseName} ${maxNumber + 1}`
  }
  
  const newFrame = {
    id: frameId,
    pageId,
    name: frameName,
    platform: framePreset.platform,
    rect: worldRect,
    childLayerIds: [],
    provenance: {
      createdAt: now,
      createdBy: { kind: 'user' },
    },
  }

  const updatedDocument: Document = {
    ...document,
    updatedAt: now,
    pages: {
      ...document.pages,
      [pageId]: {
        ...document.pages[pageId],
        frameIds: [...document.pages[pageId].frameIds, frameId],
      },
    },
    frames: {
      ...document.frames,
      [frameId]: newFrame,
    },
  }

  canvasActions.setDocument(updatedDocument)
  canvasActions.setSelection({
    pageId,
    selectedIds: [frameId],
    bounds: undefined,
  })
  canvasActions.setActiveTool('select')
}

/**
 * Create a layer at the specified world coordinates
 */
export function createLayerAt(
  screenPoint: Point,
  screenWidth: number,
  screenHeight: number,
  tool: ToolType,
  frameId?: FrameId
): void
export function createLayerAt(
  screenRect: Rect,
  screenWidth: number,
  screenHeight: number,
  tool: ToolType,
  frameId?: FrameId
): void
export function createLayerAt(
  screenPointOrRect: Point | Rect,
  screenWidth: number,
  screenHeight: number,
  tool: ToolType,
  frameId?: FrameId
): void {
  const state = canvasStore.state
  if (!state.document || !state.activePageId) return

  const document = state.document
  const pageId = state.activePageId

  // Create transform first to convert coordinates
  const transform = createViewportTransform(
    state.panX,
    state.panY,
    state.zoom,
    screenWidth,
    screenHeight
  )

  // Handle both Point and Rect inputs
  let worldRect: Rect
  let worldPoint: Point
  if ('x' in screenPointOrRect && 'y' in screenPointOrRect && !('w' in screenPointOrRect)) {
    // It's a Point
    worldPoint = screenToWorld(screenPointOrRect as Point, transform)
    const defaultSizes: Record<ToolType, { w: number; h: number }> = {
      select: { w: 100, h: 100 },
      frame: { w: 400, h: 600 },
      rect: { w: 100, h: 100 },
      text: { w: 200, h: 50 },
      image: { w: 100, h: 100 },
      ellipse: { w: 100, h: 100 },
    }
    const size = defaultSizes[tool] || { w: 100, h: 100 }
    worldRect = {
      x: worldPoint.x - size.w / 2,
      y: worldPoint.y - size.h / 2,
      w: size.w,
      h: size.h,
    }
  } else {
    // It's a Rect
    worldRect = screenRectToWorld(screenPointOrRect as Rect, transform)
    worldPoint = { x: worldRect.x + worldRect.w / 2, y: worldRect.y + worldRect.h / 2 }
  }

  // Find frame to add layer to
  let targetFrameId = frameId
  let isInsideFrame = false
  if (!targetFrameId) {
    const page = document.pages[pageId]
    const frames = page.frameIds.map((id) => document.frames[id]).filter(Boolean)
    // Find frame containing the point (now using world coordinates)
    const containingFrame = frames.find(
      (frame) =>
        worldPoint.x >= frame.rect.x &&
        worldPoint.x <= frame.rect.x + frame.rect.w &&
        worldPoint.y >= frame.rect.y &&
        worldPoint.y <= frame.rect.y + frame.rect.h
    )
    
    if (containingFrame) {
      // Layer is inside a frame - assign to that frame
      targetFrameId = containingFrame.id
      isInsideFrame = true
    } else if (frames.length > 0) {
      // Layer is outside all frames - assign to first frame for schema compliance
      // but don't add to frame's childLayerIds so it appears at frame level in UI
      targetFrameId = frames[0].id
      isInsideFrame = false
    } else {
      // No frame exists, create a default one first
      createFrameAt(worldPoint, screenWidth, screenHeight, 'mobile')
      // Wait for next frame to try again
      setTimeout(() => {
        createLayerAt(screenPointOrRect, screenWidth, screenHeight, tool)
      }, 100)
      return
    }
  } else {
    // frameId was provided, check if layer is inside that frame
    const frame = document.frames[targetFrameId]
    if (frame) {
      isInsideFrame =
        worldPoint.x >= frame.rect.x &&
        worldPoint.x <= frame.rect.x + frame.rect.w &&
        worldPoint.y >= frame.rect.y &&
        worldPoint.y <= frame.rect.y + frame.rect.h
    }
  }
  const now = new Date().toISOString()

  const layerId = idGenerator.layer()

  const baseLayer = {
    id: layerId,
    type: tool,
    name: `${tool.charAt(0).toUpperCase() + tool.slice(1)} ${layerId.slice(-6)}`,
    parentId: null,
    frameId: targetFrameId,
    rect: worldRect,
    provenance: {
      createdAt: now,
      createdBy: { kind: 'user' },
    },
  }

  let layer: any

  switch (tool) {
    case 'rect':
      layer = {
        ...baseLayer,
        type: 'rect',
        style: {
          fill: { kind: 'solid', color: { literal: { format: 'hex', hex: '#3b82f6' } } },
          stroke: { width: 1, color: { literal: { format: 'hex', hex: '#1e40af' } } },
          radius: 0,
        },
      }
      break
    case 'text':
      layer = {
        ...baseLayer,
        type: 'text',
        text: 'Text',
        typography: {
          literal: {
            fontFamily: 'Arial',
            fontWeight: 400,
            fontSize: 16,
            lineHeight: 1.2,
          },
        },
        color: { literal: { format: 'hex', hex: '#000000' } },
        align: 'left',
        verticalAlign: 'top',
      }
      break
    case 'ellipse':
      layer = {
        ...baseLayer,
        type: 'ellipse',
        style: {
          fill: { kind: 'solid', color: { literal: { format: 'hex', hex: '#3b82f6' } } },
          stroke: { width: 1, color: { literal: { format: 'hex', hex: '#1e40af' } } },
        },
      }
      break
    case 'image':
      layer = {
        ...baseLayer,
        type: 'image',
        assetId: '', // Will need to be set when image is uploaded
        style: {
          opacity: 1,
        },
      }
      break
    default:
      return // Don't create for select or frame tools
  }

  const frame = document.frames[targetFrameId]
  const updatedDocument: Document = {
    ...document,
    updatedAt: now,
    frames: {
      ...document.frames,
      // Only add layer to frame's childLayerIds if it's inside the frame
      ...(isInsideFrame ? {
        [targetFrameId]: {
          ...frame,
          childLayerIds: [...frame.childLayerIds, layerId],
        },
      } : {}),
    },
    layers: {
      ...document.layers,
      [layerId]: layer,
    },
  }

  canvasActions.setDocument(updatedDocument)
  canvasActions.setSelection({
    pageId,
    selectedIds: [layerId],
    bounds: undefined,
  })
  canvasActions.setActiveTool('select')
}

