import type * as Schema from "@ha/schema";
import type { Canvas, Path, PathBuilder } from "@highagency/pencil-skia";
import type { SceneManager } from "../../managers/scene-manager";
import { addRoundRectangleToPath, Skia } from "../../skia";
import type { GeneratingEffect, SkiaRenderer } from "../../skia-renderer";
import { StrokePath } from "../../stroke-path";
import { Bounds, type ReadOnlyBounds } from "../../utils/bounds";
import { type Action, FunctionAction } from "../actions";
import { expandBoundingBoxWithEffects } from "../effect";
import { isAnyFillVisible } from "../fill";
import { SizingBehavior } from "../layout";
import { type NodeProperties, StrokeAlignment } from "../scene-graph";
import { SceneNode } from "../scene-node";
import {
  serializeCommon,
  serializeCornerRadius,
  serializeEffects,
  serializeFill,
  serializeLayout,
  serializeSize,
  serializeStroke,
  serializeValue,
} from "../serializer";

export class FrameNode extends SceneNode {
  private _slot?: string[];
  get slot(): typeof this._slot {
    return this._slot;
  }

  setSlot(undo: Action[] | null, slot: typeof this._slot) {
    const oldValue = this._slot;
    undo?.push(new FunctionAction((_, undo) => this.setSlot(undo, oldValue)));
    this._slot = structuredClone(slot);

    this.manager?.scenegraph.notifyPropertyChange(this);
  }

  get isSlotInstance(): boolean {
    for (let node = this.prototype?.node; node; node = node.prototype?.node) {
      if ((node as FrameNode).slot) {
        return true;
      }
    }
    return false;
  }

  get canBeSlot(): boolean {
    if (!this.prototype) {
      for (let node: SceneNode | null = this; node; node = node.parent) {
        if (node.reusable) {
          return true;
        }
      }
    }
    return false;
  }

  private _fillPath: Path | null = null;
  private fillPathDirty: boolean = true;

  private _slotPath: Path | null = null;
  private slotPathDirty: boolean = true;

  private strokePath: StrokePath = new StrokePath(this);

  private _maskPath: Path | null = null;

  private generatingEffect: GeneratingEffect | null = null;

  constructor(id: string, properties: NodeProperties) {
    super(id, "frame", properties);
  }

  onInsertToScene(manager: SceneManager): void {
    super.onInsertToScene(manager);

    manager.guidesGraph.frameNamesManager?.frameAdded(this);
    this.updateGeneratingEffect();
  }

  override onPropertyChanged(property: keyof NodeProperties) {
    super.onPropertyChanged(property);

    if (
      property === "cornerRadius" ||
      property === "width" ||
      property === "height"
    ) {
      this.fillPathDirty = true;
      this.slotPathDirty = true;
    }

    this.strokePath.onPropertyChanged(property);

    if (property === "name" || property === "placeholder") {
      this.manager?.guidesGraph.frameNamesManager?.frameNameChange(this);
    }

    if (property === "placeholder") {
      this.updateGeneratingEffect();
    }
  }

  override getVisualLocalBounds(): ReadOnlyBounds {
    const bounds = this._visualLocalBounds;
    bounds.copyFrom(this.localBounds());

    if (isAnyFillVisible(this.properties.resolved.strokeFills)) {
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
    }

    if (!this.properties.resolved.clip) {
      const transformedChild = new Bounds();

      for (const child of this.children) {
        if (child.destroyed || !child.properties.resolved.enabled) {
          continue;
        }

        transformedChild.copyFrom(child.getVisualLocalBounds());
        transformedChild.transform(child.getLocalMatrix());

        bounds.unionBounds(transformedChild);
      }
    }

    expandBoundingBoxWithEffects(this.properties.resolved.effects, bounds);

    return bounds;
  }

  private getFillPath(): Path {
    if (this._fillPath && !this.fillPathDirty) {
      return this._fillPath;
    }

    const builder = new Skia.PathBuilder();

    addRoundRectangleToPath(
      builder,
      0,
      0,
      this.properties.resolved.width,
      this.properties.resolved.height,
      this.properties.resolved.cornerRadius,
    );

    this._fillPath?.delete();
    this._fillPath = builder.detachAndDelete();
    this.fillPathDirty = false;

    return this._fillPath;
  }

