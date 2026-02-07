import type { PointData } from "pixi.js";
import { Bounds } from "../utils/bounds";
import type { SceneNode } from "./scene-node";

export class NodeUtils {
  /**
   * Calculates a rectangle from two points, handling shift and alt modifiers.
   * @param p1 - The starting point.
   * @param p2 - The ending point.
   * @param shiftKey - If true, maintains a 1:1 aspect ratio.
   * @param altKey - If true, draws from the center.
   * @returns The calculated Rectangle.
   */
  public static calculateRectFromPoints(
    p1: PointData,
    p2: PointData,
    shiftKey: boolean = false,
    altKey: boolean = false,
  ): Bounds {
    let startX = p1.x;
    let startY = p1.y;
    let endX = p2.x;
    let endY = p2.y;

    let dx = endX - startX;
    let dy = endY - startY;

    if (shiftKey) {
      const signX = Math.sign(dx) || 1;
      const signY = Math.sign(dy) || 1;
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      dx = size * signX;
      dy = size * signY;
      endX = startX + dx;
      endY = startY + dy;
    }

    if (altKey) {
      // start point is center
      startX = p1.x - dx;
      startY = p1.y - dy;
      endX = p1.x + dx;
      endY = p1.y + dy;
    }

    const finalWidth = Math.abs(startX - endX);
    const finalHeight = Math.abs(startY - endY);
    const finalX = Math.min(startX, endX);
    const finalY = Math.min(startY, endY);

    return Bounds.MakeXYWH(finalX, finalY, finalWidth, finalHeight);
  }

  public static calculateCombinedBoundsNew(
    nodes: Set<SceneNode>,
  ): Bounds | null {
    if (!nodes || nodes.size === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const item of nodes) {
      if (item.destroyed) {
        continue;
      }

      const bounds = item.getWorldBounds();
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return null;
    }

    return new Bounds(minX, minY, maxX, maxY);
  }

  public static calculateCombinedBoundsFromArray(
    nodes: SceneNode[],
  ): Bounds | null {
    if (nodes.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const item of nodes) {
      if (item.destroyed) {
        continue;
      }
      const bounds = item.getWorldBounds();
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return null;
    }

    return new Bounds(minX, minY, maxX, maxY);
  }

  public static svgToBase64(svg: string) {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  public static getTopLevelNodes(
    nodes: SceneNode[],
    rootNode: SceneNode,
  ): SceneNode[] {
    const nodeSet = new Set(nodes);
    const topLevelNodes: SceneNode[] = [];

    const collectTopLevelNodes = (node: SceneNode) => {
      if (nodeSet.has(node)) {
        topLevelNodes.push(node);
        nodeSet.delete(node);
      } else {
        node.children.forEach(collectTopLevelNodes);
      }
    };

    collectTopLevelNodes(rootNode);

    return topLevelNodes;
  }
}
