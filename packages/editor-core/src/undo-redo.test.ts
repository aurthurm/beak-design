import { describe, expect, it } from 'vitest'

import type { Document } from '../../schema/src'
import { UndoRedoManager } from './undo-redo'

function createDocument(name: string): Document {
  return {
    id: 'doc-1' as Document['id'],
    schemaVersion: '1.0.0',
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    activePageId: null,
    pages: {},
    frames: {},
    layers: {},
    components: {},
    tokens: {},
    assets: {},
  }
}

describe('UndoRedoManager', () => {
  it('stores snapshots and restores previous and next documents', () => {
    let currentDocument: Document | null = createDocument('Initial')
    const appliedNames: string[] = []
    const manager = new UndoRedoManager({
      getDocument: () => currentDocument,
      setDocument: (document) => {
        currentDocument = document
        appliedNames.push(document.name)
      },
      now: () => 123,
    })

    manager.saveSnapshot()
    currentDocument = createDocument('Updated')

    expect(manager.canUndo()).toBe(true)
    expect(manager.canRedo()).toBe(false)
    expect(manager.undo()).toBe(true)
    expect(currentDocument?.name).toBe('Initial')
    expect(appliedNames).toEqual(['Initial'])
    expect(manager.canRedo()).toBe(true)

    expect(manager.redo()).toBe(true)
    expect(currentDocument?.name).toBe('Updated')
    expect(appliedNames).toEqual(['Initial', 'Updated'])
  })

  it('clears redo history on a new snapshot and ignores empty state', () => {
    let currentDocument: Document | null = createDocument('One')
    const manager = new UndoRedoManager({
      getDocument: () => currentDocument,
      setDocument: (document) => {
        currentDocument = document
      },
    })

    manager.saveSnapshot()
    currentDocument = createDocument('Two')
    expect(manager.undo()).toBe(true)
    expect(manager.canRedo()).toBe(true)

    manager.saveSnapshot()
    currentDocument = createDocument('Three')
    expect(manager.canRedo()).toBe(false)

    manager.clear()
    expect(manager.canUndo()).toBe(false)
    expect(manager.canRedo()).toBe(false)

    currentDocument = null
    manager.saveSnapshot()
    expect(manager.canUndo()).toBe(false)
  })
})
