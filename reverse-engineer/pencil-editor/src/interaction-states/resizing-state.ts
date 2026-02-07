import { Matrix, Point, type PointData } from "pixi.js";
import { SizingBehavior } from "../canvas/layout";
import { NodeUtils } from "../canvas/node-utils";
import { TextNode } from "../canvas/nodes/text-node";
import type { ObjectUpdateBlock } from "../canvas/object-update-block";
import type { SceneNode } from "../canvas/scene-node";
import type { HandleType, SceneManager } from "../managers/scene-manager";
import type { Bounds, ReadOnlyBounds } from "../utils/bounds";
import { almostEquals, safeRatio0 } from "../utils/math";
import { IdleState } from "./idle-state";
import type { InteractionState } from "./interaction-state";

interface NodeInitialState {
  node: SceneNode;
  localWidth: number;
  localHeight: number;
  worldTransform: Matrix;
  worldTransformInverse: Matrix;
  flipX: boolean;
  flipY: boolean;
}

export class ResizingState implements InteractionState {
  private sceneManager: SceneManager;

  private handle: HandleType;
  private startPoint: PointData;

  private cursor: string;

  private resizeStartNodeStates: Map<SceneNode, NodeInitialState> = new Map();
  private initialBounds: Bounds | null = null;

  private boundingBoxToWorld: Matrix = new Matrix();
  private worldToBoundingBox: Matrix = new Matrix();

  private originalUndoSnapshot: ObjectUpdateBlock | null = null;

  constructor(
    sceneManager: SceneManager,
    startPoint: Point,
    handle: HandleType,
    cursor: string,
  ) {
    this.sceneManager = sceneManager;
    this.handle = handle;
    this.startPoint = sceneManager.camera.toWorld(startPoint.x, startPoint.y);

    this.cursor = cursor;
  }

  private captureNodeInitialState(node: SceneNode): NodeInitialState {
    const localBounds = node.localBounds();
    const worldTransform = node.getWorldMatrix().clone();

    // NOTE(sedivy): Snapshot all properties that will be modified in the onPointerMove event.
    this.originalUndoSnapshot?.snapshotProperties(node, [
      "textGrowth",
      "horizontalSizing",
      "verticalSizing",
      "flipX",
      "flipY",
      "width",
      "height",
      "x",
      "y",
    ]);

    return {
      node: node,
      localWidth: localBounds.width,
      localHeight: localBounds.height,
      worldTransform: worldTransform,
      worldTransformInverse: worldTransform.clone().invert(),
      flipX: node.properties.resolved.flipX ?? false,
      flipY: node.properties.resolved.flipY ?? false,
    };
  }

  private collectInitialStatesRecursively(node: SceneNode) {
    this.resizeStartNodeStates.set(node, this.captureNodeInitialState(node));

    if (node.type === "group") {
      for (const childNode of node.children) {
        this.collectInitialStatesRecursively(childNode);
      }
    }
  }

  onEnter(): void {
    const sm = this.sceneManager;
    sm.didDrag = false;

    let initialBounds: Bounds | null = null;

    this.boundingBoxToWorld.identity();

    this.originalUndoSnapshot = this.sceneManager.scenegraph.beginUpdate();

    if (sm.selectionManager.selectedNodes.size === 1) {
      const node = sm.selectionManager.selectedNodes.values().next().value;
      if (node) {
        initialBounds = node.localBounds().clone();
        this.boundingBoxToWorld.copyFrom(node.getWorldMatrix());
      }
    } else {
      initialBounds = NodeUtils.calculateCombinedBoundsNew(
        sm.selectionManager.selectedNodes,
      );

      if (initialBounds) {
        this.boundingBoxToWorld.tx = initialBounds.x;
        this.boundingBoxToWorld.ty = initialBounds.y;

        initialBounds.move(0, 0);
      }
    }

    this.worldToBoundingBox.copyFrom(this.boundingBoxToWorld).invert();

    if (
      initialBounds == null ||
      initialBounds.width <= 0 ||
      initialBounds.height <= 0
    ) {
      sm.stateManager.transitionTo(new IdleState(sm));
      return;
    }

    for (const node of sm.selectionManager.selectedNodes) {
      this.collectInitialStatesRecursively(node);
    }

    this.initialBounds = initialBounds;

    sm.guidesManager.clear();
  }

