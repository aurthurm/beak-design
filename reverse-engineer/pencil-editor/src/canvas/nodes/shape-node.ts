import type * as Schema from "@ha/schema";
import type { Canvas, Path, PathBuilder } from "@highagency/pencil-skia";
import { Matrix } from "pixi.js";
import { optimizeSvgPathData } from "../../managers/svg";
import { addRoundRectangleToPath, Skia } from "../../skia";
import type { SkiaRenderer } from "../../skia-renderer";
import { StrokePath } from "../../stroke-path";
import { Bounds, type ReadOnlyBounds } from "../../utils/bounds";
import { radToDeg, safeRatio0 } from "../../utils/math";
import { expandBoundingBoxWithEffects } from "../effect";
import { isAnyFillVisible } from "../fill";
import { type NodeProperties, StrokeAlignment } from "../scene-graph";
import { SceneNode } from "../scene-node";
import {
  serializeCommon,
  serializeCornerRadius,
  serializeEffects,
  serializeFill,
  serializeSize,
  serializeStroke,
  serializeValue,
} from "../serializer";

export class ShapeNode extends SceneNode {
  private _fillPath: Path | null = null;
  private _fillPathBoundingBox: Bounds = new Bounds();
  private fillPathDirty: boolean = true;

  private strokePath: StrokePath = new StrokePath(this);

  private _maskPath?: Path = undefined;

  constructor(
    id: string,
    type: "path" | "rectangle" | "ellipse" | "line" | "polygon",
    properties: NodeProperties,
  ) {
    super(id, type, properties);

    this.updateLayoutConfiguration();
  }

  override onPropertyChanged(property: keyof NodeProperties) {
    super.onPropertyChanged(property);

    if (
      property === "cornerRadius" ||
      property === "pathData" ||
      property === "polygonCount" ||
      property === "width" ||
      property === "height"
    ) {
      this.fillPathDirty = true;
    }

    this.strokePath.onPropertyChanged(property);
  }

  getVisualLocalBounds(): ReadOnlyBounds {
    const fillPath = this.getFillPath();

    const bounds = this._visualLocalBounds;
    bounds.copyFrom(fillPath.bounds);

    if (isAnyFillVisible(this.properties.resolved.strokeFills)) {
      if (this.type === "rectangle") {
        const strokeWidth = this.properties.resolved.strokeWidth;
        if (strokeWidth != null) {
          const strokeAlignment = this.properties.resolved.strokeAlignment;

          let scale = 0;

          switch (strokeAlignment) {
            case StrokeAlignment.Center:
              scale = 0.5;
              break;
            case StrokeAlignment.Outside:
              scale = 1;
              break;
          }

          if (scale) {
            bounds.minX -= strokeWidth[3] * scale;
            bounds.minY -= strokeWidth[0] * scale;
            bounds.maxX += strokeWidth[1] * scale;
            bounds.maxY += strokeWidth[2] * scale;
          }
        }
      } else {
        const strokePath = this.strokePath.getPath(fillPath.path);
        if (strokePath) {
          bounds.unionBounds(strokePath.bounds);
        }
      }
    }

    expandBoundingBoxWithEffects(this.properties.resolved.effects, bounds);

    return bounds;
  }

  getFillPath(): {
    path: Path;
    bounds: ReadOnlyBounds;
  } {
    if (this._fillPath && !this.fillPathDirty) {
      return { path: this._fillPath, bounds: this._fillPathBoundingBox };
    }

    const builder = new Skia.PathBuilder();

    const width = this.properties.width;
    const height = this.properties.height;

    switch (this.type) {
      case "rectangle": {
        addRoundRectangleToPath(
          builder,
          0,
          0,
          width,
          height,
          this.properties.resolved.cornerRadius,
        );
        break;
      }

      case "ellipse":
        builder.addOval(Skia.LTRBRect(0, 0, width, height));
        break;

      case "line":
        builder.moveTo(0, 0).lineTo(width, height);
        break;

      case "path":
        if (typeof this.properties.pathData === "string") {
          const svgPath = Skia.Path.MakeFromSVGString(this.properties.pathData);
          if (svgPath) {
            const pathBounds = svgPath.computeTightBounds();

            const left = pathBounds[0];
            const top = pathBounds[1];
            const right = pathBounds[2];
            const bottom = pathBounds[3];

            const width = right - left;
            const height = bottom - top;

            const matrix = new Matrix();

            const x = safeRatio0(this.properties.width, width);
            const y = safeRatio0(this.properties.height, height);
            matrix.scale(x, y);

            builder.addPath(svgPath, matrix.toArray());
            svgPath.delete();
          }
        }
        break;

      case "polygon": {
        generatePolygonPath(
          builder,
          this.properties.resolved.polygonCount ?? 0,
          this.properties.resolved.cornerRadius?.[0] ?? 0,
          width,
          height,
        );
        break;
      }
    }

    const path = builder.detachAndDelete();

    const bounds = path.computeTightBounds();

    this._fillPath?.delete();
    this._fillPath = path;
    this._fillPathBoundingBox.set(bounds[0], bounds[1], bounds[2], bounds[3]);
    this.fillPathDirty = false;

    return { path: this._fillPath, bounds: this._fillPathBoundingBox };
  }

