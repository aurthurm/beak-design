import { Container, Graphics, Point, type PointData } from "pixi.js"; // Import PointData
import { logger } from "@ha/shared";
import type { SceneManager } from "../managers/scene-manager"; // Might be needed if accessing selection state
import type { Anchor, Connection } from "../types/connections";
import { COLORS } from "../utils/constants";
import * as math from "../utils/math";
import { BoundingBox } from "./bounding-box";
import { FrameNamesManager } from "./frame-names-manager";
import type { SceneNode } from "./scene-node";
import type { ReadOnlyBounds } from "../utils/bounds";
import * as platform from "../platform";

// Constants for stroke width scaling
const BASE_STROKE_WIDTH = 1;

export class GuidesGraph {
  public frameNamesManager?: FrameNamesManager;
  private boundingBoxesContainer: Container;
  private connectionsContainer: Container;
  private connectionsGraphics: Graphics;
  private tempConnectionLine: Graphics | null = null;
  private boundingBoxes: Map<string, BoundingBox> = new Map();
  private multiSelectBoundingBox: BoundingBox | null = null;
  private sceneManager: SceneManager;

  mainContainer: Container;

  private drawingGuideShape: Graphics | null = null;
  private drawingGuideType:
    | "rectangle"
    | "ellipse"
    | "frame"
    | "marquee"
    | "text"
    | "sticky_note"
    | null = null;
  private drawingGuideStartX: number = 0;
  private drawingGuideStartY: number = 0;

  constructor(sceneManager: SceneManager) {
    const guidesNode = new Container();
    guidesNode.label = "guides";

    this.mainContainer = guidesNode;
    this.sceneManager = sceneManager;

    this.boundingBoxesContainer = new Container();
    this.boundingBoxesContainer.label = "BoundingBoxes";
    this.mainContainer.addChild(this.boundingBoxesContainer);

    this.connectionsContainer = new Container();
    this.connectionsContainer.label = "Connections";
    this.mainContainer.addChild(this.connectionsContainer);

    this.connectionsGraphics = new Graphics();
    this.connectionsGraphics.label = "ConnectionsGraphics";
    this.connectionsContainer.addChild(this.connectionsGraphics);

    if (!platform.isHeadlessMode) {
      this.frameNamesManager = new FrameNamesManager(sceneManager);
      this.mainContainer.addChild(this.frameNamesManager.container);
    }

    this.sceneManager.pixiManager.addContainer(this.mainContainer);
  }

  public getConnectionsContainer(): Container {
    return this.connectionsContainer;
  }

  public drawConnections(connections: Connection[]): void {
    this.connectionsGraphics.clear();

    for (const connection of connections) {
      const sourceNode = this.sceneManager.scenegraph.getNodeByPath(
        connection.sourceNodeId,
      );
      const targetNode = this.sceneManager.scenegraph.getNodeByPath(
        connection.targetNodeId,
      );

      if (sourceNode && targetNode) {
        const sourcePoint = this.getAnchorPoint(
          sourceNode,
          connection.sourceAnchor,
        );
        const targetPoint = this.getAnchorPoint(
          targetNode,
          connection.targetAnchor,
        );
        // This just adds the path to the graphics object, it doesn't draw it yet.
        this.drawOrthogonalConnection(
          sourcePoint,
          targetPoint,
          connection.sourceAnchor ?? "center",
          connection.targetAnchor ?? "center",
        );
      }
    }

    // Now, stroke the entire path that has been built up.
    this.connectionsGraphics.stroke({
      width: 2,
      color: COLORS.LIGHT_BLUE,
      alpha: 1.0,
    });
  }

  getAnchorPoint(
    node: SceneNode,
    anchor?: "center" | "top" | "bottom" | "left" | "right",
  ): Point {
    const bounds = node.getWorldBounds();

    const worldPos = new Point(bounds.x, bounds.y);

    switch (anchor) {
      case "top":
        return new Point(worldPos.x + bounds.width / 2, worldPos.y);
      case "bottom":
        return new Point(
          worldPos.x + bounds.width / 2,
          worldPos.y + bounds.height,
        );
      case "left":
        return new Point(worldPos.x, worldPos.y + bounds.height / 2);
      case "right":
        return new Point(
          worldPos.x + bounds.width,
          worldPos.y + bounds.height / 2,
        );
      case "center":
      default:
        // Default to center
        return new Point(
          worldPos.x + bounds.width / 2,
          worldPos.y + bounds.height / 2,
        );
    }
  }

