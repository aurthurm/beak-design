export type InteractionMode = 'select' | 'move' | 'resize' | 'rotate' | 'pan'
export type ToolType =
  | 'select'
  | 'pan'
  | 'frame'
  | 'rect'
  | 'text'
  | 'image'
  | 'ellipse'

type InteractionStateFields = {
  panX: number
  panY: number
  zoom: number
  minZoom: number
  maxZoom: number
  interactionMode: InteractionMode
  activeTool: ToolType
  isPanning: boolean
  isSelecting: boolean
  isTransforming: boolean
  isCreating: boolean
}

function clampZoom(zoom: number, minZoom: number, maxZoom: number): number {
  return Math.max(minZoom, Math.min(maxZoom, zoom))
}

export function updateViewportState<T extends InteractionStateFields>(
  state: T,
  panX: number,
  panY: number,
  zoom?: number
): T {
  return {
    ...state,
    panX,
    panY,
    zoom: zoom !== undefined ? clampZoom(zoom, state.minZoom, state.maxZoom) : state.zoom,
  }
}

export function updateZoomState<T extends InteractionStateFields>(
  state: T,
  zoom: number
): T {
  return {
    ...state,
    zoom: clampZoom(zoom, state.minZoom, state.maxZoom),
  }
}

export function updateInteractionModeState<T extends InteractionStateFields>(
  state: T,
  mode: InteractionMode
): T {
  return {
    ...state,
    interactionMode: mode,
  }
}

export function updateActiveToolState<T extends InteractionStateFields>(
  state: T,
  tool: ToolType
): T {
  return {
    ...state,
    activeTool: tool,
    interactionMode: tool === 'select' ? 'select' : state.interactionMode,
  }
}

export function updateIsCreatingState<T extends InteractionStateFields>(
  state: T,
  isCreating: boolean
): T {
  return {
    ...state,
    isCreating,
  }
}

export function updateIsPanningState<T extends InteractionStateFields>(
  state: T,
  isPanning: boolean
): T {
  return {
    ...state,
    isPanning,
    interactionMode: isPanning ? 'pan' : state.interactionMode,
  }
}

export function updateIsSelectingState<T extends InteractionStateFields>(
  state: T,
  isSelecting: boolean
): T {
  return {
    ...state,
    isSelecting,
  }
}

export function updateIsTransformingState<T extends InteractionStateFields>(
  state: T,
  isTransforming: boolean
): T {
  return {
    ...state,
    isTransforming,
  }
}
