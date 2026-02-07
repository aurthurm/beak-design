import type * as Schema from "@ha/schema";
import { logger } from "@ha/shared";
import type { Canvas, Path } from "@highagency/pencil-skia";
import { Matrix, Point } from "pixi.js";
import type { SceneManager } from "../managers/scene-manager";
import {
  convertBlendModeToSkia,
  convertBlurRadiusToSigma,
  hexToColor,
  Skia,
} from "../skia";
import type { SkiaRenderer } from "../skia-renderer";
import { Bounds, type ReadOnlyBounds } from "../utils/bounds";
import { type Action, FunctionAction } from "./actions";
import type { BaseProps, Component } from "./components/component";
import { EffectType, expandBoundingBoxWithEffects } from "./effect";
import { FillType } from "./fill";
import {
  Axis,
  findInsertionIndexInLayout,
  Layout,
  type LayoutInterface,
  LayoutMode,
  SizingBehavior,
} from "./layout";
import type { FrameNode } from "./nodes";
import type { ObjectUpdateBlock } from "./object-update-block";
import {
  type NodeProperties,
  NodePropertiesStorage,
  type NodeType,
  SceneGraph,
} from "./scene-graph";

type Prototype<T> = {
  node: T;
  overriddenProperties?: ReadonlySet<keyof NodeProperties>;
  childrenOverridden: boolean;
};

type PrototypeStorage<T> = {
  node: T;
  overriddenProperties?: Set<keyof NodeProperties>;
  childrenOverridden: boolean;
};

let lastLocalID = 0;

export class SceneNode implements LayoutInterface {
  localID: number = ++lastLocalID;

  id: string;
  type: NodeType;
  private _reusable: boolean = false;

  readonly properties: NodePropertiesStorage;
  layout: Layout;

  private _prototype?: PrototypeStorage<this>;
  get prototype(): Readonly<Prototype<this>> | undefined {
    return this._prototype;
  }
  private _instances = new Set<SceneNode>();
  get instances(): ReadonlySet<SceneNode> {
    return this._instances;
  }
  private isHandlingPrototypeChange: boolean = false;

  parent: SceneNode | null = null;
  children: SceneNode[] = [];

  root: boolean = false;
  destroyed: boolean = false;

  renderOnTop: boolean = false;

  _visualOffset: [number, number] = [0, 0];

  get visualOffset(): Readonly<[number, number]> {
    return this._visualOffset;
  }

  protected manager?: SceneManager;

  protected localMatrix: Matrix = new Matrix();
  protected worldMatrix: Matrix = new Matrix();

  protected _localBounds: Bounds = new Bounds();
  protected _worldBounds: Bounds = new Bounds();
  protected _transformedLocalBounds: Bounds = new Bounds();

  protected _visualLocalBounds: Bounds = new Bounds();
  protected _visualWorldBounds: Bounds = new Bounds();

  constructor(id: string, type: NodeType, properties: NodeProperties) {
    this.id = id;
    this.type = type;
    this.properties = new NodePropertiesStorage(
      properties,
      (property) => {
        if (
          this._prototype &&
          !this.isHandlingPrototypeChange &&
          (!this.manager || !this.manager.scenegraph.isUpdatingLayout) // NOTE(zaza): because layout can change x,y,width,height.
        ) {
          if (this._prototype.overriddenProperties) {
            this._prototype.overriddenProperties.add(property);
          } else {
            this._prototype.overriddenProperties = new Set([property]);
          }
        }

        for (const instance of this.instances) {
          instance.prototypePropertyChanged(property);
        }
      },
      (property) => {
        this.onPropertyChanged(property);
      },
      () => {
        for (const child of this.children) {
          child.properties.inheritedTheme = this.properties.effectiveTheme;
        }
      },
    );

    this.layout = new Layout();

    this.updateTransform();
    this.updateLayoutConfiguration();
  }

  attachToPrototype(
    undo: Action[] | null,
    node: this,
    overriddenProperties?: Set<keyof NodeProperties>,
    overriddenChildren: boolean = false,
  ) {
    if (this._prototype) {
      throw new Error("Already attached to a prototype!");
    }

    undo?.push(new FunctionAction((_, undo) => this.detachFromPrototype(undo)));

    this._prototype = {
      node,
      overriddenProperties,
      childrenOverridden: overriddenChildren,
    };
    this._prototype.node.attachInstance(this);

    this.manager?.scenegraph.notifyPropertyChange(this);
  }