  public findClosestAnchor(
    node: SceneNode,
    point: PointData,
  ): { anchor: "top" | "right" | "bottom" | "left" | "center"; point: Point } {
    const anchors: ("top" | "right" | "bottom" | "left" | "center")[] = [
      "top",
      "right",
      "bottom",
      "left",
      "center",
    ];
    let closestAnchor: "top" | "right" | "bottom" | "left" | "center" =
      "center";
    let minDistance = Infinity;
    let closestPoint: Point = new Point();

    for (const anchor of anchors) {
      const anchorPoint = this.getAnchorPoint(node, anchor);

      const distance = math.distance(point, anchorPoint);

      if (distance < minDistance) {
        minDistance = distance;
        closestAnchor = anchor;
        closestPoint = anchorPoint;
      }
    }

    return { anchor: closestAnchor, point: closestPoint };
  }

  private drawOrthogonalConnection(
    from: Point,
    to: Point,
    fromAnchor: Anchor,
    toAnchor: Anchor,
  ) {
    const points = this.constructConnectorPath(
      from,
      to,
      fromAnchor,
      toAnchor,
      30 * this.sceneManager.camera.zoom,
    );

    this.drawRoundedPolyline(this.connectionsGraphics, points, 10);
  }

  private drawRoundedPolyline(
    graphics: Graphics,
    points: PointData[],
    cornerRadius: number,
  ): void {
    if (points.length < 2) return;

    graphics.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i - 1];
      const p2 = points[i]; // This is the corner point
      const p3 = points[i + 1];

      const d1 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      if (d1 < 1e-6) continue; // Skip if points are identical
      const t1 = Math.min(cornerRadius / d1, 0.5);
      const curve_start_x = p2.x - t1 * (p2.x - p1.x);
      const curve_start_y = p2.y - t1 * (p2.y - p1.y);

      graphics.lineTo(curve_start_x, curve_start_y);

      const d2 = Math.sqrt((p3.x - p2.x) ** 2 + (p3.y - p2.y) ** 2);
      if (d2 < 1e-6) continue;
      const t2 = Math.min(cornerRadius / d2, 0.5);
      const curve_end_x = p2.x + t2 * (p3.x - p2.x);
      const curve_end_y = p2.y + t2 * (p3.y - p2.y);

