import type * as Schema from "@ha/schema";
import type { Canvas, Path, PathBuilder } from "@highagency/pencil-skia";
import { Skia } from "../../skia";
import type { SkiaRenderer } from "../../skia-renderer";
import { Bounds, type ReadOnlyBounds } from "../../utils/bounds";
import { almostEquals, safeRatio0 } from "../../utils/math";
import { expandBoundingBoxWithEffects } from "../effect";
import { Axis, SizingBehavior } from "../layout";
import type { NodeProperties } from "../scene-graph";
import { SceneNode } from "../scene-node";
import {
  serializeCommon,
  serializeEffects,
  serializeLayout,
} from "../serializer";

export class GroupNode extends SceneNode {
  private _maskPath: Path | null = null;

  constructor(id: string, properties: NodeProperties) {
    super(id, "group", properties);
  }

  override localBounds(): ReadOnlyBounds {
    // TODO(sedivy): Only update the bounds when there was a change

    const bounds = this._localBounds;

    if (this.children.length) {
      bounds.reset();
      for (const child of this.children) {
        if (child.destroyed || !child.properties.resolved.enabled) {
          continue;
        }

        bounds.unionBounds(child.getTransformedLocalBounds());
      }
    } else {
      this._localBounds.set(0, 0, 0, 0);
    }

    return bounds;
  }

  override getVisualLocalBounds(): ReadOnlyBounds {
    const bounds = this._localBounds;
    bounds.reset();

    const transformedChild = new Bounds();

    for (const child of this.children) {
      if (child.destroyed || !child.properties.resolved.enabled) {
        continue;
      }

      transformedChild.copyFrom(child.getVisualLocalBounds());
      transformedChild.transform(child.getLocalMatrix());

      bounds.unionBounds(transformedChild);
    }

    expandBoundingBoxWithEffects(this.properties.resolved.effects, bounds);

    return bounds;
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

    const saveCount = canvas.save();

    canvas.save();
    canvas.concat(this.localMatrix.toArray());

    this.beginRenderEffects(canvas);

    for (const child of this.children) {
      if (child.destroyed || !child.properties.resolved.enabled) {
        continue;
      }

      child.renderSkia(renderer, canvas, renderBounds);
    }

    canvas.restoreToCount(saveCount);
  }

  override getMaskPath(): Path | undefined {
    const builder = new Skia.PathBuilder();

    for (const child of this.children) {
      if (child.destroyed || !child.properties.resolved.enabled) {
        continue;
      }

      const childPath = child.getMaskPath();
      if (childPath) {
        const matrix = child.getLocalMatrix();
        builder.addPath(
          childPath,
          matrix.a,
          matrix.c,
          matrix.tx,
          matrix.b,
          matrix.d,
          matrix.ty,
        );
      }
    }

    const path = builder.detachAndDelete();

    this._maskPath?.delete();
    this._maskPath = path;

    return this._maskPath;
  }

  override pointerHitTest(
    shouldDirectSelect: boolean,
    allowedNestedSearch: Set<SceneNode> | undefined,
    x: number,
    y: number,
  ): SceneNode | null {
    if (!this.properties.resolved.enabled) {
      return null;
    }

    if (!this.getVisualWorldBounds().containsPoint(x, y)) {
      return null;
    }

    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      if (child.destroyed || !child.properties.resolved.enabled) {
        continue;
      }

      const hit = child.pointerHitTest(
        shouldDirectSelect,
        allowedNestedSearch,
        x,
        y,
      );
      if (hit) {
        if (shouldDirectSelect) {
          return hit;
        }

        if (allowedNestedSearch?.has(this)) {
          return hit;
        }

        return this;
      }
    }

    return null;
  }

  destroy() {
    super.destroy();

    if (this._maskPath) {
      this._maskPath.delete();
      this._maskPath = null;
    }
  }

  serialize({
    resolveVariables,
  }: {
    resolveVariables: boolean;
    includePathGeometry: boolean;
  }): Schema.Group {
    const result: Schema.Group = {
      type: "group",
      ...serializeCommon(this, resolveVariables),
    };

    const properties = resolveVariables
      ? this.properties.resolved
      : this.properties;

    result.effect = serializeEffects(properties.effects);
    serializeLayout(result, properties, "group");

    if (this.isInLayout()) {
      // NOTE(sedivy): Groups don't have fixed pixel sizes in the schema so the
      // only possible values are "fill_container" or "fit_content". But groups by
      // default always match their size with their children's size, so we only
      // need to handle the "fill_container" case here.
      if (properties.horizontalSizing === SizingBehavior.FillContainer) {
        result.width = "fill_container";
      }

      if (properties.verticalSizing === SizingBehavior.FillContainer) {
        result.height = "fill_container";
      }
    }

    return result;
  }

  // NOTE(sedivy): Groups don't store their own size. Instead, they derive their
  // size from their children's sizes. When committing a new size, we need to
  // resize and reposition all children proportionally to fill the new size.
  override layoutCommitSize(axis: Axis, newSize: number): void {
    const currentSize = this.layoutGetOuterSize()[axis];

    // NOTE(sedivy): Nothing to resize if the new size is the same as the current size.
    if (almostEquals(currentSize, newSize)) {
      return;
    }

    const scale = safeRatio0(newSize, currentSize);

    const scaleX = axis === Axis.Horizontal ? scale : 1;
    const scaleY = axis === Axis.Vertical ? scale : 1;

    for (const child of this.children) {
      const bounds = child.getTransformedLocalBounds();

      const x = bounds.left * scaleX;
      const y = bounds.top * scaleY;

      const newChildSize =
        axis === Axis.Horizontal
          ? bounds.width * scaleX
          : bounds.height * scaleY;

      child.layoutCommitSize(axis, newChildSize === 0 ? 1e-6 : newChildSize);
      child.layoutCommitPosition(x, y);
    }
  }
}