  onExit(): void {
    this.initialBounds = null;
    this.sceneManager.snapManager.reset();
  }

  onPointerMove(event: MouseEvent): void {
    this.sceneManager.snapManager.reset();

    if (!this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;
    const currentPoint = this.sceneManager.input.worldMouse;

    const initialBounds = this.initialBounds;
    if (initialBounds == null) {
      return;
    }

    sm.setCursor(this.cursor);

    sm.didDrag = true;

    const finalBounds = this.calculateResizeBounds(
      initialBounds,
      this.worldToBoundingBox.apply(this.startPoint),
      this.worldToBoundingBox.apply(currentPoint),
      this.handle,
      event.shiftKey,
      event.ctrlKey,
      event.altKey,
    );

    const resizeTransform = this.createResizeTransformMatrix(
      initialBounds,
      finalBounds,
    );

    const flipX = finalBounds.width < 0;
    const flipY = finalBounds.height < 0;

    const block = this.sceneManager.scenegraph.beginUpdate();

    for (const node of this.sceneManager.selectionManager.selectedNodes) {
      this.applyMatrixTransformToNode(
        block,
        node,
        resizeTransform,
        flipX,
        flipY,
        true,
      );
    }

    this.sceneManager.scenegraph.commitBlock(block, { undo: false });

    this.sceneManager.selectionManager.updateMultiSelectGuides();
    this.sceneManager.nodeManager._schedulePostTransformUpdates(false, true);
  }

  onPointerUp(): void {
    const sm = this.sceneManager;

    sm.guidesManager.clear();

    if (this.originalUndoSnapshot) {
      this.sceneManager.scenegraph.commitBlock(this.originalUndoSnapshot, {
        undo: true,
      });
      this.originalUndoSnapshot = null;
    }

    requestAnimationFrame(() => {
      sm.guidesManager.updateMultiSelectGuides();
    });

    sm.stateManager.transitionTo(new IdleState(sm));
  }

  private createResizeTransformMatrix(
    initialBounds: ReadOnlyBounds,
    finalBounds: ReadOnlyBounds,
  ): Matrix {
    const scaleX = finalBounds.width / initialBounds.width;
    const scaleY = finalBounds.height / initialBounds.height;

    const fixedPoint = this.getFixedPointForResize(initialBounds, this.handle);

    const finalFixedPoint = this.getFixedPointForResize(
      finalBounds,
      this.handle,
    );

    const transform = new Matrix();

    transform.translate(-fixedPoint.x, -fixedPoint.y);
    transform.scale(scaleX, scaleY);
    transform.translate(finalFixedPoint.x, finalFixedPoint.y);

    return transform;
  }

  private applyMatrixTransformToNode(
    block: ObjectUpdateBlock,
    node: SceneNode,
    resizeTransform: Matrix,
    flipX: boolean,
    flipY: boolean,
    allowRounding: boolean,
  ): void {
    const initialNodeState = this.resizeStartNodeStates.get(node);
    if (!initialNodeState) {
      return;
    }

    const worldTransform = initialNodeState.worldTransform;

    // Step 1: Convert world transform to bounds space
    const initialBoundsTransform = new Matrix()
      .append(this.worldToBoundingBox)
      .append(worldTransform);

    // Step 2: Apply resize transformation in bounds space
    const transformedBoundsTransform = new Matrix()
      .append(resizeTransform)
      .append(initialBoundsTransform);

    // Step 3: Convert back to world space
    const finalWorldTransform = new Matrix()
      .append(this.boundingBoxToWorld)
      .append(transformedBoundsTransform);

    this.applyWorldTransformToNode(
      block,
      node,
      initialNodeState,
      finalWorldTransform,
      flipX,
      flipY,
      allowRounding,
    );

    for (const childNode of node.children) {
      this.applyMatrixTransformToNode(
        block,
        childNode,
        resizeTransform,
        flipX,
        flipY,
        false,
      );
    }
  }

  private applyWorldTransformToNode(
    block: ObjectUpdateBlock,
    node: SceneNode,
    initialState: NodeInitialState,
    finalWorldTransform: Matrix,
    flipX: boolean,
    flipY: boolean,
    allowRounding: boolean,
  ): void {
    const transformationMatrix = new Matrix()
      .append(initialState.worldTransformInverse)
      .append(finalWorldTransform);

    const scaleX = Math.sqrt(
      transformationMatrix.a * transformationMatrix.a +
        transformationMatrix.c * transformationMatrix.c,
    );
    const scaleY = Math.sqrt(
      transformationMatrix.b * transformationMatrix.b +
        transformationMatrix.d * transformationMatrix.d,
    );

    let newWidth = Math.max(1, initialState.localWidth * scaleX);
    let newHeight = Math.max(1, initialState.localHeight * scaleY);

    if (allowRounding && this.sceneManager.config.data.roundToPixels) {
      newWidth = Math.round(newWidth);
      newHeight = Math.round(newHeight);
    }

    const newLocalPosition = node.toLocalPointFromParent(
      finalWorldTransform.tx,
      finalWorldTransform.ty,
    );

    // NOTE(sedivy): Do an automatic conversion from dynamic sizes to fixed sizes
    // based on the modified axis.
    //
    // TODO(sedivy): Maybe this should be implicit by calling updateSize, but we
    // don't have a system to distinguish between user actions and programmatic actions.
    {
      const modifiedX = !almostEquals(initialState.localWidth, newWidth);
      const modifiedY = !almostEquals(initialState.localHeight, newHeight);

      if (modifiedX || modifiedY) {
        if (node instanceof TextNode) {
          if (
            node.properties.resolved.textGrowth == null ||
            node.properties.resolved.textGrowth === "auto"
          ) {
            const value = modifiedY ? "fixed-width-height" : "fixed-width";

            block.update(node, {
              textGrowth: value,
            });
          } else if (node.properties.resolved.textGrowth === "fixed-width") {
            if (modifiedY) {
              block.update(node, {
                textGrowth: "fixed-width-height",
              });
            }
          }
        }

        const update = {
          horizontalSizing: node.properties.horizontalSizing,
          verticalSizing: node.properties.verticalSizing,
        };

        if (modifiedX) {
          if (
            // NOTE(sedivy): Auto convert FitContent if it's valid
            (node.properties.resolved.horizontalSizing ===
              SizingBehavior.FitContent &&
              node.children.some((n) => n.affectsLayout())) ||
            // NOTE(sedivy): Auto convert FillContainer if it's valid
            (node.properties.resolved.horizontalSizing ===
              SizingBehavior.FillContainer &&
              node.isInLayout())
          ) {
            update.horizontalSizing = SizingBehavior.Fixed;
          }
        }

        if (modifiedY) {
          if (
            // NOTE(sedivy): Auto convert FitContent if it's valid
            (node.properties.resolved.verticalSizing ===
              SizingBehavior.FitContent &&
              node.children.some((n) => n.affectsLayout())) ||
            // NOTE(sedivy): Auto convert FillContainer if it's valid
            (node.properties.resolved.verticalSizing ===
              SizingBehavior.FillContainer &&
              node.isInLayout())
          ) {
            update.verticalSizing = SizingBehavior.Fixed;
          }
        }

        block.update(node, update);
      }
    }

    block.update(node, {
      flipX: flipX !== initialState.flipX,
      flipY: flipY !== initialState.flipY,
      width: newWidth,
      height: newHeight,
      x: newLocalPosition.x,
      y: newLocalPosition.y,
    });
  }

  private getFixedPointForResize(
    bounds: ReadOnlyBounds,
    handle: HandleType,
  ): Point {
    let fixedX = bounds.x;
    let fixedY = bounds.y;

    if (handle.includes("t")) {
      fixedY = bounds.y + bounds.height;
    }
    if (handle.includes("l")) {
      fixedX = bounds.x + bounds.width;
    }
    if (handle.includes("b")) {
      fixedY = bounds.y;
    }
    if (handle.includes("r")) {
      fixedX = bounds.x;
    }

    return new Point(fixedX, fixedY);
  }

  private getPointForHandle(bounds: ReadOnlyBounds, handle: HandleType): Point {
    let x = bounds.x;
    let y = bounds.y;

    if (handle.includes("t")) {
      y = bounds.y;
    }
    if (handle.includes("l")) {
      x = bounds.x;
    }
    if (handle.includes("b")) {
      y = bounds.y + bounds.height;
    }
    if (handle.includes("r")) {
      x = bounds.x + bounds.width;
    }

    return new Point(x, y);
  }

  private setPointForHandle(bounds: Bounds, handle: HandleType, point: Point) {
    if (handle.includes("t")) {
      bounds.minY = point.y;
    }

    if (handle.includes("l")) {
      bounds.minX = point.x;
    }

    if (handle.includes("b")) {
      bounds.maxY = point.y;
    }

    if (handle.includes("r")) {
      bounds.maxX = point.x;
    }
  }

  private calculateResizeBounds(
    initialBounds: Bounds,
    startPoint: Point,
    currentPoint: Point,
    handle: HandleType,
    proportionalResize: boolean,
    ignoreSnap: boolean,
    symmetricResize: boolean,
  ): Bounds {
    // We need the delta relative to the start point to apply to the *initial* bounds
    let deltaX = currentPoint.x - startPoint.x;
    let deltaY = currentPoint.y - startPoint.y;

    // NOTE(sedivy): Snap the resizing point to other objects.
    if (this.sceneManager.config.data.snapToObjects && !ignoreSnap) {
      const enabledAxes: [boolean, boolean] = [false, false];

      const c = this.boundingBoxToWorld.c;
      const b = this.boundingBoxToWorld.b;

      const epsilon = 1e-14;

      // NOTE(sedivy): We want to know which side we are resizing so we only
      // snap in the single axis.
      //
      // But we can't just use the `handle` type to know which axis we
      // are resizing because if an object is rotated, then the top/bottom
      // and left/right are pointing into the wrong direction.
      //
      // This is easy for the corners because they should always be snapped
      // and we always know the 2d coordinates.
      //
      // But for sides it's more tricky. We only want to allow snapping for
      // rotated sides when it's a 90º interval. The reason is we need to
      // provide an axis-aligned value for the snap, but if it's rotated then
      // it's not axis-aligned and we don't even have a 2d point.
      //
      // I tried to expand the side into two points, so when resizing "top" it
      // would use "top-left" and "top-right" points for snapping, but I was
      // running into weird issues and the code was starting to get messy.
      //
      // Maybe we can revisit it later, but I tested other editors and they
      // don't allow side snapping for rotated objects either so we are not
      // losing any expected features.
      switch (handle) {
        case "br":
        case "bl":
        case "tr":
        case "tl": {
          // NOTE(sedivy): When we are resizing the corners we know we want to
          // always snap both axes.
          enabledAxes[0] = true;
          enabledAxes[1] = true;
          break;
        }

        case "b":
        case "t": {
          if (almostEquals(b, 0, epsilon) && almostEquals(c, 0, epsilon)) {
            enabledAxes[1] = true;
          }

          if (
            almostEquals(Math.abs(b), 1, epsilon) &&
            almostEquals(Math.abs(c), 1, epsilon)
          ) {
            enabledAxes[0] = true;
          }
          break;
        }

        case "l":
        case "r": {
          if (almostEquals(b, 0, epsilon) && almostEquals(c, 0, epsilon)) {
            enabledAxes[0] = true;
          }

          if (
            almostEquals(Math.abs(b), 1, epsilon) &&
            almostEquals(Math.abs(c), 1, epsilon)
          ) {
            enabledAxes[1] = true;
          }
          break;
        }
      }

      if (enabledAxes[0] || enabledAxes[1]) {
        // NOTE(sedivy): Find the point we are moving.
        const point = this.getPointForHandle(initialBounds, handle);
        point.x += deltaX;
        point.y += deltaY;

        // NOTE(sedivy): Convert the point from bounding box space to world space for snapping.
        const pointWorldSpace = this.boundingBoxToWorld.apply(point);

        // NOTE(sedivy): Snap the point.
        const offset = this.sceneManager.snapManager.snapPoint(
          [pointWorldSpace.x, pointWorldSpace.y],
          this.sceneManager.selectionManager.selectedNodes,
          enabledAxes[0] && enabledAxes[1],
          enabledAxes,
        );
        pointWorldSpace.x += offset[0];
        pointWorldSpace.y += offset[1];

        // NOTE(sedivy): Convert back to bounding box space and write it to delta.
        const snappedBoundingBoxPoint =
          this.worldToBoundingBox.apply(pointWorldSpace);
        deltaX += snappedBoundingBoxPoint.x - point.x;
        deltaY += snappedBoundingBoxPoint.y - point.y;
      }
    }

    const result = initialBounds.clone();

    const aspectRatio = safeRatio0(initialBounds.width, initialBounds.height);

    const movingPoint = this.getPointForHandle(initialBounds, handle);

    // NOTE(sedivy): Move the corner/side to the new position. This also handles
    // symmetric resize by moving the side twice the distance. We handle centering
    // the bounding box later.
    movingPoint.x += deltaX * (symmetricResize ? 2 : 1);
    movingPoint.y += deltaY * (symmetricResize ? 2 : 1);

    if (this.sceneManager.config.data.roundToPixels) {
      movingPoint.x = Math.round(movingPoint.x);
      movingPoint.y = Math.round(movingPoint.y);
    }

    // NOTE(sedivy): Set one of the corners/sides based on the new position.
    this.setPointForHandle(result, handle, movingPoint);

    let alignOnX = symmetricResize;
    let alignOnY = symmetricResize;

    if (proportionalResize) {
      switch (handle) {
        case "b":
        case "t": {
          result.width =
            Math.abs(result.height * aspectRatio) * Math.sign(result.width);

          alignOnX = true;
          break;
        }

        case "l":
        case "r": {
          result.height =
            Math.abs(safeRatio0(result.width, aspectRatio)) *
            Math.sign(result.height);

          alignOnY = true;
          break;
        }

        default: {
          const widthRatio = Math.abs(
            safeRatio0(result.width, initialBounds.width),
          );
          const heightRatio = Math.abs(
            safeRatio0(result.height, initialBounds.height),
          );

          const originalWidth = result.width;
          const originalHeight = result.height;

          if (widthRatio > heightRatio) {
            result.height =
              Math.abs(safeRatio0(result.width, aspectRatio)) *
              Math.sign(result.height);
          } else {
            result.width =
              Math.abs(result.height * aspectRatio) * Math.sign(result.width);
          }

          if (handle.includes("t")) {
            result.y -= result.height - originalHeight;
          }

          if (handle.includes("l")) {
            result.x -= result.width - originalWidth;
          }
          break;
        }
      }
    }

    if (alignOnX) {
      result.x = initialBounds.x + initialBounds.width / 2 - result.width / 2;
    }

    if (alignOnY) {
      result.y = initialBounds.y + initialBounds.height / 2 - result.height / 2;
    }

    return result;
  }

  onPointerDown(): void {}
  onKeyDown?() {}
  onKeyUp?() {}
  onToolChange?() {}
  render() {}
}
