import type { FrameId, LayerId, Rect, SelectionState } from '../../schema/src'

export function createSelectionState(
  pageId: string | null,
  selectedIds: Array<FrameId | LayerId> = [],
  bounds: Rect | undefined = undefined
): SelectionState {
  return {
    pageId,
    selectedIds,
    bounds,
  }
}

export function selectSingle(
  selection: SelectionState,
  id: FrameId | LayerId,
  pageId?: string
): SelectionState {
  return createSelectionState(pageId ?? selection.pageId, [id], undefined)
}

export function selectMultiple(
  selection: SelectionState,
  ids: Array<FrameId | LayerId>,
  pageId?: string
): SelectionState {
  return createSelectionState(pageId ?? selection.pageId, ids, undefined)
}

export function addToSelection(
  selection: SelectionState,
  ids: Array<FrameId | LayerId>
): SelectionState {
  return {
    ...selection,
    selectedIds: [...new Set([...selection.selectedIds, ...ids])],
  }
}

export function removeFromSelection(
  selection: SelectionState,
  ids: Array<FrameId | LayerId>
): SelectionState {
  return {
    ...selection,
    selectedIds: selection.selectedIds.filter((id) => !ids.includes(id)),
  }
}

export function clearSelection(selection: SelectionState): SelectionState {
  return {
    ...selection,
    selectedIds: [],
    bounds: undefined,
  }
}

export function toggleSelection(
  selection: SelectionState,
  id: FrameId | LayerId,
  pageId?: string
): SelectionState {
  if (selection.selectedIds.includes(id)) {
    return removeFromSelection(selection, [id])
  }

  if (selection.selectedIds.length === 0 && pageId) {
    return createSelectionState(pageId, [id], undefined)
  }

  return addToSelection(selection, [id])
}
