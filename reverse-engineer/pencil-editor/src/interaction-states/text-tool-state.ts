import { logger } from "@ha/shared";
import type { PointData } from "pixi.js";
import type { SceneNode } from "../canvas/scene-node";
import type { SceneManager } from "../managers/scene-manager";
import { IdleState } from "./idle-state";
import type { InteractionState } from "./interaction-state";

export class TextToolState implements InteractionState {
  // For when the text tool is active but not drawing/editing yet
  sceneManager: SceneManager;
  startPoint: PointData | null = null; // Store start point on pointer down
  private isGuideStarted: boolean = false; // Flag to track if guide drawing started

  private frameParent: SceneNode | null = null;

  constructor(sceneManager: SceneManager, startPoint?: PointData) {
    this.sceneManager = sceneManager;
    this.startPoint = startPoint || null;
  }

  onEnter(): void {
    this.sceneManager.selectionManager.clearSelection(); // Clear selection when text tool active

    if (this.startPoint) {
      this.frameParent =
        this.sceneManager.selectionManager.findFrameForPosition(
          this.startPoint.x,
          this.startPoint.y,
          undefined,
          undefined,
        );
    } else {
      this.frameParent = null;
    }
  }

  onExit(): void {
    this.sceneManager.guidesManager.finishDrawingGuide(); // Clean up guide if any
    this.sceneManager.nodeManager.setIsDrawing(false); // Ensure isDrawing is false on exit
    this.isGuideStarted = false; // Reset flag on exit
    this.startPoint = null; // Clear start point on exit
    this.frameParent = null;
  }

  onPointerMove(): void {
    if (!this.startPoint /*|| !this.sceneManager.isDrawing*/) return; // Only check startPoint now
    if (!this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;
    const worldPoint = this.sceneManager.input.worldMouse;
    if (this.sceneManager.config.data.roundToPixels) {
      worldPoint.x = Math.round(worldPoint.x);
      worldPoint.y = Math.round(worldPoint.y);
    }

    sm.didDrag = true; // Mark drag if moving

    // Start drawing the guide *only* when dragging starts
    if (!this.isGuideStarted) {
      // Use the local flag instead
      sm.guidesManager.startDrawingGuide(
        "text",
        this.startPoint.x,
        this.startPoint.y,
      );
      this.isGuideStarted = true; // Set the flag
    }

    sm.guidesManager.updateDrawingGuide(worldPoint.x, worldPoint.y);
  }

  onPointerUp(): void {
    if (!this.startPoint) {
      this.sceneManager.stateManager.transitionTo(
        new IdleState(this.sceneManager),
      );
      return;
    }

    if (!this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;
    const worldPoint = this.sceneManager.input.worldMouse;
    if (this.sceneManager.config.data.roundToPixels) {
      worldPoint.x = Math.round(worldPoint.x);
      worldPoint.y = Math.round(worldPoint.y);
    }

    sm.guidesManager.finishDrawingGuide(); // Remove temporary rect guide

    // Finish Text Creation / Click Logic (Adapted from SceneManager.handlePointerUp)
    // Just call the async function, it handles transitions internally now
    // Add non-null assertion for startPoint
    sm.textEditorManager.finishTextCreationAndStartEditingInternal(
      worldPoint,
      this.startPoint,
      this.frameParent,
    );

    this.frameParent = null;

    // Resetting flags is handled by onExit, called during state transitions
  }

  // Add this method
  onToolChange?(newTool: string): void {
    // If the tool changes away from 'text' while we are in this state
    // (before pointer up), transition back to Idle.
    if (newTool !== "text") {
      logger.debug(
        "TextToolState: Tool changed away from text, transitioning to Idle.",
      );
      this.sceneManager.stateManager.transitionTo(
        new IdleState(this.sceneManager),
      );
    }
  }

  // Add empty handler to satisfy interface, logic moved to constructor
  onPointerDown(): void {}
  onKeyDown?(): void {}
  onKeyUp?(): void {}
  render() {}
}