  override renderSkia(
    renderer: SkiaRenderer,
    canvas: Canvas,
    renderBounds: ReadOnlyBounds,
  ) {
    if (!this.properties.resolved.enabled) {
      return;
    }

    if (!renderBounds.intersects(this.getVisualWorldBounds())) {
      return;
    }

    const saveCount = canvas.getSaveCount();

    canvas.save();
    canvas.concat(this.localMatrix.toArray());

    this.beginRenderEffects(canvas);

    const fillPath = this.getFillPath().path;

    const localBounds = this.localBounds();

    switch (this.properties.resolved.fillRule) {
      case "evenodd":
        fillPath.setFillType(Skia.FillType.EvenOdd);
        break;
      default:
        fillPath.setFillType(Skia.FillType.Winding);
        break;
    }

    renderer.renderFills(
      canvas,
      fillPath,
      this.properties.resolved.fills,
      localBounds.width,
      localBounds.height,
    );
    this.strokePath.render(canvas, fillPath, renderer, localBounds);

    canvas.restoreToCount(saveCount);
  }

  override getMaskPath(): Path | undefined {
    // NOTE(sedivy): Try to return the fill path as is. If there is a stroke
    // then we will combine both paths into a path builder.
    let path = isAnyFillVisible(this.properties.resolved.fills)
      ? this.getFillPath().path
      : undefined;

    if (this._maskPath) {
      this._maskPath.delete();
      this._maskPath = undefined;
    }

    if (
      isAnyFillVisible(this.properties.resolved.strokeFills) &&
      (this.properties.resolved.strokeAlignment === StrokeAlignment.Center ||
        this.properties.resolved.strokeAlignment === StrokeAlignment.Outside)
    ) {
      const strokePath = this.strokePath.getPath(
        path ?? this.getFillPath().path,
      );
      if (strokePath && path) {
        const combined =
          Skia.Path.MakeFromOp(path, strokePath.path, Skia.PathOp.Union) ??
          undefined;

        this._maskPath = combined;

        path = combined;
      }
    }

    return path;
  }

  destroy() {
    super.destroy();

    if (this._maskPath) {
      this._maskPath.delete();
      this._maskPath = undefined;
    }

    this.strokePath.destroy();

    if (this._fillPath) {
      this._fillPath.delete();
      this._fillPath = null;
    }

    this.fillPathDirty = true;
  }

  serialize({
    resolveVariables,
    includePathGeometry,
  }: {
    resolveVariables: boolean;
    includePathGeometry: boolean;
  }):
    | Schema.Rectangle
    | Schema.Ellipse
    | Schema.Line
    | Schema.Path
    | Schema.Polygon {
    const common = {
      ...serializeCommon(this, resolveVariables),
    };

    const properties = resolveVariables
      ? this.properties.resolved
      : this.properties;

    let result:
      | Schema.Rectangle
      | Schema.Ellipse
      | Schema.Line
      | Schema.Path
      | Schema.Polygon;

    switch (this.type) {
      case "rectangle":
        result = {
          type: "rectangle",
          cornerRadius: serializeCornerRadius(properties.cornerRadius),
          ...common,
        };
        break;
      case "ellipse":
        result = { type: "ellipse", ...common };
        break;
      case "line":
        result = { type: "line", ...common };
        break;
      case "polygon":
        result = {
          type: "polygon",
          polygonCount:
            properties.polygonCount && serializeValue(properties.polygonCount),
          cornerRadius:
            properties.cornerRadius &&
            serializeValue(properties.cornerRadius[0]),
          ...common,
        };
        break;
      case "path":
        result = { type: "path", ...common };
        if (typeof properties.pathData === "string") {
          result.geometry = includePathGeometry
            ? optimizeSvgPathData(properties.pathData)
            : "...";
        }
        if (properties.fillRule && properties.fillRule !== "nonzero") {
          result.fillRule = properties.fillRule;
        }

        break;
      default:
        throw new Error(`Unknown shape type: ${this.type}`);
    }

    result.fill = serializeFill(properties.fills);

    serializeSize(result, this, resolveVariables);

    result.stroke = serializeStroke(properties);
    result.effect = serializeEffects(properties.effects);

    return result;
  }

