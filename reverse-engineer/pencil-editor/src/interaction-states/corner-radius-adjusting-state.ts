import type { Point, PointData } from "pixi.js";
import type { SceneNode } from "../canvas/scene-node";
import type { HandleType, SceneManager } from "../managers/scene-manager";
import { IdleState } from "./idle-state";
import type { InteractionState } from "./interaction-state";
import type { ObjectUpdateBlock } from "../canvas/object-update-block";

export class CornerRadiusAdjustingState implements InteractionState {
  sceneManager: SceneManager;
  handle: HandleType;

  private startPoint: PointData;
  private startLocalPoint: Point | null = null;
  private node: SceneNode | null = null;
  private originalRadius: readonly [number, number, number, number] | null =
    null;

  private originalUndoSnapshot: ObjectUpdateBlock | null = null;

  constructor(
    sceneManager: SceneManager,
    startPoint: Point,
    handle: HandleType,
  ) {
    this.sceneManager = sceneManager;
    this.handle = handle;

    this.startPoint = sceneManager.camera.toWorld(startPoint.x, startPoint.y);
  }

  onEnter(): void {
    this.sceneManager.didDrag = false;

    if (this.sceneManager.selectionManager.selectedNodes.size !== 1) {
      return;
    }

    const node = this.sceneManager.selectionManager.selectedNodes
      .values()
      .next().value as SceneNode;
    if (node.type !== "rectangle") {
      return;
    }

    this.originalUndoSnapshot = this.sceneManager.scenegraph.beginUpdate();

    this.node = node;

    this.startLocalPoint = node.toLocal(this.startPoint.x, this.startPoint.y);

    // NOTE(sedivy): Snapshot all properties that will be modified in the onPointerMove event.
    this.originalUndoSnapshot.snapshotProperties(node, ["cornerRadius"]);

    this.originalRadius = structuredClone(
      node.properties.resolved.cornerRadius ?? [0, 0, 0, 0],
    );

    this.sceneManager.guidesGraph.disableInteractions();
  }

  onExit(): void {
    this.node = null;
    this.originalRadius = null;
    this.sceneManager.guidesGraph.enableInteractions();
  }

  onPointerDown(): void {}

  onPointerMove(event: MouseEvent): void {
    const sm = this.sceneManager;

    // TODO(sedivy): Add a custom cursor icon
    sm.setCursor("default");

    if (
      !this.node ||
      this.startLocalPoint == null ||
      this.originalRadius == null ||
      !this.handle ||
      !this.sceneManager.input
    ) {
      return;
    }

    const mouse = this.sceneManager.input.worldMouse;

    sm.didDrag = true;
    sm.selectionManager.setHoveredNode(null);

    const node = this.node;

    const currentLocalPoint = node.toLocal(mouse.x, mouse.y);

    const localDeltaX = currentLocalPoint.x - this.startLocalPoint.x;
    const localDeltaY = currentLocalPoint.y - this.startLocalPoint.y;

    let radiusChange = 0;

    switch (this.handle) {
      case "cr_tl":
        radiusChange = (localDeltaX + localDeltaY) / 2;
        break;
      case "cr_tr":
        radiusChange = (-localDeltaX + localDeltaY) / 2;
        break;
      case "cr_bl":
        radiusChange = (localDeltaX - localDeltaY) / 2;
        break;
      case "cr_br":
        radiusChange = (-localDeltaX - localDeltaY) / 2;
        break;
    }

    // TODO(sedivy): We should only update a single corner and not all 4.
    // TODO(sedivy): When holding alt change all corners to the same value.
    const radius: [number, number, number, number] = [
      Math.round(Math.max(0, this.originalRadius[0] + radiusChange)),
      Math.round(Math.max(0, this.originalRadius[0] + radiusChange)),
      Math.round(Math.max(0, this.originalRadius[0] + radiusChange)),
      Math.round(Math.max(0, this.originalRadius[0] + radiusChange)),
    ];

    const block = this.sceneManager.scenegraph.beginUpdate();
    block.update(node, {
      cornerRadius: radius,
    });
    this.sceneManager.scenegraph.commitBlock(block, { undo: false });

    this.sceneManager.nodeManager._schedulePostTransformUpdates(false, true);
  }

  onPointerUp(): void {
    if (this.originalUndoSnapshot) {
      this.sceneManager.scenegraph.commitBlock(this.originalUndoSnapshot, {
        undo: true,
      });
      this.originalUndoSnapshot = null;
    }

    const sm = this.sceneManager;
    sm.stateManager.transitionTo(new IdleState(sm));
  }

  onKeyDown?(): void {}
  onKeyUp?(): void {}
  onToolChange?(): void {}
  render() {}
}
