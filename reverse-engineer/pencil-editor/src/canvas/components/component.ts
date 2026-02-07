import type { Canvas } from "@highagency/pencil-skia";
import type { SkiaRenderer } from "../../skia-renderer";
import { Bounds, type ReadOnlyBounds } from "../../utils/bounds";
import {
  AlignItems,
  Axis,
  JustifyContent,
  Layout,
  type LayoutInterface,
  LayoutMode,
  layoutForRoot,
  SizingBehavior,
} from "../layout";

export type BaseProps = {
  ref?: { current: Component<BaseProps> | null };
  children?: (Component<BaseProps> | undefined)[];

  x?: number;
  y?: number;

  width?: number | "fit" | "fill";
  height?: number | "fit" | "fill";

  layout?: LayoutMode;
  childSpacing?: number;
  padding?: [number, number, number, number]; // top, right, bottom, left
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;

  visible?: boolean;
  clip?: boolean;

  cursor?: string;

  onClick?: (e: MouseEvent) => void;
  onPointerDown?: (e: MouseEvent) => void;
};

export class Component<Props extends BaseProps> implements LayoutInterface {
  props: Props;
  parent?: Component<BaseProps> = undefined;
  children: Component<BaseProps>[] = [];

  layout: Layout = new Layout();

  x: number = 0;
  y: number = 0;
  width: number = 0;
  height: number = 0;

  constructor(props: Props) {
    this.props = props;

    if (props.children) {
      for (const child of props.children) {
        if (child) {
          this.children.push(child);
          child.parent = this;
        }
      }
    }

    if (this.props.ref) {
      this.props.ref.current = this;
    }

    this.x = this.props.x ?? 0;
    this.y = this.props.y ?? 0;

    if (typeof this.props.width === "number") {
      this.layout.sizingBehavior[0] = SizingBehavior.Fixed;
      this.width = this.props.width;
    } else if (this.props.width != null) {
      this.layout.sizingBehavior[0] =
        this.props.width === "fit"
          ? SizingBehavior.FitContent
          : SizingBehavior.FillContainer;
    } else {
      this.layout.sizingBehavior[0] = SizingBehavior.FitContent;
    }

    if (typeof this.props.height === "number") {
      this.layout.sizingBehavior[1] = SizingBehavior.Fixed;
      this.height = this.props.height;
    } else if (this.props.height != null) {
      this.layout.sizingBehavior[1] =
        this.props.height === "fit"
          ? SizingBehavior.FitContent
          : SizingBehavior.FillContainer;
    } else {
      this.layout.sizingBehavior[1] = SizingBehavior.FitContent;
    }

    switch (this.props.layout) {
      case LayoutMode.Horizontal:
        this.layout.direction = Axis.Horizontal;
        break;
      case LayoutMode.Vertical:
        this.layout.direction = Axis.Vertical;
        break;
      case LayoutMode.None:
        this.layout.direction = undefined;
        break;
      case undefined:
        this.layout.direction = Axis.Vertical;
        break;
    }
    this.layout.childSpacing = this.props.childSpacing ?? 0;
    this.layout.padding = this.props.padding ?? [0, 0, 0, 0];
    this.layout.justifyContent =
      this.props.justifyContent ?? JustifyContent.Start;
    this.layout.alignItems = this.props.alignItems ?? AlignItems.Start;
  }

  render(_renderer: SkiaRenderer, _canvas: Canvas): void {}

  destroy(): void {
    for (const child of this.children) {
      child.destroy();
    }
  }

  protected getRelativeBounds(): ReadOnlyBounds {
    return Bounds.MakeXYWH(this.x, this.y, this.width, this.height);
  }

  getNodeBounds(): ReadOnlyBounds {
    const bounds = this.getRelativeBounds().clone();

    let offsetX = 0;
    let offsetY = 0;
    for (let node = this.parent; node != null; node = node.parent) {
      offsetX += node.x ?? 0;
      offsetY += node.y ?? 0;
    }

    bounds.translate(offsetX, offsetY);

    return bounds;
  }

  layoutCommitSize(axis: Axis, value: number): void {
    switch (axis) {
      case Axis.Horizontal:
        this.width = value;
        break;
      case Axis.Vertical:
        this.height = value;
        break;
    }
  }

  layoutCommitPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  layoutGetOuterBounds(): ReadOnlyBounds {
    return this.getRelativeBounds();
  }

  layoutGetOuterSize(): [number, number] {
    const bounds = this.getRelativeBounds();
    return [bounds.width, bounds.height];
  }

  layoutGetInnerSize(): [number, number] {
    const bounds = this.getRelativeBounds();
    return [
      bounds.width - (this.layout.padding[1] + this.layout.padding[3]),
      bounds.height - (this.layout.padding[0] + this.layout.padding[2]),
    ];
  }

  affectsLayout(): boolean {
    return true;
  }

  performLayout() {
    layoutForRoot([this]);
  }

  getViewAtPoint(x: number, y: number): Component<BaseProps> | undefined {
    const insideBounds = this.getNodeBounds().containsPoint(x, y);

    if (!this.props.clip || insideBounds) {
      if (this.children) {
        for (const child of this.children) {
          const childView = child.getViewAtPoint(x, y);
          if (childView) {
            return childView;
          }
        }
      }
    }

    if (insideBounds) {
      return this;
    }
  }

  handleViewClick(e: MouseEvent, x: number, y: number): boolean {
    const view = this.getViewAtPoint(x, y);
    if (!view) {
      return false;
    }

    for (
      let item: Component<BaseProps> | undefined = view;
      item != null;
      item = item.parent
    ) {
      // TODO(sedivy): Add preventDefault and stopPropagation support.
      if (item.props.onClick) {
        item.props.onClick(e);
        return true;
      }
    }

    return false;
  }

  handleViewPointerDown(e: MouseEvent, x: number, y: number): boolean {
    const view = this.getViewAtPoint(x, y);
    if (!view) {
      return false;
    }

    for (
      let item: Component<BaseProps> | undefined = view;
      item != null;
      item = item.parent
    ) {
      // TODO(sedivy): Add preventDefault and stopPropagation support.
      if (item.props.onPointerDown) {
        item.props.onPointerDown(e);
        return true;
      }
    }

    return false;
  }

  cursorForPoint(x: number, y: number): string | undefined {
    const view = this.getViewAtPoint(x, y);
    if (!view) {
      return;
    }

    for (
      let item: Component<BaseProps> | undefined = view;
      item != null;
      item = item.parent
    ) {
      if (item.props.cursor) {
        return item.props.cursor;
      }
    }
  }

  isInteractive(): boolean {
    for (
      let item: Component<BaseProps> | undefined = this;
      item != null;
      item = item.parent
    ) {
      if (item.props.onClick) {
        return true;
      }
    }

    return false;
  }
}
