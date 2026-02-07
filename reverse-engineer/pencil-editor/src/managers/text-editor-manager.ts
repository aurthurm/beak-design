import { logger } from "@ha/shared";
import type { PointData } from "pixi.js";
import { FillType } from "../canvas/fill";
import type { NodeProperties } from "../canvas/scene-graph";
import type { SceneNode } from "../canvas/scene-node";
import { getContrastingFillColor } from "../color";
import { rectangleFromPoints } from "../utils/math";
import { createNodeProperties } from "./file-manager";
import type { SceneManager } from "./scene-manager";
import { EditingTextState, IdleState, TextToolState } from "./state-manager";

export class TextEditorManager {
  private sm: SceneManager;

  public isEditingText: boolean = false;
  public editingNode: SceneNode | null = null;

  constructor(sm: SceneManager) {
    this.sm = sm;
  }

  public setIsEditingText(editing: boolean): void {
    this.isEditingText = editing;
  }

  public setEditingNodeId(node: SceneNode | null): void {
    this.editingNode = node;
  }

  public startTextEditing(node: SceneNode): void {
    if (
      node.type !== "text" &&
      node.type !== "note" &&
      node.type !== "prompt" &&
      node.type !== "context"
    ) {
      return;
    }

    this.sm.stateManager.transitionTo(new EditingTextState(this.sm, node));
    this.sm.eventEmitter.emit("startTextEdit", node);
  }

  public finishTextEditing(): void {
    if (this.sm.stateManager.state instanceof EditingTextState) {
      this.sm.stateManager.state.confirmEdit();
    }
  }

  public finishTextEditingInternal(): void {
    const node = this.editingNode;
    if (!node) {
      return;
    }

    // Clear editing state flags regardless of update success/cancellation
    this.isEditingText = false;
    this.editingNode = null;

    // Emit finish event AFTER clearing flags
    this.sm.eventEmitter.emit("finishTextEdit");
  }

  async finishTextCreationAndStartEditingInternal(
    worldSpaceStart: PointData,
    worldSpaceEnd: PointData,
    parent: SceneNode | null,
  ): Promise<void> {
    const screenStartPoint = this.sm.camera.toScreen(
      worldSpaceStart.x,
      worldSpaceStart.y,
    );
    const screenEndPoint = this.sm.camera.toScreen(
      worldSpaceEnd.x,
      worldSpaceEnd.y,
    );

    const screenRect = rectangleFromPoints(
      screenStartPoint.x,
      screenStartPoint.y,
      screenEndPoint.x,
      screenEndPoint.y,
    );

    const worldRect = rectangleFromPoints(
      worldSpaceStart.x,
      worldSpaceStart.y,
      worldSpaceEnd.x,
      worldSpaceEnd.y,
    );

    const block = this.sm.scenegraph.beginUpdate();

    const containerForNode = parent ?? this.sm.scenegraph.getViewportNode();

    const pixel = this.sm.skiaRenderer.readPixel(
      screenStartPoint.x,
      screenStartPoint.y,
    );
    const fillColor = pixel ? getContrastingFillColor(pixel) : "#ffffff";

    if (this.sm.didDrag && screenRect.width > 30 && screenRect.height > 10) {
      const defaultFont = "Inter";
      try {
        const localTopLeft = containerForNode.toLocal(worldRect.x, worldRect.y);
        const localBottomRight = containerForNode.toLocal(
          worldRect.x + worldRect.width,
          worldRect.y + worldRect.height,
        );
        const localWidth = Math.abs(localBottomRight.x - localTopLeft.x);
        const localHeight = Math.abs(localBottomRight.y - localTopLeft.y);

        const newNodeProps: Partial<NodeProperties> = {
          x: localTopLeft.x,
          y: localTopLeft.y,
          width: localWidth,
          height: localHeight,
          fills: [{ type: FillType.Color, enabled: true, color: fillColor }],
          textContent: "",
          fontFamily: defaultFont,
          fontSize: 16,
          textAlign: "left",
          textGrowth: "auto",
        };

        const newNode = this.sm.scenegraph.createAndInsertNode(
          block,
          undefined,
          "text",
          createNodeProperties("text", newNodeProps),
          containerForNode,
        );

        this.startTextEditing(newNode);

        this.sm.scenegraph.commitBlock(block, { undo: true });
      } catch (error) {
        logger.error("Error during text node creation (drag):", error);
        if (this.sm.stateManager.state instanceof TextToolState) {
          this.sm.stateManager.transitionTo(new IdleState(this.sm));
        }
      }
    } else {
      // --- Clicked to create text at point ---
      logger.debug("Text Tool: Click detected, creating default text node.");
      const defaultWidth = 2; // Start with a minimal width to allow for growth
      const defaultHeight = 30;
      const defaultFont = "Inter";

      try {
        const localStartPoint = containerForNode.toLocal(
          worldSpaceStart.x,
          worldSpaceStart.y,
        );

        const newNodeProps: Partial<NodeProperties> = {
          x: localStartPoint.x,
          y: localStartPoint.y,
          width: defaultWidth,
          height: defaultHeight,
          fills: [{ type: FillType.Color, enabled: true, color: fillColor }],
          textContent: "",
          fontFamily: defaultFont,
          fontSize: 16,
          textAlign: "left",
          textGrowth: "auto",
        };

        const newNode = this.sm.scenegraph.createAndInsertNode(
          block,
          undefined,
          "text",
          createNodeProperties("text", newNodeProps),
          containerForNode,
        );

        this.startTextEditing(newNode);
        this.sm.scenegraph.commitBlock(block, { undo: true });
      } catch (_error) {
        if (this.sm.stateManager.state instanceof TextToolState) {
          this.sm.stateManager.transitionTo(new IdleState(this.sm));
        }
      }
    }
  }
}
