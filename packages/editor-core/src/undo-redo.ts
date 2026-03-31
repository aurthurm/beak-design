import type { Document } from '../../schema/src'

type DocumentSnapshot = {
  document: Document
  timestamp: number
}

export type UndoRedoManagerDeps = {
  getDocument: () => Document | null
  setDocument: (document: Document) => void
  now?: () => number
}

export class UndoRedoManager {
  private undoStack: DocumentSnapshot[] = []
  private redoStack: DocumentSnapshot[] = []
  private maxHistorySize: number
  isUndoing: boolean = false
  isRedoing: boolean = false

  constructor(
    private deps: UndoRedoManagerDeps,
    options?: { maxHistorySize?: number }
  ) {
    this.maxHistorySize = options?.maxHistorySize ?? 50
  }

  saveSnapshot(): void {
    if (this.isUndoing || this.isRedoing) return

    const document = this.deps.getDocument()
    if (!document) return

    this.undoStack.push({
      document: cloneDocument(document),
      timestamp: this.now(),
    })

    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift()
    }

    this.redoStack = []
  }

  undo(): boolean {
    if (this.undoStack.length === 0) {
      return false
    }

    const currentDocument = this.deps.getDocument()
    if (currentDocument) {
      this.redoStack.push({
        document: cloneDocument(currentDocument),
        timestamp: this.now(),
      })
    }

    const snapshot = this.undoStack.pop()!
    this.isUndoing = true
    this.deps.setDocument(snapshot.document)
    this.isUndoing = false

    return true
  }

  redo(): boolean {
    if (this.redoStack.length === 0) {
      return false
    }

    const currentDocument = this.deps.getDocument()
    if (currentDocument) {
      this.undoStack.push({
        document: cloneDocument(currentDocument),
        timestamp: this.now(),
      })
    }

    const snapshot = this.redoStack.pop()!
    this.isRedoing = true
    this.deps.setDocument(snapshot.document)
    this.isRedoing = false

    return true
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }
}

function cloneDocument(document: Document): Document {
  return JSON.parse(JSON.stringify(document)) as Document
}
