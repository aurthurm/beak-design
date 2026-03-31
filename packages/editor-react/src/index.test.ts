import { describe, expect, it } from 'vitest'

import {
  CanvasViewport,
  CreationPreview,
  FrameRenderer,
  FloatingCanvasToolbar,
  Grid,
  GuideLines,
  KonvaStage,
  LayerRenderer,
  Ruler,
  SelectionBox,
  TransformHandles,
} from './index'

describe('editor-react package exports', () => {
  it('exports the canvas shell components', () => {
    expect(typeof CanvasViewport).toBe('function')
    expect(typeof FloatingCanvasToolbar).toBe('function')
    expect(typeof KonvaStage).toBe('function')
  })

  it('exports the canvas render primitives', () => {
    expect(typeof Grid).toBe('function')
    expect(typeof GuideLines).toBe('function')
    expect(typeof FrameRenderer).toBe('function')
    expect(typeof LayerRenderer).toBe('function')
    expect(typeof SelectionBox).toBe('function')
    expect(typeof TransformHandles).toBe('function')
    expect(typeof CreationPreview).toBe('function')
    expect(typeof Ruler).toBe('function')
  })
})
