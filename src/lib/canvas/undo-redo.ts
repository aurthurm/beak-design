import { UndoRedoManager } from '../../../packages/editor-core/src/undo-redo'
import { canvasStore, canvasActions } from './store'

// Singleton instance
let undoRedoManagerInstance: UndoRedoManager | null = null

export function getUndoRedoManager(): UndoRedoManager {
  if (!undoRedoManagerInstance) {
    undoRedoManagerInstance = new UndoRedoManager({
      getDocument: () => canvasStore.state.document,
      setDocument: (document) => {
        canvasActions.setDocument(document)
      },
    })
  }
  return undoRedoManagerInstance
}

export { UndoRedoManager }