      graphics.quadraticCurveTo(p2.x, p2.y, curve_end_x, curve_end_y);
    }
    graphics.lineTo(points[points.length - 1].x, points[points.length - 1].y);

    graphics.stroke({ width: 2, color: 0x3d99ff });
  }

  public drawTempConnection(
    from: Point,
    to: PointData,
    fromAnchor: Anchor,
    toAnchor: Anchor,
    previewConnectionSidesNode: SceneNode | null,
  ): void {
    if (!this.tempConnectionLine) {
      this.tempConnectionLine = new Graphics();
      this.tempConnectionLine.label = "temp-connection-line";
      this.connectionsContainer.addChild(this.tempConnectionLine);
    }

    this.tempConnectionLine.removeChildren().forEach((child) => {
      child.destroy();
    });
    this.tempConnectionLine.clear();

    const graphics = this.tempConnectionLine;

    const anchors: ("top" | "right" | "bottom" | "left" | "center")[] = [
      "top",
      "right",
      "bottom",
      "left",
      "center",
    ];

    if (previewConnectionSidesNode) {
      const bounds = previewConnectionSidesNode.getWorldBounds();

      const min = this.sceneManager.camera.toScreen(bounds.minX, bounds.minY);
      const max = this.sceneManager.camera.toScreen(bounds.maxX, bounds.maxY);

      graphics.rect(min.x, min.y, max.x - min.x, max.y - min.y);
      graphics.fill({ color: 0x008cf7, alpha: 0.1 });
      graphics.stroke({
        width: 1,
        color: 0x0091ff,
        join: "round",
      });

      for (const anchor of anchors) {
        const point = this.getAnchorPoint(previewConnectionSidesNode, anchor);

        const screen = this.sceneManager.camera.toScreen(point.x, point.y);

        graphics.circle(screen.x, screen.y, 5);
        graphics.fill(0x0091ff);
        graphics.stroke({
          width: 2,
          color: 0xffffff,
        });
      }
    }

    this.drawTempOrthogonalConnection(from, to, fromAnchor, toAnchor);
  }

  constructConnectorPath(
    fromPointWorldSpace: Point,
    toPointWorldSpace: PointData,
    fromAnchor: Anchor,
    toAnchor: Anchor,
    minDistance: number = 30, // minimum distance to extend from anchor before turning
  ): PointData[] {
    const fromPoint = this.sceneManager.camera.toScreen(
      fromPointWorldSpace.x,
      fromPointWorldSpace.y,
    );
    const toPoint = this.sceneManager.camera.toScreen(
      toPointWorldSpace.x,
      toPointWorldSpace.y,
    );

    const path: PointData[] = [];

    function addPoint(point: PointData) {
      if (
        path.length === 0 ||
        path[path.length - 1].x !== point.x ||
        path[path.length - 1].y !== point.y
      ) {
        path.push(point);
      }
    }

    // Calculate direction vectors for each anchor
    const getDirection = (anchor: Anchor) => {
      switch (anchor) {
        case "top":
          return { x: 0, y: -1 };
        case "bottom":
          return { x: 0, y: 1 };
        case "left":
          return { x: -1, y: 0 };
        case "right":
          return { x: 1, y: 0 };
        case "center":
          return { x: 0, y: 0 };
      }
    };

    const fromDir = getDirection(fromAnchor);
    const toDir = getDirection(toAnchor);

    // Calculate extension points
    const fromExtension = new Point(
      fromPoint.x + fromDir.x * minDistance,
      fromPoint.y + fromDir.y * minDistance,
    );

    const toExtension = new Point(
      toPoint.x + toDir.x * minDistance,
      toPoint.y + toDir.y * minDistance,
    );

    addPoint(fromPoint);
    addPoint(fromExtension);

    // TODO(sedivy): Add smart routing

    addPoint(toExtension);
    addPoint(toPoint);

    return path;
  }

  private drawTempOrthogonalConnection(
    from: Point,
    to: PointData,
    fromAnchor: Anchor,
    toAnchor: Anchor,
  ): void {
    const graphics = this.tempConnectionLine;
    if (!graphics) {
      return;
    }

    const points = this.constructConnectorPath(
      from,
      to,
      fromAnchor,
      toAnchor,
      30,
    );

    this.drawRoundedPolyline(graphics, points, 10);
  }

  public clearTempConnection(): void {
    if (this.tempConnectionLine) {
      this.connectionsContainer.removeChild(this.tempConnectionLine);
      this.tempConnectionLine.destroy();
      this.tempConnectionLine = null;
    }
  }

  public clearConnections(): void {
    this.connectionsGraphics.clear();
  }

  setPositionAndScale(position: Point, scale: Point) {
    this.mainContainer.position.set(position.x, position.y);
    this.mainContainer.scale.set(scale.x, scale.y);
  }

  // Method to add an arbitrary Container (like Graphics) to the guides layer
  // Note: This adds to the main container, above all specific guide types.
  addGuideObject(object: Container) {
    if (!object.label) {
      logger.warn(
        "Guide object added without a label. It might be hard to remove.",
      );
      object.label = `guide-object-${Date.now()}`;
    }
    this.mainContainer.addChild(object);
  }

  removeGuideObject(object: Container) {
    this.mainContainer.removeChild(object);
  }

  removeAllGuideObjects() {
    // Only removes children directly added via addGuideObject
    // Consider if this should clear specific containers too, or be removed.
    const childrenToRemove = this.mainContainer.children.filter(
      (child) =>
        child !== this.boundingBoxesContainer &&
        child !== this.connectionsContainer &&
        this.frameNamesManager &&
        child !== this.frameNamesManager.container,
    );
    childrenToRemove.forEach((child) => {
      this.mainContainer.removeChild(child);
    });
  }

  // Bounding box methods - Accept viewport
  addBoundingBox(sceneNode: SceneNode): BoundingBox {
    const box = new BoundingBox(this.sceneManager);
    box.drawForNode(sceneNode);
    this.boundingBoxesContainer.addChild(box);
    this.boundingBoxes.set(sceneNode.path, box);
    return box;
  }

  hideBoundingBox(sceneNodePath: string) {
    // Accept ID for consistency
    const box = this.boundingBoxes.get(sceneNodePath);
    if (box) {
      box.visible = false;
    }
  }

  // updateBoundingBox - needs viewport
  updateBoundingBox(sceneNode: SceneNode, hideBoundingBox: boolean = false) {
    const box = this.boundingBoxes.get(sceneNode.path);
    if (box) {
      if (hideBoundingBox) {
        box.visible = false;
      } else {
        box.visible = true;
        box.drawForNode(sceneNode);
      }
    } else if (!hideBoundingBox) {
      // If box doesn't exist and we're not hiding, create it
      this.addBoundingBox(sceneNode);
    }
  }

  getBoundingBox(path: string): BoundingBox | null {
    return this.boundingBoxes.get(path) || null;
  }

  // --- Drawing Guide Methods ---
  // ... (start/update/finish drawing guide methods remain largely the same, accepting viewport in update)
  startDrawingGuide(
    type:
      | "rectangle"
      | "ellipse"
      | "frame"
      | "marquee"
      | "text"
      | "sticky_note",
    startX: number,
    startY: number,
  ) {
    this.finishDrawingGuide(); // Clear any previous guide
    this.drawingGuideType = type;
    this.drawingGuideStartX = startX;
    this.drawingGuideStartY = startY;
    this.drawingGuideShape = new Graphics();
    this.drawingGuideShape.label = "temp-drawing-shape";
    this.mainContainer.addChild(this.drawingGuideShape); // Add directly for overlay
  }

  updateDrawingGuide(
    currentX: number,
    currentY: number,
    shiftKey: boolean = false,
    altKey: boolean = false,
  ) {
    // Pass viewport
    if (!this.drawingGuideShape) return;

    const shape = this.drawingGuideShape;
    shape.clear();

    let startX = Math.min(currentX, this.drawingGuideStartX);
    let startY = Math.min(currentY, this.drawingGuideStartY);
    let endX = Math.max(currentX, this.drawingGuideStartX);
    let endY = Math.max(currentY, this.drawingGuideStartY);

    let dx = endX - startX;
    let dy = endY - startY;

    if (shiftKey) {
      const signX = Math.sign(dx) || 1;
      const signY = Math.sign(dy) || 1;
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      dx = size * signX;
      dy = size * signY;
    }

    if (altKey) {
      startX = this.drawingGuideStartX - dx;
      startY = this.drawingGuideStartY - dy;
      endX = this.drawingGuideStartX + dx;
      endY = this.drawingGuideStartY + dy;
    } else {
      endX = startX + dx;
      endY = startY + dy;
    }

    const screenStart = this.sceneManager.camera.toScreen(startX, startY);
    const screenEnd = this.sceneManager.camera.toScreen(endX, endY);

    const screenWidth = Math.abs(screenEnd.x - screenStart.x);
    const screenHeight = Math.abs(screenEnd.y - screenStart.y);

    // Use world coordinates for drawing guide
    shape.stroke({
      width: BASE_STROKE_WIDTH,
      color: COLORS.LIGHT_BLUE,
      alpha: 1.0,
    });

    if (
      this.drawingGuideType === "rectangle" ||
      this.drawingGuideType === "marquee" ||
      this.drawingGuideType === "frame" ||
      this.drawingGuideType === "text" ||
      this.drawingGuideType === "sticky_note"
    ) {
      shape.rect(screenStart.x, screenStart.y, screenWidth, screenHeight);
    } else if (this.drawingGuideType === "ellipse") {
      // For ellipse, PIXI.Graphics draws from center. We want to draw from corner.
      const centerX = screenStart.x + screenWidth / 2;
      const centerY = screenStart.y + screenHeight / 2;
      const radiusX = Math.abs(screenWidth / 2);
      const radiusY = Math.abs(screenHeight / 2);
      shape.ellipse(centerX, centerY, radiusX, radiusY);
    }

    shape.stroke();
  }

  finishDrawingGuide() {
    if (this.drawingGuideShape) {
      this.mainContainer.removeChild(this.drawingGuideShape);
      this.drawingGuideShape.destroy();
      this.drawingGuideShape = null;
    }
    this.drawingGuideType = null;
    this.drawingGuideStartX = 0;
    this.drawingGuideStartY = 0;
  }

  // Method to redraw all currently visible guides based on viewport state
  public redrawVisibleGuides(): void {
    // Redraw visible bounding boxes
    this.boundingBoxes.forEach((box, path) => {
      if (box.visible) {
        const node = this.sceneManager.scenegraph.getNodeByPath(path); // Use public getNodeByPath
        if (node) {
          box.drawForNode(node);
        } else {
          logger.warn(
            `Could not find node with ID ${path} to redraw bounding box`,
          );
          this.removeBoundingBox(path); // Remove box if node is gone
        }
      }
    });

    // Drawing guide is also transient and managed by the drawing tool.
    // No need to redraw it here.
  }

  removeBoundingBox(path: string) {
    const box = this.boundingBoxes.get(path);
    if (box) {
      this.boundingBoxesContainer.removeChild(box);
      box.destroy();
    }
    this.boundingBoxes.delete(path);
  }

  removeAllBoundingBoxes() {
    this.boundingBoxes.forEach((box) => {
      this.boundingBoxesContainer.removeChild(box);
      box.destroy();
    });
    this.boundingBoxes.clear();
  }

  // Multi Select Bounding Box Methods - Accept viewport and screen rect
  setMultiSelectBoundingBox(worldBounds: ReadOnlyBounds) {
    if (!this.multiSelectBoundingBox) {
      this.multiSelectBoundingBox = new BoundingBox(this.sceneManager);
      this.boundingBoxesContainer.addChild(this.multiSelectBoundingBox);
    } else {
      this.multiSelectBoundingBox.visible = true;
    }
    // TODO: Ensure BoundingBox.drawFromRect handles worldBounds correctly.
    // It might need conversion to the GuidesGraph local space.
    // For now, assume it draws based on the provided world rectangle values.
    this.multiSelectBoundingBox.drawFromWorldRect(worldBounds);
  }

  hideMultiSelectBoundingBox() {
    if (this.multiSelectBoundingBox) {
      this.multiSelectBoundingBox.visible = false;
    }
  }

  hideAllBoundingBoxes() {
    this.boundingBoxesContainer.visible = false;
  }

  showAllBoundingBoxes() {
    this.boundingBoxesContainer.visible = true;
  }

  removeMultiSelectBoundingBox() {
    if (this.multiSelectBoundingBox) {
      this.boundingBoxesContainer.removeChild(this.multiSelectBoundingBox);
      this.multiSelectBoundingBox.destroy();
      this.multiSelectBoundingBox = null;
    }
  }

  public getActiveBoundingBox(): BoundingBox | null {
    if (this.multiSelectBoundingBox?.visible) {
      return this.multiSelectBoundingBox;
    }
    let singleVisibleBox: BoundingBox | null = null;
    let visibleCount = 0;
    for (const box of this.boundingBoxes.values()) {
      if (box.visible) {
        visibleCount++;
        singleVisibleBox = box;
      }
    }
    return visibleCount === 1 ? singleVisibleBox : null;
  }

  clear() {
    this.removeAllBoundingBoxes(); // This now also clears axisAlignedOutlineHighlights
    this.removeMultiSelectBoundingBox();
    this.removeAllGuideObjects();
    this.finishDrawingGuide();
    this.clearTempConnection();
  }

  /**
   * Updates guides for a single selected node.
   * Draws the standard oriented bounding box.
   */
  updateSingleNodeGuides(node: SceneNode, hideHighlight: boolean = false) {
    // Clear previous bounding boxes and axis-aligned outlines ONLY
    this.removeAllBoundingBoxes();
    this.removeMultiSelectBoundingBox();
    // Keep other highlights (hover, snap candidates) if needed - controlled elsewhere or by clear(true)

    if (!node) return;

    // --- Always draw the primary bounding box oriented with the node ---
    this.updateBoundingBox(node); // This calls BoundingBox.drawForNode
  }

  /**
   * Updates guides (multi-select bounding box and highlights) for multiple selected nodes.
   * Uses an axis-aligned bounding box for the multi-select guide.
   */
  updateMultiNodeGuides(
    nodes: SceneNode[],
    combinedWorldBounds: ReadOnlyBounds | null,
  ) {
    this.clear(); // Clear previous guides
    if (!nodes || nodes.length === 0) return;

    if (combinedWorldBounds) {
      // Use the provided axis-aligned combined bounds for the multi-select box
      this.setMultiSelectBoundingBox(combinedWorldBounds);
    }
  }

  disableInteractions() {
    this.mainContainer.eventMode = "none";
  }

  enableInteractions() {
    this.mainContainer.eventMode = "passive";
  }
}