  private getSlotPath(): Path {
    if (this._slotPath && !this.slotPathDirty) {
      return this._slotPath;
    }

    const builder = new Skia.PathBuilder();

    const slotPadding = 10;
    const width = Math.max(0, this.properties.resolved.width - 2 * slotPadding);
    const height = Math.max(
      0,
      this.properties.resolved.height - 2 * slotPadding,
    );
    if (width > 0 && height > 0) {
      addRoundRectangleToPath(
        builder,
        slotPadding,
        slotPadding,
        width,
        height,
        this.properties.resolved.cornerRadius?.map((radius) =>
          Math.max(0, radius - slotPadding),
        ) as [number, number, number, number] | undefined,
      );
    }

    this._slotPath?.delete();
    this._slotPath = builder.detachAndDelete();
    this.slotPathDirty = false;

    return this._slotPath;
  }

  private updateGeneratingEffect() {
    if (!this.manager) {
      return;
    }

    if (this.properties.resolved.placeholder) {
      this.generatingEffect =
        this.manager?.skiaRenderer.addGeneratingEffect(this);
    } else if (this.generatingEffect) {
      this.manager?.skiaRenderer.removeGeneratingEffect(this.generatingEffect);
    }
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

    const localBounds = this.localBounds();

    canvas.save();
    canvas.concat(this.localMatrix.toArray());

    this.beginRenderEffects(canvas);

    const path = this.getFillPath();

    renderer.renderFills(
      canvas,
      path,
      this.properties.resolved.fills,
      localBounds.width,
      localBounds.height,
    );

    canvas.save();

    // NOTE(sedivy): The mask also controls the order of stroke rendering.
    //   no mask = stroke is rendered below the frame content
    //      mask = stroke is rendered on top of the frame content
    if (this.properties.resolved.clip) {
      canvas.clipPath(path, Skia.ClipOp.Intersect, true);
    } else {
      this.strokePath.render(canvas, path, renderer, localBounds);
    }

    const childrenOnTop = [];

    for (const child of this.children) {
      if (child.destroyed || !child.properties.resolved.enabled) {
        continue;
      }

      if (child.renderOnTop) {
        childrenOnTop.push(child);
        continue;
      }

      child.renderSkia(renderer, canvas, renderBounds);
    }

    for (const child of childrenOnTop) {
      child.renderSkia(renderer, canvas, renderBounds);
    }

    canvas.restore();

    // NOTE(sedivy): Render the stroke on top when there is a mask.
    if (this.properties.resolved.clip) {
      this.strokePath.render(canvas, path, renderer, localBounds);
    }

    const isSlot = this.slot !== undefined;
    if ((isSlot || this.isSlotInstance) && this.children.length === 0) {
      renderer.renderSlot(canvas, this.getSlotPath(), !isSlot);
    }

    canvas.restoreToCount(saveCount);
  }

  serialize({
    resolveVariables,
  }: {
    resolveVariables: boolean;
    includePathGeometry: boolean;
  }): Schema.Frame {
    const result: Schema.Frame = {
      type: "frame",
      ...serializeCommon(this, resolveVariables),
    };

    if (this.slot) {
      result.slot = structuredClone(this.slot);
    }

    const properties = resolveVariables
      ? this.properties.resolved
      : this.properties;

    if (properties.clip !== false) {
      result.clip = serializeValue(properties.clip);
    }

    serializeSize(result, this, resolveVariables, SizingBehavior.FitContent);

    result.fill = serializeFill(properties.fills);

    if (properties.placeholder === true) {
      result.placeholder = true;
    }

    result.cornerRadius = serializeCornerRadius(properties.cornerRadius);
    result.stroke = serializeStroke(properties);
    result.effect = serializeEffects(properties.effects);
    serializeLayout(result, properties, "frame");

    return result;
  }

