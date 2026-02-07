import { type Matrix, Point, type PointData } from "pixi.js";
import { NodeUtils } from "../canvas/node-utils";
import type { NodeProperties, SceneGraph } from "../canvas/scene-graph";
import type { SceneNode } from "../canvas/scene-node";
import { logger } from "@ha/shared";
import type { SceneManager } from "./scene-manager";
import type { ObjectUpdateBlock } from "../canvas/object-update-block";
import { createNodeProperties } from "./file-manager";
import { FillType } from "../canvas/fill";
import { LayoutMode, SizingBehavior } from "../canvas";

export class NodeManager {
  private sm: SceneManager;
  private scenegraph: SceneGraph;

  // === Drawing State ===
  public drawStartX: number = 0;
  public drawStartY: number = 0;
  public isDrawing: boolean = false;

  // === Resizing State ===
  public isResizing: boolean = false;
  public resizeStartNodeTransform: Matrix | null = null;
  public resizeStartLocalPoint: Point | null = null;

  // === Node Dragging Positions ===
  public dragStartNodePositions: Map<
    string,
    { x: number; y: number; startXWorld: number; startYWorld: number }
  > = new Map();

  constructor(manager: SceneManager) {
    this.sm = manager;
    this.scenegraph = manager.scenegraph;
  }

  public setIsDrawing(drawing: boolean): void {
    this.isDrawing = drawing;
  }

  // === Node Dragging Methods ===
  public getDragStartNodePositions(): Map<
    string,
    { x: number; y: number; startXWorld: number; startYWorld: number }
  > {
    return this.dragStartNodePositions;
  }

  public setDragStartNodePositions(
    positions: Map<
      string,
      { x: number; y: number; startXWorld: number; startYWorld: number }
    >,
  ): void {
    this.dragStartNodePositions = positions;
  }

  // === Drawing Methods (moved from DrawingManager) ===

  /**
   * Starts a drawing operation
   */
  public startDrawing(
    worldPoint: PointData,
    tool: "rectangle" | "ellipse" | "frame",
  ): void {
    logger.debug("DrawingController: Start Drawing");

    this.drawStartX = worldPoint.x;
    this.drawStartY = worldPoint.y;

    this.sm.selectionManager.clearSelection();

    this.sm.guidesGraph.startDrawingGuide(tool, worldPoint.x, worldPoint.y);
  }

  /**
   * Updates the drawing preview
   */
  public updateDrawing(
    worldPoint: PointData,
    shiftKey: boolean = false,
    altKey: boolean = false,
  ): void {
    this.sm.didDrag = true;
    this.sm.guidesGraph.updateDrawingGuide(
      worldPoint.x,
      worldPoint.y,
      shiftKey,
      altKey,
    );
  }

  /**
   * Finishes the drawing operation and creates the node
   */
  public finishDrawing(
    block: ObjectUpdateBlock,
    worldPoint: PointData,
    shiftKey: boolean = false,
    altKey: boolean = false,
    parent: SceneNode | null,
  ): SceneNode | null {
    logger.debug("DrawingController: Finish Drawing");

    this.sm.guidesGraph.finishDrawingGuide();
    let createdNode: SceneNode | null = null;

    const containerForNode = parent ?? this.scenegraph.getViewportNode();

    if (this.sm.didDrag) {
      const finalRect = NodeUtils.calculateRectFromPoints(
        new Point(this.drawStartX, this.drawStartY),
        worldPoint,
        shiftKey,
        altKey,
      );

      const localP = containerForNode.toLocal(finalRect.x, finalRect.y);

      // Check against viewport dimensions
      if (finalRect.width > 0 && finalRect.height > 0) {
        const newNodeProps: Partial<NodeProperties> = {
          x: localP.x,
          y: localP.y,
          width: finalRect.width,
          height: finalRect.height,
          rotation: 0,
          opacity: 1,
        };

        let newNodeType: "rectangle" | "ellipse" | "frame" | null = null;

        // Use the tool type from SceneManager
        const currentTool = this.sm.activeTool;
        if (currentTool === "rectangle") {
          newNodeType = "rectangle";
          newNodeProps.fills = [
            { type: FillType.Color, enabled: true, color: "#CCCCCC" },
          ];
        } else if (currentTool === "ellipse") {
          newNodeType = "ellipse";
          newNodeProps.fills = [
            { type: FillType.Color, enabled: true, color: "#CCCCCC" },
          ];
        } else if (currentTool === "frame") {
          newNodeType = "frame";
          newNodeProps.fills = [
            { type: FillType.Color, enabled: true, color: "#FFFFFF" },
          ];
          newNodeProps.clip = true;
          newNodeProps.layoutMode = LayoutMode.None;
          newNodeProps.horizontalSizing = SizingBehavior.Fixed;
          newNodeProps.verticalSizing = SizingBehavior.Fixed;
          const nextFrameNumber = this.scenegraph.getNextFrameNumber();
          newNodeProps.name = `Frame ${nextFrameNumber}`;
        }

        if (newNodeType) {
          const newNode = this.scenegraph.createAndInsertNode(
            block,
            undefined,
            newNodeType,
            createNodeProperties(newNodeType, newNodeProps),
            containerForNode,
          );

          if (newNode) {
            createdNode = newNode;
          }
        }
      }
    }

    return createdNode;
  }

  // Add this helper method
  _schedulePostTransformUpdates(
    notifySelectionChange: boolean = false,
    nextTick: boolean = false,
  ): void {
    if (nextTick) {
      requestAnimationFrame(() => {
        // Update guides and index after all nodes are transformed
        this.sm.selectionManager.updateMultiSelectGuides(); // Reflects final positions
        if (notifySelectionChange) {
          // SelectionManager handles notification through its methods
        }
      });
    } else {
      this.sm.selectionManager.updateMultiSelectGuides(); // Reflects final positions
      if (notifySelectionChange) {
        // SelectionManager handles notification through its methods
      }
    }
  }

  public alignSelectedNodes(
    align: "top" | "middle" | "bottom" | "left" | "center" | "right",
  ): void {
    this.sm.selectionManager.alignSelectedNodes(align);
  }

  public rotateSelectedNodes(
    block: ObjectUpdateBlock,
    angleDelta: number,
    center: Point,
    initialNodeRotations: Map<SceneNode, number>,
    initialNodePositions: Map<SceneNode, Point>,
  ): void {
    this.sm.selectionManager.rotateSelectedNodes(
      block,
      angleDelta,
      center,
      initialNodeRotations,
      initialNodePositions,
    );
  }
}
