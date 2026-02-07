import type { Container, Point } from "pixi.js";
import type { BoundingBox } from "../canvas/bounding-box";
import type { GuidesGraph } from "../canvas/guides-graph";
import { NodeUtils } from "../canvas/node-utils";
import type { SceneGraph } from "../canvas/scene-graph";
import type { Connection } from "../types/connections";
import type { SceneManager } from "./scene-manager";
import type { SceneNode } from "../canvas/scene-node";

export class GuidesManager {
  private sm: SceneManager;
  private guidesGraph: GuidesGraph;
  private sceneGraph: SceneGraph;

  constructor(sm: SceneManager) {
    this.sm = sm;
    this.guidesGraph = sm.guidesGraph; // Get reference from scene manager
    this.sceneGraph = sm.scenegraph;
  }

  public clear(): void {
    this.guidesGraph.clear();
  }

  /**
   * Updates guides for the current selection state
   */
  public updateMultiSelectGuides(hideHighlights: boolean = false): void {
    // NOTE(sedivy): Make sure layout is up-to-date before drawing selected bounding boxes.
    this.sceneGraph.updateLayout();

    const selectionSize = this.sm.selectionManager.selectedNodes.size;
    const selectedNodesArray = Array.from(
      this.sm.selectionManager.selectedNodes.values(),
    );

    if (selectionSize === 0) {
      this.guidesGraph.clear();
    } else if (selectionSize === 1) {
      const node = selectedNodesArray[0];
      this.guidesGraph.updateSingleNodeGuides(node, hideHighlights);
    } else {
      const combinedWorldBounds = NodeUtils.calculateCombinedBoundsNew(
        this.sm.selectionManager.selectedNodes,
      );
      this.guidesGraph.updateMultiNodeGuides(
        selectedNodesArray,
        combinedWorldBounds,
      );
    }
  }

  /**
   * Updates bounding box for a single node
   */
  public updateBoundingBox(node: SceneNode): void {
    this.guidesGraph.updateBoundingBox(node);
  }

  /**
   * Draws connections
   */
  public drawConnections(connections: Connection[]): void {
    this.guidesGraph.drawConnections(connections);
  }

  /**
   * Starts a drawing guide for shape creation
   */
  public startDrawingGuide(
    type: "rectangle" | "ellipse" | "frame" | "marquee" | "text",
    startX: number,
    startY: number,
  ): void {
    this.guidesGraph.startDrawingGuide(type, startX, startY);
  }

  /**
   * Updates the current drawing guide
   */
  public updateDrawingGuide(currentX: number, currentY: number): void {
    this.guidesGraph.updateDrawingGuide(currentX, currentY);
  }

  /**
   * Finishes the current drawing guide
   */
  public finishDrawingGuide(): void {
    this.guidesGraph.finishDrawingGuide();
  }

  /**
   * Gets the currently active bounding box
   */
  public getActiveBoundingBox(): BoundingBox | null {
    return this.guidesGraph.getActiveBoundingBox();
  }

  /**
   * Redraws all visible guides (useful after viewport changes)
   */
  public redrawVisibleGuides(): void {
    this.guidesGraph.redrawVisibleGuides();
  }

  /**
   * Adds an arbitrary guide object to the guides layer
   */
  public addGuideObject(object: Container): void {
    this.guidesGraph.addGuideObject(object);
  }

  /**
   * Removes a guide object from the guides layer
   */
  public removeGuideObject(object: Container): void {
    this.guidesGraph.removeGuideObject(object);
  }

  /**
   * Removes all guide objects
   */
  public removeAllGuideObjects(): void {
    this.guidesGraph.removeAllGuideObjects();
  }

  /**
   * Sets the position and scale of the guides container
   */
  public setPositionAndScale(position: Point, scale: Point): void {
    this.guidesGraph.setPositionAndScale(position, scale);
  }
}
