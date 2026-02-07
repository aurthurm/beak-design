import type { Canvas, Path, PathBuilder } from "@highagency/pencil-skia";
import type { Fill } from "../canvas";
import { LayoutMode, type MeshGradientFill, type SceneNode } from "../canvas";
import { Container } from "../canvas/components/container";
import type { MeshGradientPoint } from "../canvas/fill";
import type { ValueWithResolved } from "../managers";
import type { SceneManager } from "../managers/scene-manager";
import { Skia } from "../skia";
import type { SkiaRenderer } from "../skia-renderer";
import { almostEquals, clamp, distance, safeRatio0 } from "../utils/math";
import { IdleState } from "./idle-state";
import type { InteractionState } from "./interaction-state";

enum ControlPointKey {
  Left,
  Right,
  Top,
  Bottom,
}

function setHandle(
  point: MeshGradientPoint,
  key: ControlPointKey,
  value: [number, number],
): MeshGradientPoint {
  switch (key) {
    case ControlPointKey.Left:
      return { ...point, leftHandle: value };
    case ControlPointKey.Right:
      return { ...point, rightHandle: value };
    case ControlPointKey.Top:
      return { ...point, topHandle: value };
    case ControlPointKey.Bottom:
      return { ...point, bottomHandle: value };
    default: {
      const missing: never = key;
      throw new Error(`Unhandled control point key: ${missing}`);
    }
  }
}

function getHandle(
  point: MeshGradientPoint,
  key: ControlPointKey,
): [number, number] {
  switch (key) {
    case ControlPointKey.Left:
      return point.leftHandle;
    case ControlPointKey.Right:
      return point.rightHandle;
    case ControlPointKey.Top:
      return point.topHandle;
    case ControlPointKey.Bottom:
      return point.bottomHandle;
    default: {
      const missing: never = key;
      throw new Error(`Unhandled control point key: ${missing}`);
    }
  }
}

type EditableControlPoint = {
  pointIndex: number;
  controlPoint: ControlPointKey;
};

type DragTarget =
  | { type: "point"; index: number }
  | { type: "controlPoint"; index: number; controlPoint: ControlPointKey };

const DRAG_THRESHOLD = 3;
const SNAP_THRESHOLD = 8;

const OPPOSITE_CONTROL_POINT: Record<ControlPointKey, ControlPointKey> = {
  [ControlPointKey.Left]: ControlPointKey.Right,
  [ControlPointKey.Right]: ControlPointKey.Left,
  [ControlPointKey.Top]: ControlPointKey.Bottom,
  [ControlPointKey.Bottom]: ControlPointKey.Top,
};

export class MeshGradientEditorState implements InteractionState {
  private manager: SceneManager;

  private _view?: Container = undefined;
  private viewDirty: boolean = true;

  private dragTarget?: DragTarget = undefined;
  private dragStartPos?: { x: number; y: number } = undefined;
  private isDragging: boolean = false;

  public selectedPoints: Set<number> = new Set();

  private onSelectionChange?: () => void = undefined;

  public symmetricMode: boolean = true;
  public showOutline: boolean = true;

  private node: SceneNode;
  private fill: ValueWithResolved<MeshGradientFill>;
  private onChange: (fill: Fill) => void;

  constructor(
    manager: SceneManager,
    node: SceneNode,
    fill: ValueWithResolved<MeshGradientFill>,
    onChange: (fill: Fill) => void,
  ) {
    this.manager = manager;
    this.node = node;
    this.fill = fill;
    this.onChange = onChange;
  }

  setSelection(indices: Set<number>): void {
    this.selectedPoints = indices;
    this.invalidateView();
    this.onSelectionChange?.();
  }

  setSelectionCallback(callback: (() => void) | undefined) {
    this.onSelectionChange = callback;
  }

  editFill(
    node: SceneNode,
    fill: ValueWithResolved<MeshGradientFill>,
    onChange: (fill: Fill) => void,
  ): void {
    this.node = node;
    this.fill = fill;
    this.onChange = onChange;

    this.invalidateView();
  }