  setChildrenOverridden(undo: Action[] | null, childrenOverridden: boolean) {
    if (this._prototype) {
      const oldValue = this._prototype.childrenOverridden;
      undo?.push(
        new FunctionAction((_, undo) =>
          this.setChildrenOverridden(undo, oldValue),
        ),
      );
      this._prototype.childrenOverridden = childrenOverridden;
    }
  }

  detachFromPrototype(undo: Action[] | null) {
    if (!this._prototype) {
      // TODO(zaza): can't throw here yet because undo/redo will trigger this due to `unsafeRemoveNode()` calling `detachFromPrototype()`.
      // throw new Error("Not attached to a prototype!");
      return;
    }

    const prototype = {
      node: this._prototype.node,
      overriddenProperties: structuredClone(
        this._prototype.overriddenProperties,
      ),
      childrenOverridden: this._prototype.childrenOverridden,
    };
    undo?.push(
      new FunctionAction((_, undo) => {
        this.attachToPrototype(
          undo,
          prototype.node,
          prototype.overriddenProperties,
          prototype.childrenOverridden,
        );
      }),
    );

    this._prototype.node.detachInstance(this);
    this._prototype = undefined;

    this.manager?.scenegraph.notifyPropertyChange(this);
  }

  private attachInstance(node: SceneNode): void {
    this._instances.add(node);

    this.manager?.scenegraph.notifyPropertyChange(this);
  }

  private detachInstance(node: SceneNode): void {
    this._instances.delete(node);

    this.manager?.scenegraph.notifyPropertyChange(this);
  }

  private prototypePropertyChanged(property: keyof NodeProperties): void {
    if (!this._prototype) {
      throw new Error(
        `Received property change event with no prototype: ${property}`,
      );
    }

    // NOTE(zaza): if this node is controlled by a layout, it might happen that
    // the prototype is laid out _after_ this node, in which case changes to
    // x/y/width/height would overwrite what was set by the layout on this node.
    // This is a hack to prevent that.
    if (
      (property === "width" &&
        ((this.hasLayout() &&
          this.properties.resolved.horizontalSizing ===
            SizingBehavior.FitContent &&
          this.children.length !== 0) ||
          (this.isInLayout() &&
            this.properties.resolved.horizontalSizing ===
              SizingBehavior.FillContainer))) ||
      (property === "height" &&
        ((this.hasLayout() &&
          this.properties.resolved.verticalSizing ===
            SizingBehavior.FitContent &&
          this.children.length !== 0) ||
          (this.isInLayout() &&
            this.properties.resolved.verticalSizing ===
              SizingBehavior.FillContainer))) ||
      ((property === "x" || property === "y") && this.isInLayout())
    ) {
      return;
    }

    if (!(this._prototype.overriddenProperties?.has(property) ?? false)) {
      this.isHandlingPrototypeChange = true;
      (this.properties as any)[property] =
        this._prototype.node.properties[property];
      this.isHandlingPrototypeChange = false;
    }
  }

  get reusable(): boolean {
    return this._reusable;
  }

  setReusable(undo: Action[] | null, reusable: boolean) {
    if (this._reusable === reusable) {
      return;
    }

    const oldReusable = this._reusable;
    undo?.push(
      new FunctionAction((_, undo) => {
        this.setReusable(undo, oldReusable);
      }),
    );

    this._reusable = reusable;

    if (!reusable) {
      // NOTE(zaza): have to copy the array before iterating, because instance.detachFromPrototype() will modify it!
      for (const instance of [...this.instances]) {
        if (instance.id !== this.id) {
          instance.ensurePrototypeReusability(undo);
        }
      }
    }

    this.manager?.scenegraph.notifyPropertyChange(this);
  }