  override pointerHitTest(
    shouldDirectSelect: boolean,
    allowedNestedSearch: Set<SceneNode> | undefined,
    worldX: number,
    worldY: number,
  ): SceneNode | null {
    if (!this.properties.resolved.enabled) {
      return null;
    }

    if (!this.getVisualWorldBounds().containsPoint(worldX, worldY)) {
      return null;
    }

    const local = this.toLocal(worldX, worldY);

    const fillPath = this.getFillPath();
    const strokePath = this.strokePath.getPath(fillPath);

    const strokeIsRenderedOnTop = this.properties.resolved.clip;

    const strokeHit =
      strokePath &&
      isAnyFillVisible(this.properties.resolved.strokeFills) &&
      strokePath.path.contains(local.x, local.y);

    const boundingBoxHit = this.containsPointInBoundingBox(worldX, worldY);

    // NOTE(sedivy): Empty top-level frame hit test.
    if (
      !this.hasParent() &&
      this.children.length === 0 &&
      (boundingBoxHit || strokeHit)
    ) {
      return this;
    }

    // NOTE(sedivy): Direct select always drills down to the nested children and
    // uses precise path hit testing.
    if (shouldDirectSelect) {
      // 1. Top stroke hit test.
      if (strokeIsRenderedOnTop && strokeHit) {
        return this;
      }

      // 2. Children hit test.
      const hit = this._pointerHitTestChildren(
        shouldDirectSelect,
        allowedNestedSearch,
        worldX,
        worldY,
        local.x,
        local.y,
      );
      if (hit) {
        return hit;
      }

      // 3. Precise frame fill and stroke path hit test.
      if (
        strokeHit ||
        (isAnyFillVisible(this.properties.resolved.fills) &&
          fillPath.contains(local.x, local.y))
      ) {
        return this;
      }
    } else {
      const canFrameBeSelected =
        this.hasParent() || this.children.length === 0 || this.hasLayout();

      // 1. Top stroke hit test.
      if (strokeIsRenderedOnTop && strokeHit) {
        return canFrameBeSelected ? this : null;
      }

      // 2. Simple bounding box hit test for nested or empty frames.
      if (
        boundingBoxHit &&
        (this.hasParent() || this.children.length === 0) &&
        !allowedNestedSearch?.has(this)
      ) {
        return this;
      }

      // 3. Children hit test.
      const hit = this._pointerHitTestChildren(
        shouldDirectSelect,
        allowedNestedSearch,
        worldX,
        worldY,
        local.x,
        local.y,
      );
      if (hit) {
        return hit;
      }

      // 4. Simple background hit test.
      if (canFrameBeSelected && (boundingBoxHit || strokeHit)) {
        return this;
      }
    }

    return null;
  }

  private _pointerHitTestChildren(
    shouldDirectSelect: boolean,
    allowedNestedSearch: Set<SceneNode> | undefined,
    worldX: number,
    worldY: number,
    localX: number,
    localY: number,
  ): SceneNode | null {
    if (this.children.length === 0) {
      return null;
    }

    // NOTE(sedivy): Don't allow hits for points outside the clip area.
    if (
      !this.properties.resolved.clip ||
      this.getFillPath().contains(localX, localY)
    ) {
      for (let i = this.children.length - 1; i >= 0; i--) {
        const child = this.children[i];
        if (child.destroyed || !child.properties.resolved.enabled) {
          continue;
        }

        const hit = this.children[i].pointerHitTest(
          shouldDirectSelect,
          allowedNestedSearch,
          worldX,
          worldY,
        );
        if (hit) {
          // NOTE(sedivy): Only use the found child if it's not larger than the parent frame.
          return !shouldDirectSelect && hit.includesNode(this) ? this : hit;
        }
      }
    }

    return null;
  }

  override getMaskPath(): Path | undefined {
    // NOTE(sedivy): Try to return the fill path as is. If there is a stroke
    // then we will combine both paths using a path builder.
    const fillPath = this.getFillPath();

    if (this._maskPath) {
      this._maskPath.delete();
      this._maskPath = null;
    }

    if (
      this.properties.strokeAlignment === StrokeAlignment.Center ||
      this.properties.strokeAlignment === StrokeAlignment.Outside
    ) {
      const strokePath = this.strokePath.getPath(fillPath);
      if (strokePath) {
        const builder = new Skia.PathBuilder();
        builder.addPath(fillPath);
        builder.addPath(strokePath.path);

        this._maskPath = builder.detachAndDelete();

        return this._maskPath;
      }
    }

    return fillPath;
  }

  override supportsImageFill(): boolean {
    return true;
  }

  onParentChange(oldParent: SceneNode | null, newParent: SceneNode | null) {
    super.onParentChange(oldParent, newParent);

    if (newParent) {
      this.manager?.guidesGraph.frameNamesManager?.frameParendChange(this);
    }
  }

  destroy() {
    super.destroy();

    if (this._slotPath) {
      this._slotPath.delete();
      this._slotPath = null;
    }

    if (this._maskPath) {
      this._maskPath.delete();
      this._maskPath = null;
    }

    this.strokePath.destroy();

    if (this._fillPath) {
      this._fillPath.delete();
      this._fillPath = null;
    }

    this.fillPathDirty = true;
    this.slotPathDirty = true;

    this.manager?.guidesGraph.frameNamesManager?.frameRemoved(this);

    if (this.generatingEffect) {
      this.manager?.skiaRenderer.removeGeneratingEffect(this.generatingEffect);
    }
  }
}