  override pointerHitTest(
    _shouldDirectSelect: boolean,
    _allowedNestedSearch: Set<SceneNode> | undefined,
    x: number,
    y: number,
  ): SceneNode | null {
    if (!this.properties.resolved.enabled) {
      return null;
    }

    if (!this.getVisualWorldBounds().containsPoint(x, y)) {
      return null;
    }

    const fillIsVisible = isAnyFillVisible(this.properties.resolved.fills);
    const strokeFillIsVisible = isAnyFillVisible(
      this.properties.resolved.strokeFills,
    );

    if (!fillIsVisible && !strokeFillIsVisible) {
      return null;
    }

    const local = this.toLocal(x, y);

    const fillPath = this.getFillPath().path;

    // 1. Stroke hit test.
    if (
      strokeFillIsVisible &&
      this.strokePath.getPath(fillPath)?.path.contains(local.x, local.y)
    ) {
      return this;
    }

    // 2. Fill hit test.
    if (fillIsVisible && fillPath.contains(local.x, local.y)) {
      return this;
    }

    return null;
  }

  override supportsImageFill(): boolean {
    return true;
  }
}

function generatePolygonPath(
  path: PathBuilder,
  count: number,
  cornerRadius: number,
  width: number,
  height: number,
) {
  if (count < 3) {
    return;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = width / 2;
  const radiusY = height / 2;

  const angleStep = (2 * Math.PI) / count;
  const startAngle = -Math.PI / 2;

  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = startAngle + i * angleStep;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    vertices.push({ x, y });
  }

  if (cornerRadius <= 0) {
    path.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      path.lineTo(vertices[i].x, vertices[i].y);
    }
    path.close();
    return;
  }

  const edgeLength = Math.sqrt(
    (vertices[1].x - vertices[0].x) ** 2 + (vertices[1].y - vertices[0].y) ** 2,
  );

  const maxCornerRadius = edgeLength / 2;
  const clampedRadius = Math.min(cornerRadius, maxCornerRadius);

  for (let i = 0; i < count; i++) {
    const prevIndex = (i - 1 + count) % count;
    const nextIndex = (i + 1) % count;

    const prev = vertices[prevIndex];
    const curr = vertices[i];
    const next = vertices[nextIndex];

    const toPrev = {
      x: prev.x - curr.x,
      y: prev.y - curr.y,
    };
    const toNext = {
      x: next.x - curr.x,
      y: next.y - curr.y,
    };

    const prevLen = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
    const nextLen = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);

    toPrev.x /= prevLen;
    toPrev.y /= prevLen;
    toNext.x /= nextLen;
    toNext.y /= nextLen;

    const dotProduct = toPrev.x * toNext.x + toPrev.y * toNext.y;
    const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
    const halfAngle = angle / 2;

    const tangentDistance = clampedRadius / Math.tan(halfAngle);

    const startPoint = {
      x: curr.x + toPrev.x * tangentDistance,
      y: curr.y + toPrev.y * tangentDistance,
    };
    const endPoint = {
      x: curr.x + toNext.x * tangentDistance,
      y: curr.y + toNext.y * tangentDistance,
    };

    if (i === 0) {
      path.moveTo(startPoint.x, startPoint.y);
    } else {
      path.lineTo(startPoint.x, startPoint.y);
    }

    const bisector = {
      x: (toPrev.x + toNext.x) / 2,
      y: (toPrev.y + toNext.y) / 2,
    };
    const bisectorLen = Math.sqrt(
      bisector.x * bisector.x + bisector.y * bisector.y,
    );
    bisector.x /= bisectorLen;
    bisector.y /= bisectorLen;

    const distanceToCenter = clampedRadius / Math.sin(halfAngle);
    const cornerCenter = {
      x: curr.x + bisector.x * distanceToCenter,
      y: curr.y + bisector.y * distanceToCenter,
    };

    const startAngleRad = Math.atan2(
      startPoint.y - cornerCenter.y,
      startPoint.x - cornerCenter.x,
    );
    const endAngleRad = Math.atan2(
      endPoint.y - cornerCenter.y,
      endPoint.x - cornerCenter.x,
    );

    const startAngleDeg = radToDeg(startAngleRad);
    const endAngleDeg = radToDeg(endAngleRad);

    let sweepAngle = endAngleDeg - startAngleDeg;
    if (sweepAngle > 180) sweepAngle -= 360;
    if (sweepAngle < -180) sweepAngle += 360;

    path.arcToOval(
      Skia.LTRBRect(
        cornerCenter.x - clampedRadius,
        cornerCenter.y - clampedRadius,
        cornerCenter.x + clampedRadius,
        cornerCenter.y + clampedRadius,
      ),
      startAngleDeg,
      sweepAngle,
      false,
    );
  }

  path.close();
}
