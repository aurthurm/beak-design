import EventEmitter from "eventemitter3";
import type { SceneManager } from "../managers/scene-manager";
import type { Action } from "./actions";

export type UndoStack = Action[][];

interface UndoEvents {
  changed: () => void;
}

export class Undo extends EventEmitter<UndoEvents> {
  private manager: SceneManager;

  private undoStack: UndoStack = [];
  private redoStack: UndoStack = [];

  constructor(manager: SceneManager) {
    super();

    this.manager = manager;
  }

  hasUndo() {
    return this.undoStack.length > 0;
  }

  hasRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  pushUndo(changes: Action[]) {
    if (changes.length) {
      this.undoStack.push(changes);
      this.redoStack.length = 0;

      this.emit("changed");
    }
  }

  applyFromStack(from: UndoStack, to: UndoStack | null) {
    const record = from.pop();
    if (!record) {
      return;
    }

    // NOTE(sedivy): To have a multiplayer friendly (LLM agents or network users)
    // undo/redo we only store the inverse after a user makes a change and never
    // the final value in the undo/redo stack. Then after each undo/redo we
    // dynamically built the inverse of that at that point.
    //
    // The reason for that is there could be other changes since the user recorded
    // the undo state. This allows us to always have up-to-date inverse.

    const rollback: Action[] | null = to ? [] : null;

    for (let i = record.length - 1; i >= 0; i--) {
      record[i].perform(this.manager, rollback);
    }

    if (rollback?.length && to) {
      to.push(rollback);
    }

    this.manager.scenegraph.documentModified();
    this.manager.selectionManager.updateMultiSelectGuides();

    this.emit("changed");
  }

  undo() {
    this.applyFromStack(this.undoStack, this.redoStack);
  }

  redo() {
    this.applyFromStack(this.redoStack, this.undoStack);
  }
}