  ensurePrototypeReusability(
    undo: Action[] | null,
    steps: number = 0,
    isRoot: boolean = true,
  ): void {
    // NOTE(zaza): this method is a bit tricky.
    // Its purpose is to ensure that a node's subtree looks as if it was copied from a reusable node.
    // This is needed when e.g. a non-reusable node is copied from inside an instance's subtree.
    // So we walk back the node's prototype chain until we find a reusable node, and make that the prototype.
    // However, every node in our subtree must also walk back its prototype chain the same number of steps,
    // or more (!) in case they reach a non-reusable prototype.

    let prototype = this._prototype?.node;
    let overriddenProperties = structuredClone(
      this._prototype?.overriddenProperties,
    );
    let childrenOverridden = this._prototype?.childrenOverridden ?? false;

    // First, walk back the same steps as this node's parent had to in the prototype chain.
    for (let i = 0; i < steps; i++) {
      if (!isRoot && prototype?.isUnique) {
        steps = i;
        isRoot = true;
        reassignIds(undo, this, SceneGraph.createUniqueID());
        break;
      }

      overriddenProperties = union(
        overriddenProperties,
        prototype?._prototype?.overriddenProperties,
      );
      childrenOverridden =
        childrenOverridden ||
        (prototype?._prototype?.childrenOverridden ?? false);
      prototype = prototype?._prototype?.node;
    }

    if (isRoot) {
      // If this node's prototype is not reusable, walk back until we find a reusable one,
      // or until we run out of prototypes.
      while (prototype && !prototype.reusable) {
        overriddenProperties = union(
          overriddenProperties,
          prototype._prototype?.overriddenProperties,
        );
        childrenOverridden =
          childrenOverridden ||
          (prototype?._prototype?.childrenOverridden ?? false);
        prototype = prototype._prototype?.node;
        steps++;
      }

      isRoot = false;
    }

    // If there were any changes to the prototype, save it.
    if (prototype !== this.prototype?.node) {
      this.detachFromPrototype(undo);
      if (prototype) {
        this.attachToPrototype(
          undo,
          prototype,
          overriddenProperties,
          childrenOverridden,
        );
      } else {
        isRoot = true;
        steps = 0;
        for (const child of this.children) {
          reassignIds(undo, child, SceneGraph.createUniqueID());
        }
      }
    }

    // Finally, handle the children recursively.
    for (const child of this.children) {
      child.ensurePrototypeReusability(undo, steps, isRoot);
    }
  }

  get path(): string {
    return this.getPath();
  }

  getPath(ancestor?: SceneNode): string {
    if (!this.parent) {
      throw new Error(`This node (${this.id}) is not accessible!`);
    }

    let path = this.id;
    for (
      let node: SceneNode = this;
      node.parent !== ancestor && !node.isUnique;
      node = node.parent!
    ) {
      if (node.parent!.isInstanceBoundary) {
        path = `${node.parent!.id}/${path}`;
      }
    }
    return path;
  }

  get isUnique(): boolean {
    // NOTE(zaza): a _unique_ node is one that appears in the serialized .pen document.
    // That is, a node that is not an auto-created instance of another node.
    return this.id !== this.prototype?.node.id;
  }

  get isInstanceBoundary(): boolean {
    if (!this.prototype) {
      return false;
    } else if (this.id !== this.prototype.node.id) {
      return true;
    } else {
      return this.prototype.node.isInstanceBoundary;
    }
  }

  getNodeByPath(
    path: string,
    prefix: string = "",
    root: boolean = true,
  ): SceneNode | undefined {
    if (this.isUnique) {
      prefix = "";
    }

    if (prefix.concat(this.id) === path) {
      return this;
    }

    if (root) {
      root = false;
    } else if (this.isInstanceBoundary) {
      prefix += `${this.id}/`;
    }

    for (const child of this.children) {
      const result = child.getNodeByPath(path, prefix, root);
      if (result) {
        return result;
      }
    }

    return undefined;
  }

  canonicalizePath(path: string): string | undefined {
    const components = path.split("/");
    let node: SceneNode | undefined = this;
    for (let i = 0; i < components.length; i++) {
      node = node?.getNodeByPath(components[i]);
      if (!node) {
        return undefined;
      }
    }
    return node.getPath(this);
  }

  getWorldMatrix(): Matrix {
    return this.worldMatrix;
  }

