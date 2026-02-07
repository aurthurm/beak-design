import type { ReadOnlyBounds } from "../utils";
import { safeRatio0 } from "../utils/math";
import type { SceneGraph } from "./scene-graph";

export enum Axis {
  Horizontal = 0,
  Vertical = 1,
}

export enum LayoutMode {
  None = 0,
  Horizontal = 1,
  Vertical = 2,
}

export enum SizingBehavior {
  Fixed = 0,
  FitContent = 2,
  FillContainer = 3,
}

export enum JustifyContent {
  Start = 0,
  Center = 1,
  SpaceBetween = 2,
  SpaceAround = 3,
  End = 4,
}

export enum AlignItems {
  Start = 0,
  Center = 1,
  End = 2,
}

export interface LayoutInterface {
  layout: Layout;

  children: LayoutInterface[];

  layoutCommitSize(axis: Axis, value: number): void;
  layoutCommitPosition(x: number, y: number): void;
  layoutGetOuterSize(): [number, number];
  layoutGetOuterBounds(): ReadOnlyBounds;
  layoutGetInnerSize(): [number, number];

  affectsLayout(): boolean;
}

export class Layout {
  sizingBehavior: [SizingBehavior, SizingBehavior] = [
    SizingBehavior.Fixed,
    SizingBehavior.Fixed,
  ];

  direction?: Axis;
  includeStroke: boolean = false; // TODO(sedivy): Add support for sizing layout that includes stroke.
  childSpacing: number = 0;
  padding: [number, number, number, number] = [0, 0, 0, 0]; // top, right, bottom, left
  justifyContent: JustifyContent = JustifyContent.Start;
  alignItems: AlignItems = AlignItems.Start;
}

function calculateFitContainers(node: LayoutInterface, axis: Axis) {
  if (!node.affectsLayout()) {
    return;
  }

  for (const child of node.children) {
    calculateFitContainers(child, axis);
  }

  // NOTE(sedivy): Only perform FitContent layout when needed (has children, has
  // layout, and at least one sizing behavior requires it)
  if (
    node.children.length > 0 &&
    node.layout.direction != null &&
    node.layout.sizingBehavior[axis] === SizingBehavior.FitContent
  ) {
    let size = 0;

    if (node.layout.sizingBehavior[axis] === SizingBehavior.FitContent) {
      let count = 0;

      for (const child of node.children) {
        if (!child.affectsLayout()) continue;

        count += 1;

        const childSize = child.layoutGetOuterSize()[axis];
        if (node.layout.direction === axis) {
          size += childSize;
        } else {
          size = Math.max(size, childSize);
        }
      }

      if (node.layout.direction === axis) {
        size += node.layout.childSpacing * Math.max(0, count - 1);
      }
    }

    switch (axis) {
      case Axis.Horizontal: {
        const width = size + node.layout.padding[1] + node.layout.padding[3];
        node.layoutCommitSize(axis, width);
        break;
      }
      case Axis.Vertical: {
        const height = size + node.layout.padding[0] + node.layout.padding[2];
        node.layoutCommitSize(axis, height);
        break;
      }
    }
  }
}

function calculateFillContainers(node: LayoutInterface, axis: Axis) {
  if (!node.affectsLayout()) return;

  // NOTE(sedivy): Distribute the available size evenly to all `FillContainer` children.
  if (node.layout.direction != null) {
    const remainingSize = node.layoutGetInnerSize();

    let childSize = 0;

    let growableCount = 0;

    if (node.layout.direction === axis) {
      let count = 0;
      for (const child of node.children) {
        if (!child.affectsLayout()) continue;
        count += 1;

        if (
          child.layout.sizingBehavior[axis] === SizingBehavior.FillContainer
        ) {
          growableCount += 1;
        } else {
          remainingSize[axis] -= child.layoutGetOuterSize()[axis];
        }
      }

      remainingSize[axis] -= Math.max(0, count - 1) * node.layout.childSpacing;

      childSize = safeRatio0(remainingSize[axis], growableCount);
    } else {
      childSize = remainingSize[axis];
    }

    childSize = Math.max(1, childSize);

    for (const child of node.children) {
      if (!child.affectsLayout()) continue;

      if (child.layout.sizingBehavior[axis] === SizingBehavior.FillContainer) {
        child.layoutCommitSize(axis, childSize);
      }
    }
  }

  for (const child of node.children) {
    if (!child.affectsLayout()) continue;
    calculateFillContainers(child, axis);
  }
}

