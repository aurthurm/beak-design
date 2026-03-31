import { describe, expect, it } from 'vitest'

import {
  updateActiveToolState,
  updateInteractionModeState,
  updateIsCreatingState,
  updateIsPanningState,
  updateIsSelectingState,
  updateIsTransformingState,
  updateViewportState,
  updateZoomState,
  type InteractionMode,
  type ToolType,
} from './interaction-state'

type TestState = {
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
  untouched: string
}

const baseState: TestState = {
  panX: 0,
  panY: 0,
  zoom: 1,
  minZoom: 0.1,
  maxZoom: 10,
  interactionMode: 'move',
  activeTool: 'rect',
  isPanning: false,
  isSelecting: false,
  isTransforming: false,
  isCreating: false,
  untouched: 'keep-me',
}

describe('editor-core interaction state', () => {
  it('updates viewport and zoom with clamping', () => {
    expect(updateViewportState(baseState, 10, 20)).toEqual({
      ...baseState,
      panX: 10,
      panY: 20,
    })

    expect(updateViewportState(baseState, 10, 20, 999)).toEqual({
      ...baseState,
      panX: 10,
      panY: 20,
      zoom: 10,
    })

    expect(updateZoomState(baseState, 0.01)).toEqual({
      ...baseState,
      zoom: 0.1,
    })
  })

  it('updates interaction mode and tool semantics', () => {
    expect(updateInteractionModeState(baseState, 'resize')).toEqual({
      ...baseState,
      interactionMode: 'resize',
    })

    expect(updateActiveToolState(baseState, 'select')).toEqual({
      ...baseState,
      activeTool: 'select',
      interactionMode: 'select',
    })

    expect(updateActiveToolState(baseState, 'image')).toEqual({
      ...baseState,
      activeTool: 'image',
    })
  })

  it('updates boolean interaction flags without changing unrelated fields', () => {
    expect(updateIsCreatingState(baseState, true)).toEqual({
      ...baseState,
      isCreating: true,
    })

    expect(updateIsPanningState(baseState, true)).toEqual({
      ...baseState,
      isPanning: true,
      interactionMode: 'pan',
    })

    expect(updateIsPanningState({ ...baseState, interactionMode: 'rotate' }, false)).toEqual({
      ...baseState,
      interactionMode: 'rotate',
    })

    expect(updateIsSelectingState(baseState, true)).toEqual({
      ...baseState,
      isSelecting: true,
    })

    expect(updateIsTransformingState(baseState, true)).toEqual({
      ...baseState,
      isTransforming: true,
    })
  })
})