  getLocalMatrix(): Matrix {
    return this.localMatrix;
  }

  updateTransform() {
    if (this.root) {
      return;
    }

    this.localMatrix.setTransform(
      this.properties.resolved.x + this._visualOffset[0],
      this.properties.resolved.y + this._visualOffset[1],
      0,
      0,
      this.properties.resolved.flipX ? -1 : 1,
      this.properties.resolved.flipY ? -1 : 1,
      this.properties.resolved.rotation ?? 0,
      0,
      0,
    );

    this.notifyTransformChange();
  }

  private notifyTransformChange() {
    for (
      let iter: SceneNode | null = this;
      iter && !iter.root;
      iter = iter.parent
    ) {
      iter.onChildTransformChange();
    }

    const queue: SceneNode[] = [this];
    while (queue.length) {
      const item = queue.shift();
      if (item) {
        item.onTransformChange();

        for (const child of item.children) {
          queue.push(child);
        }
      }
    }
  }

  setVisualOffset(x: number, y: number) {
    this._visualOffset[0] = x;
    this._visualOffset[1] = y;
    this.updateTransform();
  }

  onInsertToScene(manager: SceneManager) {
    this.manager = manager;

    this.renderOnTop = false;
    this._visualOffset[0] = 0;
    this._visualOffset[1] = 0;
  }

  onChildTransformChange() {}

  onParentChange(_oldParent: SceneNode | null, newParent: SceneNode | null) {
    this.manager?.scenegraph.invalidateLayout(this);

    if (newParent) {
      this.properties.inheritedTheme = newParent.properties.effectiveTheme;
    }
  }

  onTransformChange() {
    // TODO(sedivy): Just set a dirty flag and only do the matrix multiplication
    // when we need the matrix.

    if (this.parent && !this.parent.root) {
      this.worldMatrix.appendFrom(
        this.localMatrix,
        this.parent.getWorldMatrix(),
      );
    } else {
      this.worldMatrix.copyFrom(this.localMatrix);
    }
  }

  onPropertyChanged(property: keyof NodeProperties) {
    if (
      property === "layoutIncludeStroke" ||
      property === "layoutMode" ||
      property === "layoutChildSpacing" ||
      property === "layoutPadding" ||
      property === "layoutJustifyContent" ||
      property === "layoutAlignItems" ||
      property === "horizontalSizing" ||
      property === "verticalSizing"
    ) {
      this.updateLayoutConfiguration();
      this.manager?.scenegraph.invalidateLayout(this);
    }

    if (
      property === "width" ||
      property === "height" ||
      property === "enabled"
    ) {
      this.manager?.scenegraph.invalidateLayout(this);
    }

    if (
      property === "x" ||
      property === "y" ||
      property === "flipX" ||
      property === "flipY" ||
      property === "rotation"
    ) {
      this.updateTransform();
      this.manager?.scenegraph.invalidateLayout(this);
    }

    this.manager?.scenegraph.notifyPropertyChange(this);
  }

  childIndex(node: SceneNode): number {
    return this.children.indexOf(node);
  }

  setChildIndex(node: SceneNode, index: number) {
    const existing = this.childIndex(node);
    if (existing === -1) {
      throw new Error(
        `Cannot change the index of '${node.id}' as it is not a child of '${this.id}'!`,
      );
    } else if (existing === index) {
      return;
    } else if (index < 0) {
      throw new Error(
        `Cannot change the index of '${node.id}' to ${index} because negative values are invalid!`,
      );
    } else if (index > this.children.length) {
      throw new Error(
        `Cannot change the index of '${node.id}' to ${index} because '${this.id}' has only ${this.children.length} children!`,
      );
    }

    this.children.splice(existing, 1);

    if (index === this.children.length) {
      this.children.push(node);
    } else {
      this.children.splice(index, 0, node);
    }

    this.manager?.scenegraph.invalidateLayout(this);
  }

  removeChild(child: SceneNode) {
    if (child.parent !== this) {
      return false;
    }

    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }

    const oldParent = child.parent;
    child.parent = null;
    this.updateTransform();

    child.onParentChange(oldParent, null);

