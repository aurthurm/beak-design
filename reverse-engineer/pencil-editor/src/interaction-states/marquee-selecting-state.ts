import type { Canvas } from "@highagency/pencil-skia";
import type { PointData } from "pixi.js";
import type { SceneNode } from "../canvas/scene-node";
import type { SceneManager } from "../managers/scene-manager";
import { Skia } from "../skia";
import type { SkiaRenderer } from "../skia-renderer";
import type { ReadOnlyBounds } from "../utils/bounds";
import { COLORS } from "../utils/constants";
import { rectangleFromPoints } from "../utils/math";
import { IdleState } from "./idle-state";
import type { InteractionState } from "./interaction-state";

export class MarqueeSelectingState implements InteractionState {
  sceneManager: SceneManager;

  private active: boolean = false;

  private startWorldPoint: PointData;
  private endWorldPoint: PointData = { x: 0, y: 0 };

  private initialSelection: Set<SceneNode>;

  constructor(
    sceneManager: SceneManager,
    startScreenPoint: PointData,
    shiftKeyPressed: boolean,
  ) {
    this.sceneManager = sceneManager;
    this.startWorldPoint = sceneManager.camera.toWorld(
      startScreenPoint.x,
      startScreenPoint.y,
    );

    this.initialSelection = new Set(
      this.sceneManager.selectionManager.selectedNodes,
    );

    if (!shiftKeyPressed) {
      this.sceneManager.selectionManager.clearSelection();
    }
  }

  onEnter(): void {
    const sm = this.sceneManager;
    sm.didDrag = false;

    this.active = false;
  }

  onExit(): void {
    this.active = false;
  }

  onPointerDown(): void {
    this.active = false;
  }

  onPointerMove(): void {
    if (!this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;
    const worldPoint = this.sceneManager.input.worldMouse;
    sm.didDrag = true;
    this.endWorldPoint = worldPoint;
    this.active = true;

    const worldRect = rectangleFromPoints(
      this.startWorldPoint.x,
      this.startWorldPoint.y,
      this.endWorldPoint.x,
      this.endWorldPoint.y,
    );

    const nodesInRect = this.findNodesInRect(worldRect);

    const selection = new Set(this.initialSelection);

    for (const node of nodesInRect) {
      if (this.initialSelection.has(node)) {
        selection.delete(node);
      } else {
        selection.add(node);
      }
    }

    this.sceneManager.selectionManager.setSelection(selection);
  }

  onPointerUp(): void {
    if (!this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;
    const worldPoint = this.sceneManager.input.worldMouse;
    this.endWorldPoint = worldPoint;

    sm.stateManager.transitionTo(new IdleState(sm));
    this.active = false;
  }

  onKeyDown?(): void {}
  onKeyUp?(): void {}
  onToolChange?(): void {}

  private findNodesInRect(worldRect: ReadOnlyBounds): SceneNode[] {
    const nodesFound: SceneNode[] = [];
    this.findNodesInRectRecursive(
      worldRect,
      this.sceneManager.scenegraph.getViewportNode(),
      nodesFound,
    );
    return nodesFound;
  }

  private findNodesInRectRecursive(
    worldRect: ReadOnlyBounds,
    containerToSearch: SceneNode,
    output: SceneNode[],
  ): SceneNode[] {
    for (const node of containerToSearch.children) {
      if (!node.properties.resolved.enabled) {
        continue;
      }

      // NOTE(sedivy): If the selection rectangle fully covers the frame, then we allow frame selection
      if (node.type === "frame") {
        const nodeWorldBounds = node.getWorldBounds();

        if (
          worldRect.x < nodeWorldBounds.left &&
          worldRect.y < nodeWorldBounds.top &&
          worldRect.x + worldRect.width > nodeWorldBounds.right &&
          worldRect.y + worldRect.height > nodeWorldBounds.bottom
        ) {
          output.push(node);
          continue;
        }
      }

      if (node.intersectBounds(worldRect)) {
        if (
          node.type === "frame" &&
          node.children.length > 0 &&
          !node.hasParent()
        ) {
          this.findNodesInRectRecursive(worldRect, node, output);
        } else {
          output.push(node);
        }
      }
    }

    return output;
  }

  render(renderer: SkiaRenderer, canvas: Canvas) {
    if (this.active) {
      const minX = Math.min(this.startWorldPoint.x, this.endWorldPoint.x);
      const minY = Math.min(this.startWorldPoint.y, this.endWorldPoint.y);
      const maxX = Math.max(this.startWorldPoint.x, this.endWorldPoint.x);
      const maxY = Math.max(this.startWorldPoint.y, this.endWorldPoint.y);

      const zoom = this.sceneManager.camera.zoom;

      const thickness = 1 / zoom;

      const paint = new Skia.Paint();
      paint.setColor(COLORS.LIGHT_BLUE);

      // fill
      paint.setStyle(Skia.PaintStyle.Fill);
      paint.setAlphaf(0.1);
      canvas.drawRect4f(minX, minY, maxX, maxY, paint);

      // stroke
      paint.setStyle(Skia.PaintStyle.Stroke);
      paint.setStrokeWidth(thickness);
      paint.setAlphaf(1.0);
      canvas.drawRect4f(
        minX - thickness / 2,
        minY - thickness / 2,
        maxX + thickness / 2,
        maxY + thickness / 2,
        paint,
      );

      paint.delete();
    }
  }
}