  // NOTE(sedivy): Return all the editable control points for the currently
  // selected points, including control points on neighboring unselected points.
  private getEditableControlPoints(): EditableControlPoint[] {
    const result: EditableControlPoint[] = [];

    const columns = this.fill.resolved.columns;
    const rows = this.fill.resolved.rows;

    for (const index of this.selectedPoints) {
      const row = Math.floor(index / columns);
      const col = index % columns;

      const leftNeighbor = index - 1;
      const rightNeighbor = index + 1;
      const topNeighbor = index - columns;
      const bottomNeighbor = index + columns;

      if (col > 0) {
        result.push({ pointIndex: index, controlPoint: ControlPointKey.Left });
        if (!this.selectedPoints.has(leftNeighbor)) {
          result.push({
            pointIndex: leftNeighbor,
            controlPoint: ControlPointKey.Right,
          });
        }
      }

      if (col < columns - 1) {
        result.push({ pointIndex: index, controlPoint: ControlPointKey.Right });
        if (!this.selectedPoints.has(rightNeighbor)) {
          result.push({
            pointIndex: rightNeighbor,
            controlPoint: ControlPointKey.Left,
          });
        }
      }

      if (row > 0) {
        result.push({ pointIndex: index, controlPoint: ControlPointKey.Top });
        if (!this.selectedPoints.has(topNeighbor)) {
          result.push({
            pointIndex: topNeighbor,
            controlPoint: ControlPointKey.Bottom,
          });
        }
      }

      if (row < rows - 1) {
        result.push({
          pointIndex: index,
          controlPoint: ControlPointKey.Bottom,
        });
        if (!this.selectedPoints.has(bottomNeighbor)) {
          result.push({
            pointIndex: bottomNeighbor,
            controlPoint: ControlPointKey.Top,
          });
        }
      }
    }

    return result;
  }

  private getView(): Container {
    if (!this.viewDirty && this._view) {
      return this._view;
    }

    if (this._view) {
      this._view.destroy();
      this._view = undefined;
    }

    const zoom = this.manager.camera.zoom;

    const bounds = this.node.localBounds();

    const children: Container[] = [];

    if (!this.isDragging) {
      if (this.selectedPoints.size > 0) {
        const size = 8 / zoom;

        const editableControlPoints = this.getEditableControlPoints();

        for (const cp of editableControlPoints) {
          const point = this.fill.resolved.points[cp.pointIndex];
          const offset = getHandle(point, cp.controlPoint);

          const cpX = (point.position[0] + offset[0]) * bounds.width - size / 2;
          const cpY =
            (point.position[1] + offset[1]) * bounds.height - size / 2;

          children.push(
            new Container({
              x: cpX,
              y: cpY,
              width: size,
              height: size,
              cornerRadius: size / 2,
              backgroundColor: "#000000",
              outlineColor: "#ffffff",
              outlineWidth: 1 / zoom,
              cursor: "grab",

              onPointerDown: () => {
                if (!this.manager.input) return;

                this.dragTarget = {
                  type: "controlPoint",
                  index: cp.pointIndex,
                  controlPoint: cp.controlPoint,
                };
                this.dragStartPos = {
                  x: this.manager.input.mouse.canvas.x,
                  y: this.manager.input.mouse.canvas.y,
                };
              },
            }),
          );
        }
      }

      for (let i = 0; i < this.fill.resolved.points.length; i++) {
        const point = this.fill.resolved.points[i];
        const isSelected = this.selectedPoints.has(i);

        const size = (isSelected ? 14 : 12) / zoom;

        const x = point.position[0] * bounds.width - size / 2;
        const y = point.position[1] * bounds.height - size / 2;

        children.push(
          new Container({
            x,
            y,
            width: size,
            height: size,
            cornerRadius: size,
            backgroundColor: point.color,
            outlineColor: isSelected ? "#ffffff" : "#00000088",
            outlineWidth: (isSelected ? 2 : 1) / zoom,
            cursor: "grab",

            onPointerDown: (e: MouseEvent) => {
              if (!this.manager.input) return;

              if (e.shiftKey) {
                const newSelection = new Set(this.selectedPoints);

                if (isSelected) {
                  newSelection.delete(i);
                } else {
                  newSelection.add(i);
                }

                this.setSelection(newSelection);
              } else {
                this.setSelection(new Set([i]));
              }

              this.dragTarget = { type: "point", index: i };
              this.dragStartPos = {
                x: this.manager.input.mouse.canvas.x,
                y: this.manager.input.mouse.canvas.y,
              };
            },
          }),
        );
      }
    }

    this._view = new Container({
      width: bounds.width,
      height: bounds.height,
      layout: LayoutMode.None,
      onPointerDown: () => {
        this.setSelection(new Set());

        // NOTE(sedivy): Clicking outside the view exits the editor. Add this onClick so
        // clicking on the node itself doesn't trigger that.
      },
      children,
    });

    this._view.performLayout();
    this.viewDirty = false;

    return this._view;
  }