    return true;
  }

  canAcceptChildren(children?: Set<SceneNode>): boolean {
    if (
      this.prototype &&
      !this.prototype.childrenOverridden &&
      !(this.type === "frame" && (this as unknown as FrameNode).isSlotInstance)
    ) {
      return false;
    } else if (!children) {
      return true;
    } else if (
      children
        .values()
        .some(
          (child) => child.prototype && child.id === child.prototype.node.id,
        )
    ) {
      return false;
    }

    const instances = new Set<SceneNode>();
    const collectInstances = (node: SceneNode) => {
      if (node.prototype) {
        instances.add(node);
      } else {
        node.children.forEach(collectInstances);
      }
    };
    children.forEach(collectInstances);

    if (instances.size === 0) {
      return true;
    }

    const check = (node: SceneNode): boolean => {
      if (instances.has(node)) {
        return false;
      }
      for (const instance of node.instances) {
        if (instance.id !== node.id && !check(instance)) {
          return false;
        }
      }
      if (node.parent && !check(node.parent)) {
        return false;
      }
      return true;
    };
    return check(this);
  }

  addChild(child: SceneNode): boolean {
    if (child.parent === this) {
      return false;
    }

    if (this.isDescendandOf(child)) {
      return false;
    }

    const oldParent = child.parent;
    if (oldParent) {
      oldParent.removeChild(child);
    }

    child.parent = this;
    this.children.push(child);

    child.updateTransform();

    child.onParentChange(oldParent, this);

    return true;
  }

  isDescendandOf(parent: SceneNode): boolean {
    for (let iter: SceneNode | null = this; iter; iter = iter.parent) {
      if (iter === parent) {
        return true;
      }
    }

    return false;
  }

  hasParent(): boolean {
    if (this.parent == null || this.parent.root) {
      return false;
    }

    return true;
  }

  containsPointInBoundingBox(x: number, y: number): boolean {
    const localPoint = this.worldMatrix.applyInverse(new Point(x, y));
    return this.localBounds().containsPoint(localPoint.x, localPoint.y);
  }

  pointerHitTest(
    _shouldDirectSelect: boolean,
    _allowedNestedSearch: Set<SceneNode> | undefined,
    x: number,
    y: number,
  ): SceneNode | null {
    if (!this.properties.resolved.enabled) {
      return null;
    }

    if (this.containsPointInBoundingBox(x, y)) {
      return this;
    }

    return null;
  }

  localBounds(): ReadOnlyBounds {
    // TODO(sedivy): Only update the bounds when there was a change
    this._localBounds.set(
      0,
      0,
      this.properties.resolved.width,
      this.properties.resolved.height,
    );
    return this._localBounds;
  }

  getWorldBounds(): ReadOnlyBounds {
    // TODO(sedivy): Only update the bounds when there was a change
    this._worldBounds.copyFrom(this.localBounds());
    this._worldBounds.transform(this.worldMatrix);
    return this._worldBounds;
  }

  getVisualLocalBounds(): ReadOnlyBounds {
    this._visualLocalBounds.copyFrom(this.localBounds());
    expandBoundingBoxWithEffects(
      this.properties.resolved.effects,
      this._visualLocalBounds,
    );
    return this._visualLocalBounds;
  }

  getVisualWorldBounds(): ReadOnlyBounds {
    this._visualWorldBounds.copyFrom(this.getVisualLocalBounds());
    this._visualWorldBounds.transform(this.worldMatrix);
    return this._visualWorldBounds;
  }

  getTransformedLocalBounds(): ReadOnlyBounds {
    // TODO(sedivy): Only update the bounds when there was a change
    this._transformedLocalBounds.copyFrom(this.localBounds());
    this._transformedLocalBounds.transform(this.localMatrix);
    return this._transformedLocalBounds;
  }

  toLocalPointFromParent(x: number, y: number): Point {
    if (this.parent) {
      return this.parent.getWorldMatrix().applyInverse(new Point(x, y));
    }

    return new Point(x, y);
  }

  toLocal(x: number, y: number): Point {
    return this.getWorldMatrix().applyInverse(new Point(x, y));
  }

  toGlobalPoint(x: number, y: number): Point {
    if (this.parent) {
      return this.parent.getWorldMatrix().apply(new Point(x, y));
    }

    return new Point(x, y);
  }

  getGlobalPosition(): Point {
    return this.toGlobalPoint(
      this.properties.resolved.x + this.visualOffset[0],
      this.properties.resolved.y + this.visualOffset[1],
    );
  }

  destroy() {
    this.properties.destroy();
    this.destroyed = true;
  }

  overlapsNode(other: SceneNode): boolean {
    // TODO(sedivy): This does not handle rotation.
    const a = this.getWorldBounds();
    const b = other.getWorldBounds();

    return (
      a.maxX > b.minX && a.maxY > b.minY && a.minX < b.maxX && a.minY < b.maxY
    );
  }

  includesNode(childNode: SceneNode): boolean {
    // TODO(sedivy): This does not handle rotation.
    const parent = this.getWorldBounds();
    const child = childNode.getWorldBounds();

    return (
      parent.minX <= child.minX &&
      parent.minY <= child.minY &&
      parent.maxX >= child.maxX &&
      parent.maxY >= child.maxY
    );
  }

  intersectBounds(bounds: ReadOnlyBounds): boolean {
    return bounds.intersectsWithTransform(this.localBounds(), this.worldMatrix);
  }

  // NOTE(sedivy): The caller needs to getSaveCount() and restoreToCount().
  protected beginRenderEffects(canvas: Canvas) {
    const visualBounds = this.getVisualLocalBounds();
    const bounds = [
      visualBounds.minX,
      visualBounds.minY,
      visualBounds.maxX,
      visualBounds.maxY,
    ];

    if (
      this.properties.resolved.opacity != null &&
      this.properties.resolved.opacity < 1
    ) {
      const paint = new Skia.Paint();
      paint.setAlphaf(this.properties.resolved.opacity);

      canvas.saveLayer(paint, bounds);

      paint.delete();
    }

    if (this.properties.resolved.effects) {
      for (const effect of this.properties.resolved.effects) {
        if (effect.type === EffectType.BackgroundBlur && effect.enabled) {
          const blur = convertBlurRadiusToSigma(effect.radius);
          if (blur === 0) {
            continue;
          }

          const path = this.getMaskPath();
          if (path) {
            const paint = new Skia.Paint();
            paint.setBlendMode(Skia.BlendMode.Src);

            const blurImageFilter = Skia.ImageFilter.MakeBlur(
              blur,
              blur,
              Skia.TileMode.Clamp,
              null,
            );

            canvas.save();
            canvas.clipPath(path, Skia.ClipOp.Intersect, true);

            canvas.saveLayer(paint, bounds, blurImageFilter);
            canvas.restore();
            canvas.restore();

            blurImageFilter.delete();
            paint.delete();
          }
        }
      }

      for (const effect of this.properties.resolved.effects) {
        if (effect.type === EffectType.LayerBlur && effect.enabled) {
          const blur = convertBlurRadiusToSigma(effect.radius);
          if (blur === 0) {
            continue;
          }

          const blurFilter = Skia.ImageFilter.MakeBlur(
            blur,
            blur,
            Skia.TileMode.Clamp,
            null,
          );

          const paint = new Skia.Paint();
          paint.setImageFilter(blurFilter);

          canvas.saveLayer(paint, bounds);

          paint.delete();
          blurFilter.delete();
        }
      }

      for (const effect of this.properties.resolved.effects) {
        if (effect.type === EffectType.DropShadow && effect.enabled) {
          const blur = convertBlurRadiusToSigma(effect.radius);

          const x = effect.offsetX;
          const y = effect.offsetY;

          const shadowImageFilter = Skia.ImageFilter.MakeDropShadowOnly(
            x,
            y,
            blur,
            blur,
            new Float32Array(hexToColor(effect.color)),
            null,
          );

          canvas.save();

          const shadowPaint = new Skia.Paint();
          shadowPaint.setImageFilter(shadowImageFilter);

          if (effect.blendMode) {
            shadowPaint.setBlendMode(convertBlendModeToSkia(effect.blendMode));
          }

          const path = this.getMaskPath();
          if (path) {
            canvas.clipPath(path, Skia.ClipOp.Difference, true);
            canvas.drawPath(path, shadowPaint);
          }

          shadowPaint.delete();
          shadowImageFilter.delete();

          canvas.restore();
        }
      }
    }
  }

  getMaskPath(): Path | undefined {
    return undefined;
  }

  renderSkia(
    renderer: SkiaRenderer,
    canvas: Canvas,
    renderBounds: ReadOnlyBounds,
  ) {
    if (!this.properties.resolved.enabled) {
      return;
    }

    canvas.save();
    canvas.concat(this.localMatrix.toArray());

    for (const child of this.children) {
      child.renderSkia(renderer, canvas, renderBounds);
    }

    canvas.restore();
  }

  serialize(_options: {
    resolveVariables: boolean;
    includePathGeometry: boolean;
  }): NonNullable<Schema.CanHaveChildren["children"]>[0] {
    throw new Error("Missing serialize method");
  }

  updateLayoutConfiguration() {
    this.layout.sizingBehavior[0] =
      this.properties.resolved.horizontalSizing ?? SizingBehavior.Fixed;
    this.layout.sizingBehavior[1] =
      this.properties.resolved.verticalSizing ?? SizingBehavior.Fixed;

    switch (this.properties.resolved.layoutMode) {
      case LayoutMode.None:
        this.layout.direction = undefined;
        break;
      case LayoutMode.Horizontal:
        this.layout.direction = Axis.Horizontal;
        break;
      case LayoutMode.Vertical:
        this.layout.direction = Axis.Vertical;
        break;
      default: {
        const missing: never = this.properties.resolved.layoutMode;
        logger.error(`Unknown layout mode: ${missing}`);
      }
    }

    this.layout.childSpacing = this.properties.resolved.layoutChildSpacing ?? 0;

    this.layout.includeStroke =
      this.properties.resolved.layoutIncludeStroke ?? false;

    const padding = this.properties.resolved.layoutPadding;
    if (Array.isArray(padding)) {
      this.layout.padding[0] = padding[0];
      this.layout.padding[1] = padding[1];
      this.layout.padding[2] = padding[2 % padding.length];
      this.layout.padding[3] = padding[3 % padding.length];
    } else if (typeof padding === "number") {
      this.layout.padding[0] = padding;
      this.layout.padding[1] = padding;
      this.layout.padding[2] = padding;
      this.layout.padding[3] = padding;
    } else {
      this.layout.padding[0] = 0;
      this.layout.padding[1] = 0;
      this.layout.padding[2] = 0;
      this.layout.padding[3] = 0;
    }

    this.layout.justifyContent = this.properties.resolved.layoutJustifyContent;
    this.layout.alignItems = this.properties.resolved.layoutAlignItems;
  }

  affectsLayout() {
    return this.properties.resolved.enabled;
  }

  layoutCommitSize(axis: Axis, value: number): void {
    // TODO(sedivy): This is wrong when the node is rotated or flipped. We need to
    // transform from the incoming outer size to the inner size.

    // TODO(sedivy): When resizing text we need to switch to a different textGrowth.

    switch (axis) {
      case Axis.Horizontal:
        if (this.properties.width !== value) {
          this.properties.width = value;
        }
        break;
      case Axis.Vertical:
        if (this.properties.height !== value) {
          this.properties.height = value;
        }
        break;
    }
  }

  layoutCommitPosition(x: number, y: number): void {
    // NOTE(sedivy): The incoming x/y coordinate is the outer bounds
    // top-left position, but we can't store this directly because we
    // need to store the local coordinate position.
    const bounds = this.getTransformedLocalBounds();
    const originOffset = this.getLocalMatrix().apply({ x: 0, y: 0 });
    const localX = x - bounds.minX + originOffset.x;
    const localY = y - bounds.minY + originOffset.y;

    if (this.properties.x !== localX) {
      this.properties.x = localX;
    }

    if (this.properties.y !== localY) {
      this.properties.y = localY;
    }
  }

  layoutGetOuterBounds(): ReadOnlyBounds {
    return this.getTransformedLocalBounds();
  }

  layoutGetOuterSize(): [number, number] {
    const size = this.layoutGetOuterBounds();
    return [size.width, size.height];
  }

  layoutGetInnerSize(): [number, number] {
    const size = this.localBounds();
    return [
      size.width - (this.layout.padding[1] + this.layout.padding[3]),
      size.height - (this.layout.padding[0] + this.layout.padding[2]),
    ];
  }

  hasLayout(): boolean {
    return this.layout.direction != null;
  }

  isInLayout(): boolean {
    return this.parent?.hasLayout() === true;
  }

  getSnapPoints(): [number, number][] {
    const bounds = this.getWorldBounds();

    const centerX = bounds.centerX;
    const centerY = bounds.centerY;

    // NOTE(sedivy): I intentionally don't include (centerX, centerY) as a
    // single point to adjust how the snapping displays the lines.
    return [
      [bounds.left, bounds.top],
      [bounds.right, bounds.top],
      [centerX, bounds.top],
      [centerX, bounds.bottom],
      [bounds.left, centerY],
      [bounds.right, centerY],
      [bounds.left, bounds.bottom],
      [bounds.right, bounds.bottom],
    ];
  }

  // NOTE(sedivy): There are still some places in the codebase that work only
  // with a single color. For example text, sticky note, and icon_font. This is
  // a helper method to get a first solid color. Once we fully switch to
  // multiple fills everywhere then we can remove it.
  getFirstFillColor() {
    if (!this.properties.resolved.fills) {
      return null;
    }

    for (const fill of this.properties.resolved.fills) {
      if (fill.type === FillType.Color) {
        return fill.color;
      }
    }
  }

  supportsImageFill(): boolean {
    return false;
  }

  handleViewClick(_e: MouseEvent, _worldX: number, _worldY: number): boolean {
    return false;
  }

  handleCursorForView(_worldX: number, _worldY: number): string | undefined {
    return undefined;
  }

  getViewAtPoint(
    _worldX: number,
    _worldY: number,
  ): Component<BaseProps> | undefined {
    return undefined;
  }

  findInsertionIndexInLayout(
    worldX: number,
    worldY: number,
    ignore: Set<SceneNode> | undefined,
  ): number | undefined {
    const localPoint = this.toLocal(worldX, worldY);

    return findInsertionIndexInLayout(this, localPoint.x, localPoint.y, ignore);
  }

  setWorldTransform(block: ObjectUpdateBlock, matrix: Matrix) {
    const localMatrix = this.parent
      ? this.parent.getWorldMatrix().clone().invert().append(matrix)
      : matrix;

    block.update(this, decomposeMatrixIntoNodeProperties(localMatrix));
  }

  createInstancesFromSubtree(parent?: SceneNode) {
    const instance = SceneGraph.createNode(this.id, this.type, this.properties);
    instance.attachToPrototype(null, this);
    parent?.addChild(instance);

    for (const child of this.children) {
      child.createInstancesFromSubtree(instance);
    }

    return instance;
  }
}

function union<T>(
  a: Set<T> | undefined,
  b: Set<T> | undefined,
): Set<T> | undefined {
  if (a && b) {
    return a.union(b);
  } else if (a) {
    return new Set(a);
  } else if (b) {
    return new Set(b);
  } else {
    return undefined;
  }
}

function reassignIds(undo: Action[] | null, node: SceneNode, id: string) {
  const oldId = node.id;
  reassignId(undo, node, id);

  for (const instance of node.instances) {
    if (instance.id === oldId) {
      reassignIds(undo, instance, id);
    }
  }
}

function reassignId(undo: Action[] | null, node: SceneNode, id: string) {
  const oldId = node.id;
  node.id = id;
  undo?.push(new FunctionAction((_, undo) => reassignId(undo, node, oldId)));
}

function decomposeMatrixIntoNodeProperties(matrix: Matrix): {
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
  rotation: number;
} {
  const { a, b, c, d, tx, ty } = matrix;

  const determinant = a * d - b * c;
  if (determinant >= 0) {
    const rotation = Math.atan2(b, a);
    return { x: tx, y: ty, flipX: false, flipY: false, rotation };
  }

  const rotation = Math.atan2(-b, -a);
  return { x: tx, y: ty, flipX: true, flipY: false, rotation };
}
