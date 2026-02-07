import type { Canvas, Path, PathBuilder } from "@highagency/pencil-skia";
import { type NodeProperties, StrokeAlignment } from "./canvas/scene-graph";
import type { SceneNode } from "./canvas/scene-node";
import {
  convertLineCapToSkia,
  convertLineJoinToSkia,
  normalizeCornerRadius,
  Skia,
} from "./skia";
import type { SkiaRenderer } from "./skia-renderer";
import { Bounds, type ReadOnlyBounds } from "./utils/bounds";

export class StrokePath {
  private node: SceneNode;

  private dirty: boolean = true;
  private path: Path | null = null;
  private bounds: Bounds = new Bounds();

  constructor(node: SceneNode) {
    this.node = node;
  }

  onPropertyChanged(property: keyof NodeProperties) {
    if (!this.dirty) {
      if (
        property === "width" ||
        property === "height" ||
        property === "cornerRadius" ||
        property === "strokeFills" ||
        property === "strokeWidth" ||
        property === "strokeAlignment" ||
        property === "lineJoin" ||
        property === "lineCap"
      ) {
        this.dirty = true;
      }
    }
  }

  getPath(fillPath: Path): { path: Path; bounds: ReadOnlyBounds } | null {
    const node = this.node;

    if (
      node.properties.resolved.strokeFills == null ||
      node.properties.resolved.strokeFills.length === 0 ||
      node.properties.resolved.strokeWidth == null
    ) {
      this.destroy();
      return null;
    }

    if (
      node.properties.resolved.strokeWidth[0] === 0 &&
      node.properties.resolved.strokeWidth[1] === 0 &&
      node.properties.resolved.strokeWidth[2] === 0 &&
      node.properties.resolved.strokeWidth[3] === 0
    ) {
      this.destroy();
      return null;
    }

    if (this.path == null || this.dirty) {
      let path = generateStrokePathForNode(node, fillPath);
      if (!path) {
        path = new Skia.Path();
      }

      const bounds = path.computeTightBounds();
      this.bounds.set(bounds[0], bounds[1], bounds[2], bounds[3]);
      this.dirty = false;
      this.path?.delete();
      this.path = path;
    }

    return { path: this.path, bounds: this.bounds };
  }

  render(
    canvas: Canvas,
    fillPath: Path,
    renderer: SkiaRenderer,
    bounds: ReadOnlyBounds,
  ) {
    const node = this.node;
    if (!node.properties.resolved.strokeFills) {
      return;
    }

    const strokePath = this.getPath(fillPath);
    if (!strokePath) {
      return;
    }

    renderer.renderFills(
      canvas,
      strokePath.path,
      node.properties.resolved.strokeFills,
      bounds.width,
      bounds.height,
    );
  }

  destroy() {
    if (this.path) {
      this.path.delete();
      this.path = null;
      this.dirty = true;
    }
  }
}

function combineStrokePathWithFillPath(
  strokePath: Path,
  fillPath: Path,
  alignment: StrokeAlignment,
): Path | undefined {
  switch (alignment) {
    case StrokeAlignment.Center: {
      return strokePath;
    }
    case StrokeAlignment.Inside: {
      const combined = Skia.Path.MakeFromOp(
        fillPath,
        strokePath,
        Skia.PathOp.Intersect,
      );

      strokePath.delete();

      return combined ?? undefined;
    }
    case StrokeAlignment.Outside: {
      const combined = Skia.Path.MakeFromOp(
        strokePath,
        fillPath,
        Skia.PathOp.Difference,
      );

      strokePath.delete();

      return combined ?? undefined;
    }
  }
}