  private invalidateView(): void {
    this.viewDirty = true;
    this.manager.requestFrame();
  }

  onEnter(): void {
    this.manager.guidesGraph.hideAllBoundingBoxes();

    this.manager.camera.on("zoom", this.onCameraZoom);
  }

  onExit(): void {
    this.manager.guidesGraph.showAllBoundingBoxes();
    if (this._view) {
      this._view.destroy();
      this._view = undefined;
    }

    this.manager.camera.off("zoom", this.onCameraZoom);
  }

  onCameraZoom = (): void => {
    // NOTE(sedivy): To keep the control points the same size on screen, we need
    // to re-render the view when the zoom changes.
    this.invalidateView();
  };

  onPointerDown(event: MouseEvent): void {
    if (!this.manager.input) return;

    const localPointer = this.node
      .getWorldMatrix()
      .applyInverse(this.manager.input.worldMouse);

    if (
      this.getView().handleViewPointerDown(
        event,
        localPointer.x,
        localPointer.y,
      )
    ) {
      return;
    }

    // NOTE(sedivy): Clicked outside the view. Deselect the current point or
    // exit the editor.

    if (this.selectedPoints.size > 0) {
      this.setSelection(new Set());
    } else {
      // NOTE(sedivy): Clear the selection to close properties panel.
      this.manager.selectionManager.setSelection(new Set());
      this.manager.stateManager.transitionTo(new IdleState(this.manager));
    }
  }

  onPointerMove(event: MouseEvent): void {
    if (!this.manager.input) return;

    const bounds = this.node.localBounds();

    const localPointer = this.node
      .getWorldMatrix()
      .applyInverse(this.manager.input.worldMouse);

    if (this.dragTarget != null) {
      // NOTE(sedivy): Don't start dragging until we've moved enough
      if (!this.isDragging && this.dragStartPos) {
        if (
          distance(this.manager.input.mouse.canvas, this.dragStartPos) <
          DRAG_THRESHOLD
        ) {
          return;
        }
      }

      this.isDragging = true;

      let normalizedX = safeRatio0(localPointer.x, bounds.width);
      let normalizedY = safeRatio0(localPointer.y, bounds.height);

      // NOTE(sedivy): Simple edge snapping
      if (!event.ctrlKey) {
        const threshold = SNAP_THRESHOLD / this.manager.camera.zoom;

        if (almostEquals(localPointer.x, 0, threshold)) {
          normalizedX = 0;
        }
        if (almostEquals(localPointer.x, bounds.width, threshold)) {
          normalizedX = 1;
        }
        if (almostEquals(localPointer.y, 0, threshold)) {
          normalizedY = 0;
        }
        if (almostEquals(localPointer.y, bounds.height, threshold)) {
          normalizedY = 1;
        }
      }

      const newPoints = [...this.fill.value.points];

      if (this.dragTarget.type === "point") {
        newPoints[this.dragTarget.index] = {
          ...newPoints[this.dragTarget.index],
          position: [normalizedX, normalizedY],
        };
      } else {
        const point = this.fill.resolved.points[this.dragTarget.index];

        const offsetX = normalizedX - point.position[0];
        const offsetY = normalizedY - point.position[1];

        let updated = setHandle(
          newPoints[this.dragTarget.index],
          this.dragTarget.controlPoint,
          [offsetX, offsetY],
        );

        if (this.symmetricMode) {
          const oppositeKey =
            OPPOSITE_CONTROL_POINT[this.dragTarget.controlPoint];
          updated = setHandle(updated, oppositeKey, [-offsetX, -offsetY]);
        }

        newPoints[this.dragTarget.index] = updated;
      }

      this.onChange({ ...this.fill.value, points: newPoints });
      return;
    }

    const cursor = this.getView().cursorForPoint(
      localPointer.x,
      localPointer.y,
    );
    if (cursor) {
      this.manager.setCursor(cursor);
    }
  }

