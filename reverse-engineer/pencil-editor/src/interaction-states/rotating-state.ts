import { Point } from "pixi.js";
import { getRotatedIconFor } from "../canvas/cursor-generator";
import type { SceneNode } from "../canvas/scene-node";
import { logger } from "@ha/shared";
import type { SceneManager } from "../managers/scene-manager";
import { IdleState } from "./idle-state";
import type { InteractionState } from "./interaction-state";
import type { ObjectUpdateBlock } from "../canvas/object-update-block";

// 15 degrees in radians for snapping
const SNAP_ANGLE = (15 * Math.PI) / 180;

export class RotatingState implements InteractionState {
  sceneManager: SceneManager;
  private startPointScreenSpace: Point;
  private rotationCenter: Point = new Point(0, 0);
  private startAngle: number = 0;
  private initialNodeRotations: Map<SceneNode, number> = new Map();
  private initialNodePositions: Map<SceneNode, Point> = new Map();

  private dirX: number;
  private dirY: number;
  private cursorAngle: number;

  private originalUndoSnapshot: ObjectUpdateBlock | null = null;

  constructor(
    sceneManager: SceneManager,
    startPointScreenSpace: Point,
    dirX: number,
    dirY: number,
    cursorAngle: number,
  ) {
    this.sceneManager = sceneManager;
    this.startPointScreenSpace = startPointScreenSpace.clone();
    this.dirX = dirX;
    this.dirY = dirY;
    this.cursorAngle = cursorAngle;
  }

  onEnter(): void {
    logger.debug("Entering Rotating State");
    const sm = this.sceneManager;

    const selectionBounds = sm.selectionManager.getWorldspaceBounds();
    if (!selectionBounds) {
      sm.stateManager.transitionTo(new IdleState(sm));
      return;
    }

    this.originalUndoSnapshot = this.sceneManager.scenegraph.beginUpdate();

    // The center of rotation is the center of the selection's bounding box
    this.rotationCenter = new Point(
      selectionBounds.x + selectionBounds.width / 2,
      selectionBounds.y + selectionBounds.height / 2,
    );

    // Convert the start point (which is in screen coordinates) to world coordinates
    const startPointWorld = this.sceneManager.camera.toWorld(
      this.startPointScreenSpace.x,
      this.startPointScreenSpace.y,
    );

    // Calculate the angle of the initial click relative to the center in world coordinates
    this.startAngle = Math.atan2(
      startPointWorld.y - this.rotationCenter.y,
      startPointWorld.x - this.rotationCenter.x,
    );

    // Store the original rotation of each node
    this.initialNodeRotations.clear();
    this.initialNodePositions.clear();
    for (const node of sm.selectionManager.selectedNodes) {
      this.initialNodeRotations.set(
        node,
        node.properties.resolved.rotation ?? 0,
      );
      this.initialNodePositions.set(node, node.getGlobalPosition());

      // NOTE(sedivy): Snapshot all properties that will be modified in the onPointerMove event.
      this.originalUndoSnapshot.snapshotProperties(node, [
        "x",
        "y",
        "rotation",
      ]);
    }

    const cursor = getRotatedIconFor(
      "rotate",
      this.dirX,
      this.dirY,
      this.cursorAngle,
    );
    sm.setCursor(cursor);

    sm.guidesGraph.disableInteractions();
    sm.guidesGraph.hideAllBoundingBoxes();
  }

  onExit(): void {
    this.sceneManager.setCursor("default");
    this.sceneManager.guidesGraph.enableInteractions();
    this.sceneManager.guidesGraph.showAllBoundingBoxes();
  }

  onPointerDown(): void {}

  onPointerMove(event: MouseEvent): void {
    if (!this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;
    const worldPoint = this.sceneManager.input.worldMouse;

    const currentAngle = Math.atan2(
      worldPoint.y - this.rotationCenter.y,
      worldPoint.x - this.rotationCenter.x,
    );

    let angleDelta = currentAngle - this.startAngle;

    // --- Handle Shift Key for Snapping ---
    if (event.shiftKey) {
      // Find the rotation of one of the nodes (they should all be rotating together)
      const firstNodeId = this.initialNodeRotations.keys().next().value;
      if (firstNodeId) {
        const initialRotation = this.initialNodeRotations.get(firstNodeId) ?? 0;

        // 1. Calculate the desired total rotation based on mouse movement
        const targetRotation = initialRotation + angleDelta;

        // 2. Snap the total rotation to the nearest SNAP_ANGLE
        const snappedTotalRotation =
          Math.round(targetRotation / SNAP_ANGLE) * SNAP_ANGLE;

        // 3. Calculate the new delta to reach the snapped angle
        angleDelta = snappedTotalRotation - initialRotation;
      }
    }

    const block = sm.scenegraph.beginUpdate();

    // This is a new method we will need to add to SceneManager
    sm.nodeManager.rotateSelectedNodes(
      block,
      angleDelta,
      this.rotationCenter,
      this.initialNodeRotations,
      this.initialNodePositions,
    );

    sm.scenegraph.commitBlock(block, { undo: false });

    const cursor = getRotatedIconFor(
      "rotate",
      this.dirX,
      this.dirY,
      this.cursorAngle + angleDelta,
    );
    sm.setCursor(cursor);
  }

  onPointerUp(): void {
    if (this.originalUndoSnapshot) {
      this.sceneManager.scenegraph.commitBlock(this.originalUndoSnapshot, {
        undo: true,
      });
      this.originalUndoSnapshot = null;
    }

    this.sceneManager.stateManager.transitionTo(
      new IdleState(this.sceneManager),
    );
  }

  render() {}
}
