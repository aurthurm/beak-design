import type { GuidesGraph } from "../canvas/guides-graph";
import type { SceneManager } from "../managers/scene-manager";
import { IdleState } from "./idle-state";
import type { InteractionState } from "./interaction-state";
import { logger } from "@ha/shared";
import type { SceneNode } from "../canvas/scene-node";

export class EditingTextState implements InteractionState {
  // When actively editing text in the overlay
  sceneManager: SceneManager;
  guidesGraph: GuidesGraph; // Add guidesGraph reference
  node: SceneNode;

  constructor(sceneManager: SceneManager, node: SceneNode) {
    this.sceneManager = sceneManager;
    this.guidesGraph = sceneManager.guidesGraph; // Initialize guidesGraph
    this.node = node;
  }
  onEnter(): void {
    logger.debug("Entering Editing Text State");
    this.sceneManager.textEditorManager.setIsEditingText(true); // Set manager flag
    this.sceneManager.textEditorManager.setEditingNodeId(this.node);

    if (
      !this.node ||
      (this.node.type !== "text" &&
        this.node.type !== "note" &&
        this.node.type !== "prompt" &&
        this.node.type !== "context")
    ) {
      this.sceneManager.stateManager.transitionTo(
        new IdleState(this.sceneManager),
      );
      return;
    }

    this.guidesGraph.clear();
  }

  onExit(): void {
    this.sceneManager.textEditorManager.setIsEditingText(false); // Clear manager flag
    this.sceneManager.textEditorManager.setEditingNodeId(null);
  }

  onPointerDown(): void {
    // If the click is outside the text editing area (determine this somehow, maybe event target),
    // finish the edit.
    // This requires the UI overlay to NOT stop propagation of clicks outside itself.
    // logger.debug("Click while editing text", event.target);
    // For now, assume finishing happens via UI interaction (Enter key, blur)
    // or explicitly calling SceneManager.finishTextEditing
  }
  onPointerMove(): void {
    /* Usually no action */
  }
  onPointerUp(): void {
    /* Usually no action */
  }

  // Method to be called by SceneManager when edit is confirmed (e.g., Enter press)
  confirmEdit() {
    logger.debug("EditingTextState: confirmEdit called");
    const sm = this.sceneManager;
    // Call the internal logic (without state change)
    sm.textEditorManager.finishTextEditingInternal();

    // Call the helper method
    this._schedulePostEditActions();

    // Defer selection and tool switch to the next frame
    /* Removed requestAnimationFrame block */

    // Transition immediately
    sm.stateManager.transitionTo(new IdleState(sm));
  }

  // Method to be called by SceneManager when edit is cancelled (e.g., Escape press)
  cancelEdit() {
    logger.debug("EditingTextState: cancelEdit called");
    const sm = this.sceneManager;
    // Call internal logic with null to signify cancellation (restores original text)
    sm.textEditorManager.finishTextEditingInternal();

    // Call the helper method
    this._schedulePostEditActions();

    // Defer selection and tool switch to the next frame
    /* Removed requestAnimationFrame block */

    // Transition immediately
    sm.stateManager.transitionTo(new IdleState(sm));
  }

  private _schedulePostEditActions() {
    if (this.node) {
      this.sceneManager.selectionManager.selectNode(this.node, false, true); // Select the edited/cancelled node, replace selection
    }
    this.sceneManager.setActiveTool("move");
  }

  onKeyDown?(_event: KeyboardEvent): void {}
  onKeyUp?(_event: KeyboardEvent): void {}
  onToolChange?(_newTool: string): void {}
  render() {}
}