  onPointerUp(_event: MouseEvent): void {
    if (this.dragTarget != null) {
      this.dragTarget = undefined;
      this.dragStartPos = undefined;
      this.isDragging = false;
      this.invalidateView();
    }
  }

  render(renderer: SkiaRenderer, canvas: Canvas): void {
    const saveCount = canvas.getSaveCount();

    canvas.save();
    canvas.concat(this.node.getWorldMatrix().toArray());

    if (!this.isDragging) {
      const bounds = this.node.localBounds();
      const points = this.fill.resolved.points;

      // NOTE(sedivy): Draw a grid overlay
      if (this.showOutline) {
        // TODO(sedivy): Cache the generated path?
        const path = buildLineMeshGrid(
          this.fill.resolved.columns,
          this.fill.resolved.rows,
          points,
          bounds.width,
          bounds.height,
        );

        const paint = new Skia.Paint();
        paint.setAntiAlias(true);
        paint.setColorComponents(0, 0, 0, 0.3);
        paint.setStyle(Skia.PaintStyle.Stroke);
        paint.setStrokeWidth(1 / this.manager.camera.zoom);
        canvas.drawPath(path, paint);
        paint.delete();

        path.delete();
      }

      // NOTE(sedivy): Draw control point lines for selected point
      if (this.selectedPoints.size > 0) {
        const paint = new Skia.Paint();
        paint.setAntiAlias(true);
        paint.setColorComponents(0, 0, 0, 0.5);
        paint.setStyle(Skia.PaintStyle.Stroke);
        paint.setStrokeWidth(1 / this.manager.camera.zoom);

        const editableControlPoints = this.getEditableControlPoints();

        for (const cp of editableControlPoints) {
          const point = points[cp.pointIndex];
          const offset = getHandle(point, cp.controlPoint);

          const pointX = point.position[0] * bounds.width;
          const pointY = point.position[1] * bounds.height;

          const cpX = (point.position[0] + offset[0]) * bounds.width;
          const cpY = (point.position[1] + offset[1]) * bounds.height;

          canvas.drawLine(pointX, pointY, cpX, cpY, paint);
        }

        paint.delete();
      }
    }

    this.getView().render(renderer, canvas);

    canvas.restoreToCount(saveCount);
  }

  onKeyDown(): void {}
  onKeyUp(): void {}

  onToolChange(): void {}
}

function buildLineMeshGrid(
  columns: number,
  rows: number,
  points: MeshGradientPoint[],
  width: number,
  height: number,
): Path {
  const builder = new Skia.PathBuilder();

  // NOTE(sedivy): Horizontal edges
  for (let row = 0; row < rows; row++) {
    const firstPoint = points[row * columns];
    builder.moveTo(
      firstPoint.position[0] * width,
      firstPoint.position[1] * height,
    );

    for (let col = 0; col < columns - 1; col++) {
      const leftIndex = row * columns + col;
      const rightIndex = leftIndex + 1;
      const leftPoint = points[leftIndex];
      const rightPoint = points[rightIndex];

      builder.cubicTo(
        (leftPoint.position[0] + leftPoint.rightHandle[0]) * width,
        (leftPoint.position[1] + leftPoint.rightHandle[1]) * height,
        (rightPoint.position[0] + rightPoint.leftHandle[0]) * width,
        (rightPoint.position[1] + rightPoint.leftHandle[1]) * height,
        rightPoint.position[0] * width,
        rightPoint.position[1] * height,
      );
    }
  }

  // NOTE(sedivy): Vertical edges
  for (let col = 0; col < columns; col++) {
    const firstPoint = points[col];
    builder.moveTo(
      firstPoint.position[0] * width,
      firstPoint.position[1] * height,
    );

    for (let row = 0; row < rows - 1; row++) {
      const topIndex = row * columns + col;
      const bottomIndex = topIndex + columns;
      const topPoint = points[topIndex];
      const bottomPoint = points[bottomIndex];

      builder.cubicTo(
        (topPoint.position[0] + topPoint.bottomHandle[0]) * width,
        (topPoint.position[1] + topPoint.bottomHandle[1]) * height,
        (bottomPoint.position[0] + bottomPoint.topHandle[0]) * width,
        (bottomPoint.position[1] + bottomPoint.topHandle[1]) * height,
        bottomPoint.position[0] * width,
        bottomPoint.position[1] * height,
      );
    }
  }

  return builder.detachAndDelete();
}