function generateStrokePathForNode(
  node: SceneNode,
  fillPath: Path,
): Path | undefined {
  let strokeTop = node.properties.resolved.strokeWidth?.[0] ?? 0;
  let strokeRight = node.properties.resolved.strokeWidth?.[1] ?? 0;
  let strokeBottom = node.properties.resolved.strokeWidth?.[2] ?? 0;
  let strokeLeft = node.properties.resolved.strokeWidth?.[3] ?? 0;

  const isStrokeUniform =
    strokeTop === strokeRight &&
    strokeTop === strokeBottom &&
    strokeTop === strokeLeft;

  const alignment =
    node.properties.resolved.strokeAlignment ?? StrokeAlignment.Inside;

  // NOTE(sedivy): If we have a uniform stroke or a non-rectangle, we can use Skia's built-in
  // stroke expansion.
  if (isStrokeUniform || (node.type !== "rectangle" && node.type !== "frame")) {
    let width = strokeTop;

    if (
      alignment === StrokeAlignment.Inside ||
      alignment === StrokeAlignment.Outside
    ) {
      width *= 2;
    }

    const strokePath = fillPath.makeStroked({
      width: width,
      miter_limit: undefined,
      join: convertLineJoinToSkia(node.properties.resolved.lineJoin),
      cap: convertLineCapToSkia(node.properties.resolved.lineCap),
    });
    if (strokePath) {
      return combineStrokePathWithFillPath(strokePath, fillPath, alignment);
    }
    return;
  }

  if (
    alignment === StrokeAlignment.Inside ||
    alignment === StrokeAlignment.Outside
  ) {
    strokeTop *= 2;
    strokeRight *= 2;
    strokeBottom *= 2;
    strokeLeft *= 2;
  }

  // NOTE(sedivy): If we don't have a uniform stroke, we have to build the path ourselves.

  const bounds = node.localBounds();

  const outerBounds = bounds.clone();
  outerBounds.minY -= strokeTop / 2;
  outerBounds.maxX += strokeRight / 2;
  outerBounds.maxY += strokeBottom / 2;
  outerBounds.minX -= strokeLeft / 2;

  const innerBounds = bounds.clone();
  innerBounds.minY += Math.min(bounds.height, strokeTop / 2);
  innerBounds.maxX -= Math.min(bounds.width, strokeRight / 2);
  innerBounds.maxY -= Math.min(bounds.height, strokeBottom / 2);
  innerBounds.minX += Math.min(bounds.width, strokeLeft / 2);

  const topLeftStroke = Math.min(strokeLeft, strokeTop);
  const topRightStroke = Math.min(strokeRight, strokeTop);
  const bottomRightStroke = Math.min(strokeRight, strokeBottom);
  const bottomLeftStroke = Math.min(strokeLeft, strokeBottom);

  const radii = node.properties.resolved.cornerRadius
    ? normalizeCornerRadius(
        bounds.width,
        bounds.height,
        node.properties.resolved.cornerRadius,
      )
    : [0, 0, 0, 0];

  let topLeftInnerRadius = radii[0];
  let topRightInnerRadius = radii[1];
  let bottomRightInnerRadius = radii[2];
  let bottomLeftInnerRadius = radii[3];

  if (
    alignment === StrokeAlignment.Inside ||
    alignment === StrokeAlignment.Center
  ) {
    if (topLeftInnerRadius < topLeftStroke / 2) {
      topLeftInnerRadius = 0;
    }
    if (topRightInnerRadius < topRightStroke / 2) {
      topRightInnerRadius = 0;
    }
    if (bottomRightInnerRadius < bottomRightStroke / 2) {
      bottomRightInnerRadius = 0;
    }
    if (bottomLeftInnerRadius < bottomLeftStroke / 2) {
      bottomLeftInnerRadius = 0;
    }
  }

  const bottomLeftOuterRadius = bottomLeftInnerRadius + bottomLeftStroke / 2;
  const bottomRightOuterRadius = bottomRightInnerRadius + bottomRightStroke / 2;
  const topLeftOuterRadius = topLeftInnerRadius + topLeftStroke / 2;
  const topRightOuterRadius = topRightInnerRadius + topRightStroke / 2;

  const bottomLeftInnerCurveStart = Math.max(
    innerBounds.left,
    bounds.left + bottomLeftInnerRadius,
  );
  const topLeftInnerCurveStart = Math.max(
    innerBounds.left,
    bounds.left + topLeftInnerRadius,
  );
  const topRightInnerCurveStart = Math.min(
    innerBounds.right,
    bounds.right - topRightInnerRadius,
  );
  const bottomRightInnerCurveStart = Math.min(
    innerBounds.right,
    bounds.right - bottomRightInnerRadius,
  );

  const builder = new Skia.PathBuilder();

  // left side
  if (strokeLeft > 0) {
    builder.moveTo(
      outerBounds.left + bottomLeftOuterRadius,
      outerBounds.bottom,
    );

    appendCornerToStrokePath(
      builder,
      [outerBounds.left + bottomLeftOuterRadius, outerBounds.bottom],
      [outerBounds.left, outerBounds.bottom],
      [outerBounds.left, outerBounds.bottom - bottomLeftOuterRadius],
      bottomLeftOuterRadius,
    );

    appendCornerToStrokePath(
      builder,
      [outerBounds.left, outerBounds.top + topLeftOuterRadius],
      [outerBounds.left, outerBounds.top],
      [outerBounds.left + topLeftOuterRadius, outerBounds.top],
      topLeftOuterRadius,
    );

    appendCornerToStrokePath(
      builder,
      [topLeftInnerCurveStart, innerBounds.top],
      [innerBounds.left, innerBounds.top],
      [innerBounds.left, bounds.top + topLeftInnerRadius],
      topLeftInnerRadius,
    );

    appendCornerToStrokePath(
      builder,
      [innerBounds.left, bounds.bottom - bottomLeftInnerRadius],
      [innerBounds.left, innerBounds.bottom],
      [bottomLeftInnerCurveStart, innerBounds.bottom],
      bottomLeftInnerRadius,
    );
  }

  // bottom side
  if (strokeBottom > 0) {
    builder.moveTo(
      outerBounds.right,
      outerBounds.bottom - bottomRightOuterRadius,
    );

    appendCornerToStrokePath(
      builder,
      [outerBounds.right, outerBounds.bottom - bottomRightOuterRadius],
      [outerBounds.right, outerBounds.bottom],
      [outerBounds.right - bottomRightOuterRadius, outerBounds.bottom],
      bottomRightOuterRadius,
    );

    appendCornerToStrokePath(
      builder,
      [outerBounds.left + bottomLeftOuterRadius, outerBounds.bottom],
      [outerBounds.left, outerBounds.bottom],
      [outerBounds.left, outerBounds.bottom - bottomLeftOuterRadius],
      bottomLeftOuterRadius,
    );

    appendCornerToStrokePath(
      builder,
      [innerBounds.left, bounds.bottom - bottomLeftInnerRadius],
      [innerBounds.left, innerBounds.bottom],
      [bottomLeftInnerCurveStart, innerBounds.bottom],
      bottomLeftInnerRadius,
    );

    appendCornerToStrokePath(
      builder,
      [bottomRightInnerCurveStart, innerBounds.bottom],
      [innerBounds.right, innerBounds.bottom],
      [innerBounds.right, bounds.bottom - bottomRightInnerRadius],
      bottomRightInnerRadius,
    );
  }

  // right side
  if (strokeRight > 0) {
    builder.moveTo(outerBounds.right - topRightOuterRadius, outerBounds.top);

    appendCornerToStrokePath(
      builder,
      [outerBounds.right - topRightOuterRadius, outerBounds.top],
      [outerBounds.right, outerBounds.top],
      [outerBounds.right, outerBounds.top + topRightOuterRadius],
      topRightOuterRadius,
    );

    appendCornerToStrokePath(
      builder,
      [outerBounds.right, outerBounds.bottom - bottomRightOuterRadius],
      [outerBounds.right, outerBounds.bottom],
      [outerBounds.right - bottomRightOuterRadius, outerBounds.bottom],
      bottomRightOuterRadius,
    );

    appendCornerToStrokePath(
      builder,
      [bottomRightInnerCurveStart, innerBounds.bottom],
      [innerBounds.right, innerBounds.bottom],
      [innerBounds.right, bounds.bottom - bottomRightInnerRadius],
      bottomRightInnerRadius,
    );

    appendCornerToStrokePath(
      builder,
      [innerBounds.right, bounds.top + topRightInnerRadius],
      [innerBounds.right, innerBounds.top],
      [topRightInnerCurveStart, innerBounds.top],
      topRightInnerRadius,
    );
  }

  // top side
  if (strokeTop > 0) {
    builder.moveTo(outerBounds.left, outerBounds.top + topLeftOuterRadius);

    appendCornerToStrokePath(
      builder,
      [outerBounds.left, outerBounds.top + topLeftOuterRadius],
      [outerBounds.left, outerBounds.top],
      [outerBounds.left + topLeftOuterRadius, outerBounds.top],
      topLeftOuterRadius,
    );

    appendCornerToStrokePath(
      builder,
      [outerBounds.right - topRightOuterRadius, outerBounds.top],
      [outerBounds.right, outerBounds.top],
      [outerBounds.right, outerBounds.top + topRightOuterRadius],
      topRightOuterRadius,
    );

    appendCornerToStrokePath(
      builder,
      [innerBounds.right, bounds.top + topRightInnerRadius],
      [innerBounds.right, innerBounds.top],
      [topRightInnerCurveStart, innerBounds.top],
      topRightInnerRadius,
    );

    appendCornerToStrokePath(
      builder,
      [topLeftInnerCurveStart, innerBounds.top],
      [innerBounds.left, innerBounds.top],
      [innerBounds.left, bounds.top + topLeftInnerRadius],
      topLeftInnerRadius,
    );
  }

  builder.close();

  const path = builder.detachAndDelete();

  return combineStrokePathWithFillPath(path, fillPath, alignment);
}

function appendCornerToStrokePath(
  builder: PathBuilder,
  start: [number, number],
  corner: [number, number],
  end: [number, number],
  radius: number,
) {
  if (radius === 0) {
    builder.lineTo(corner[0], corner[1]);
  } else {
    builder.lineTo(start[0], start[1]);
    builder.conicTo(corner[0], corner[1], end[0], end[1], Math.SQRT1_2);
  }
}
