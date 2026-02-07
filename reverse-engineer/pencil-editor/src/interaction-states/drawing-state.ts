import type { PointData } from "pixi.js";
import type { GuidesGraph } from "../canvas/guides-graph";
import type { SceneNode } from "../canvas/scene-node";
import type { SceneManager } from "../managers/scene-manager";
import { IdleState } from "./idle-state";
import type { InteractionState } from "./interaction-state";

export class DrawingState implements InteractionState {
  sceneManager: SceneManager;
  guidesGraph: GuidesGraph;

  tool: "rectangle" | "ellipse" | "frame";
  startPointWorldSpace: PointData;

  private frameParent: SceneNode | null = null;

  constructor(
    sceneManager: SceneManager,
    tool: "rectangle" | "ellipse" | "frame",
    startPointWorldSpace: PointData,
  ) {
    this.sceneManager = sceneManager;
    this.guidesGraph = sceneManager.guidesGraph; // Initialize guidesGraph
    this.tool = tool;
    this.startPointWorldSpace = startPointWorldSpace;

    if (this.sceneManager.config.data.roundToPixels) {
      this.startPointWorldSpace.x = Math.round(this.startPointWorldSpace.x);
      this.startPointWorldSpace.y = Math.round(this.startPointWorldSpace.y);
    }
  }

  onEnter(): void {
    this.sceneManager.nodeManager.setIsDrawing(true);
    this.sceneManager.didDrag = false;
    // Call startDrawing logic directly on the controller
    this.sceneManager.nodeManager.startDrawing(
      this.startPointWorldSpace,
      this.tool,
    );

    this.frameParent = this.sceneManager.selectionManager.findFrameForPosition(
      this.startPointWorldSpace.x,
      this.startPointWorldSpace.y,
      undefined,
      undefined,
    );
  }

  onExit(): void {
    this.sceneManager.nodeManager.setIsDrawing(false);
    this.frameParent = null;
  }

  onPointerDown(): void {}

  onPointerMove(event: MouseEvent): void {
    if (!this.sceneManager.input) {
      return;
    }

    const worldPoint = this.sceneManager.input.worldMouse;
    if (this.sceneManager.config.data.roundToPixels) {
      worldPoint.x = Math.round(worldPoint.x);
      worldPoint.y = Math.round(worldPoint.y);
    }

    this.sceneManager.nodeManager.updateDrawing(
      worldPoint,
      event.shiftKey,
      event.altKey,
    ); // Call controller directly

    this.sceneManager.didDrag = true;
  }

  onPointerUp(event: MouseEvent): void {
    if (!this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;

    const worldPoint = this.sceneManager.input.worldMouse;
    if (this.sceneManager.config.data.roundToPixels) {
      worldPoint.x = Math.round(worldPoint.x);
      worldPoint.y = Math.round(worldPoint.y);
    }

    const block = this.sceneManager.scenegraph.beginUpdate();

    const newNode = sm.nodeManager.finishDrawing(
      block,
      worldPoint,
      event.shiftKey,
      event.altKey,
      this.frameParent,
    );

    // NOTE(sedivy): Attach all children in the same parent that are overlapping the new frame.
    if (newNode && this.sceneManager.didDrag && newNode?.type === "frame") {
      // NOTE(sedivy): We need to copy the array because we will be modifying it in the loop.
      const children = newNode.parent?.children.slice();
      if (children) {
        for (const child of children) {
          if (child === newNode) {
            continue;
          }

          if (newNode.includesNode(child)) {
            this.sceneManager.scenegraph.moveNodeToGroup(block, newNode, child);
          }
        }
      }
    }

    if (newNode) {
      sm.selectionManager.clearSelection(false);
      sm.setActiveTool("move");
      sm.selectionManager.selectNode(newNode, false, true);
      if (
        newNode.type === "note" ||
        newNode.type === "prompt" ||
        newNode.type === "context"
      ) {
        sm.textEditorManager.startTextEditing(newNode);
      } else {
        sm.stateManager.transitionTo(new IdleState(sm));
      }
    } else {
      sm.stateManager.transitionTo(new IdleState(sm));
    }

    this.sceneManager.scenegraph.commitBlock(block, { undo: true });

    this.frameParent = null;
  }

  onKeyDown?(): void {}
  onKeyUp?(): void {}
  onToolChange?(): void {}

  render() {}
}
