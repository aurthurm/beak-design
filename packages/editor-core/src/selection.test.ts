import { describe, expect, it } from 'vitest'

import type { FrameId, LayerId } from '../../schema/src'
import {
  addToSelection,
  clearSelection,
  createSelectionState,
  removeFromSelection,
  selectMultiple,
  selectSingle,
  toggleSelection,
} from './selection'

describe('editor-core selection', () => {
  const frameId = 'frame-1' as FrameId
  const layerId = 'layer-1' as LayerId

  it('creates and replaces selection state', () => {
    const selection = createSelectionState('page-1', [frameId], { x: 1, y: 2, w: 3, h: 4 })
    expect(selection).toEqual({
      pageId: 'page-1',
      selectedIds: [frameId],
      bounds: { x: 1, y: 2, w: 3, h: 4 },
    })

    expect(selectSingle(selection, layerId, 'page-2')).toEqual({
      pageId: 'page-2',
      selectedIds: [layerId],
      bounds: undefined,
    })

    expect(selectMultiple(selection, [frameId, layerId])).toEqual({
      pageId: 'page-1',
      selectedIds: [frameId, layerId],
      bounds: undefined,
    })
  })

  it('adds, removes, clears, and toggles ids immutably', () => {
    const base = createSelectionState('page-1', [frameId])

    expect(addToSelection(base, [layerId])).toEqual({
      pageId: 'page-1',
      selectedIds: [frameId, layerId],
      bounds: undefined,
    })

    expect(removeFromSelection(addToSelection(base, [layerId]), [frameId])).toEqual({
      pageId: 'page-1',
      selectedIds: [layerId],
      bounds: undefined,
    })

    expect(clearSelection({ ...base, bounds: { x: 1, y: 1, w: 2, h: 2 } })).toEqual({
      pageId: 'page-1',
      selectedIds: [],
      bounds: undefined,
    })

    expect(toggleSelection(base, frameId)).toEqual({
      pageId: 'page-1',
      selectedIds: [],
      bounds: undefined,
    })

    expect(toggleSelection(createSelectionState(null, []), layerId, 'page-2')).toEqual({
      pageId: 'page-2',
      selectedIds: [layerId],
      bounds: undefined,
    })
  })
})