function calculatePositions(node: LayoutInterface) {
  if (!node.affectsLayout()) return;

  if (node.layout.direction != null && node.children.length !== 0) {
    const axis = node.layout.direction;
    const crossAxis = axis === Axis.Vertical ? Axis.Horizontal : Axis.Vertical;

    const pos: [number, number] = [
      node.layout.padding[3],
      node.layout.padding[0],
    ];

    const innerSize = node.layoutGetInnerSize();

    const freeSpace = [innerSize[0], innerSize[1]];

    let count = 0;

    for (const child of node.children) {
      if (!child.affectsLayout()) continue;

      count += 1;

      const outerSize = child.layoutGetOuterSize();
      freeSpace[0] -= outerSize[0];
      freeSpace[1] -= outerSize[1];
    }

    let childSpacing = node.layout.childSpacing;

    if (count > 0) {
      switch (node.layout.justifyContent) {
        case JustifyContent.Start: {
          break;
        }

        case JustifyContent.End: {
          pos[axis] += freeSpace[axis] - childSpacing * (count - 1);
          break;
        }

        case JustifyContent.Center: {
          pos[axis] += (freeSpace[axis] - childSpacing * (count - 1)) / 2.0;
          break;
        }

        case JustifyContent.SpaceBetween: {
          childSpacing = freeSpace[axis] / (count - 1);
          break;
        }

        case JustifyContent.SpaceAround: {
          childSpacing = freeSpace[axis] / count;
          pos[axis] += childSpacing / 2;
          break;
        }
      }
    }

    for (const child of node.children) {
      if (!child.affectsLayout()) continue;

      const childPos: [number, number] = [pos[0], pos[1]];

      const childOuterSize = child.layoutGetOuterSize();

      switch (node.layout.alignItems) {
        case AlignItems.Start: {
          break;
        }

        case AlignItems.End: {
          const childSize = childOuterSize[crossAxis];
          childPos[crossAxis] += innerSize[crossAxis] - childSize;
          break;
        }

        case AlignItems.Center: {
          const childSize = childOuterSize[crossAxis];
          childPos[crossAxis] += (innerSize[crossAxis] - childSize) / 2.0;
          break;
        }
      }

      child.layoutCommitPosition(childPos[0], childPos[1]);

      pos[axis] += childOuterSize[axis];
      pos[axis] += childSpacing;
    }
  }

  for (const child of node.children) {
    if (!child.affectsLayout()) continue;
    calculatePositions(child);
  }
}

export function layout(sceneGraph: SceneGraph) {
  const root = sceneGraph.getViewportNode();
  layoutForRoot(root.children);
}

export function layoutForRoot(children: LayoutInterface[]) {
  // NOTE(sediv): First calculate fit and fill layout for all nodes on the
  // horizontal axis to correctly set text wrapping.

  for (const child of children) {
    calculateFitContainers(child, Axis.Horizontal);
  }

  for (const child of children) {
    calculateFillContainers(child, Axis.Horizontal);
  }

  // NOTE(sedivy): After horizontal axis has been updated, including text
  // wrapping, we can calculate fit and fill layout for the vertical axis.

  for (const child of children) {
    calculateFitContainers(child, Axis.Vertical);
  }

  for (const child of children) {
    calculateFillContainers(child, Axis.Vertical);
  }

  // NOTE(sedivy): After we have sizes for all nodes we can calculate position
  // and alignment.

  for (const child of children) {
    calculatePositions(child);
  }
}

export function findInsertionIndexInLayout(
  parent: LayoutInterface,
  localX: number,
  localY: number,
  ignore: Set<LayoutInterface> | undefined,
): number | undefined {
  if (parent.layout.direction == null) {
    return;
  }

  const isHorizontal = parent.layout.direction === Axis.Horizontal;
  const position = isHorizontal ? localX : localY;

  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (ignore?.has(child) || !child.affectsLayout()) {
      continue;
    }

    const bounds = child.layoutGetOuterBounds();
    const childMid = isHorizontal ? bounds.centerX : bounds.centerY;

    if (position < childMid) {
      return i;
    }
  }

  return parent.children.length;
}
