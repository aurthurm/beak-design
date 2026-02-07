import type { Canvas } from "@highagency/pencil-skia";
import { Point } from "pixi.js";
import { FillType } from "../canvas/fill";
import { type NodeProperties, SceneGraph } from "../canvas/scene-graph";
import type { SceneNode } from "../canvas/scene-node";
import { getContrastingFillColor } from "../color";
import { createNodeProperties } from "../managers/file-manager";
import type { SceneManager } from "../managers/scene-manager";
import { hexToColor, Skia } from "../skia";
import type { SkiaRenderer } from "../skia-renderer";
import { COLORS } from "../utils/constants";
import * as math from "../utils/math";
import { DrawingState } from "./drawing-state";
import type { InteractionState } from "./interaction-state";
import { MarqueeSelectingState } from "./marquee-selecting-state";
import { MovingState } from "./moving-state";
import { TextToolState } from "./text-tool-state";

const DRAG_THRESHOLD = 5;

export class IdleState implements InteractionState {
  sceneManager: SceneManager;

  private dragStartPoint: Point | null = null; // Store initial mousedown point
  private didMovePastThreshold: boolean = false; // Flag if drag threshold exceeded

  private nodeUnderCursor: SceneNode | null = null;
  private selectionBoundingBoxUnderCursor: boolean = false;

  private didMouseDown: boolean = false;

  // NOTE(sedivy): Whether to select the node under the cursor on mouse up.
  private selectNodeOnMouseUp: boolean = false;

  // NOTE(sedivy): The node that was under the cursor on mouse down.
  private mouseDownNode?: SceneNode = undefined;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  onEnter(): void {
    this.sceneManager.didDrag = false;
    this.dragStartPoint = null;
    this.didMovePastThreshold = false;
    this.sceneManager.setCursor("default");
    this.selectionBoundingBoxUnderCursor = false;
    this.didMouseDown = false;
    this.mouseDownNode = undefined;
  }

  onExit(): void {
    this.dragStartPoint = null;
    this.didMovePastThreshold = false;
    this.selectionBoundingBoxUnderCursor = false;
    this.didMouseDown = false;
    this.mouseDownNode = undefined;
  }

  onPointerDown(event: MouseEvent): void {
    if (event.button !== 0 || !this.sceneManager.input) {
      return;
    }

    this.didMouseDown = true;
    this.selectNodeOnMouseUp = true;

    const sm = this.sceneManager;
    const screenPoint = this.sceneManager.input.mouse.canvas;
    const worldPoint = this.sceneManager.input.worldMouse;

    sm.didDrag = false;
    this.didMovePastThreshold = false;
    this.selectionBoundingBoxUnderCursor = false;
    this.mouseDownNode = undefined;

    const activeTool = sm.getActiveTool();

    if (activeTool === "sticky_note") {
      const parent =
        sm.selectionManager.findFrameForPosition(
          worldPoint.x,
          worldPoint.y,
          undefined,
          undefined,
        ) ?? sm.scenegraph.getViewportNode();

      const localPosition = parent.toLocal(worldPoint.x, worldPoint.y);

      const width = 250;
      const height = 219;

      const newNodeProps: Partial<NodeProperties> = {
        x: localPosition.x - width / 2, // Center the note on the cursor
        y: localPosition.y - height / 2,
        width: width,
        height: height,
      };

      const block = sm.scenegraph.beginUpdate();

      const newNode = sm.scenegraph.createAndInsertNode(
        block,
        undefined,
        "note",
        createNodeProperties("note", newNodeProps),
        parent,
      );

      sm.scenegraph.commitBlock(block, { undo: true });

      sm.setActiveTool("move");
      sm.textEditorManager.startTextEditing(newNode);

      return;
    }

    if (activeTool === "icon_font") {
      const parent =
        sm.selectionManager.findFrameForPosition(
          worldPoint.x,
          worldPoint.y,
          undefined,
          undefined,
        ) ?? sm.scenegraph.getViewportNode();

      const localPosition = parent.toLocal(worldPoint.x, worldPoint.y);

      const size = 24;

      const pixel = sm.skiaRenderer.readPixel(screenPoint.x, screenPoint.y);
      const fillColor = pixel ? getContrastingFillColor(pixel) : "#000000";

      const newNodeProps: Partial<NodeProperties> = {
        x: localPosition.x - size / 2, // Center the icon on the cursor
        y: localPosition.y - size / 2,
        width: size,
        height: size,
        iconFontName: "heart",
        iconFontFamily: "lucide",
        fills: [
          {
            type: FillType.Color,
            enabled: true,
            color: fillColor,
          },
        ],
      };

      const block = sm.scenegraph.beginUpdate();

      const newNode = sm.scenegraph.createAndInsertNode(
        block,
        SceneGraph.createUniqueID(),
        "icon_font",
        createNodeProperties("icon_font", newNodeProps),
        parent,
      );

      sm.scenegraph.commitBlock(block, { undo: true });

      sm.selectionManager.selectNode(newNode);
      sm.setActiveTool("move");

      return;
    }

    if (activeTool === "text") {
      sm.stateManager.transitionTo(new TextToolState(sm, worldPoint));
      return;
    }

    if (
      activeTool === "rectangle" ||
      activeTool === "ellipse" ||
      activeTool === "frame"
    ) {
      sm.stateManager.transitionTo(
        new DrawingState(sm, activeTool, worldPoint),
      );
      return;
    }

    // NOTE(sedivy): Correctly handling the interactions required for mouse
    // picking, hover, dragging, and double click is very tricky. Some things
    // happen on mouse down, some things happen on mouse up if nothing was
    // dragged. The behavior is different if you click on the selection bounding
    // box or outside or if the item is selected or not.
    //
    // Here are some cases.
    //   1. no selection, click on node => select on mouse down
    //   2. multi-selection, click on selected node => clear and select node on mouse up
    //   4. multi-selection, click on nothing outside => clear selection on mouse down
    //   3. multi-selection, click on non-selected node outside the bounding box => clear and select on mouse down
    //   4. multi-selection, click inside the bounding box, but not on any node => clear selection on mouse up
    //   5. multi-selection, click on a selected node with SHIFT => remove that specific node selection on mouse up
    //   6. multi-selection, click on a non-selected node with SHIFT => add to selection on mouse down
    //   7. multi-selection, click on a non-selected node inside the bounding box => clear and select on mouse up
    //
    // Basically we want to defer any action until mouseup if it happened
    // inside the selection bounding box. If it's outside the bounding box
    // we can do the action immediately on mousedown.
    if (activeTool === "move") {
      // NOTE(sedivy): Update double click.
      const now = Date.now();
      const timeSinceLastClick = now - sm.selectionManager.getLastClickTime();
      const doubleClick =
        timeSinceLastClick < sm.selectionManager.getDoubleClickThreshold();
      sm.selectionManager.setLastClickTime(now);

      this.updateIntersection(event);

      // NOTE(sedivy): Don't change the selection when clicking on an interactive
      // view. We want to allow the users to select a set of nodes and then click
      // on buttons on interactive elements.
      if (this.nodeUnderCursor) {
        const view = this.nodeUnderCursor.getViewAtPoint(
          worldPoint.x,
          worldPoint.y,
        );
        if (view?.isInteractive()) {
          this.mouseDownNode = this.nodeUnderCursor;
          this.selectNodeOnMouseUp = false;
          this.dragStartPoint = new Point(screenPoint.x, screenPoint.y);
          return;
        }
      }

      // NOTE(sedivy): Clicked on a non-selected node that's outside
      // the selection bounding box. Select the node and record the
      // position to start dragging on mouse move.
      if (!this.selectionBoundingBoxUnderCursor) {
        if (
          this.nodeUnderCursor &&
          !sm.selectionManager.isInTheSelectionTree(this.nodeUnderCursor)
        ) {
          sm.selectionManager.selectNode(this.nodeUnderCursor, event.shiftKey);
          this.selectNodeOnMouseUp = false;
          this.dragStartPoint = new Point(screenPoint.x, screenPoint.y);
          return;
        }
      }

      // NOTE(sedivy): Click outside the selection bounding box on nothing.
      // Clear the selection immediately and start marquee.
      if (!this.selectionBoundingBoxUnderCursor && !this.nodeUnderCursor) {
        if (!event.shiftKey) {
          sm.selectionManager.clearSelection();
        }

        sm.stateManager.transitionTo(
          new MarqueeSelectingState(sm, screenPoint, event.shiftKey),
        );
        return;
      }

      // NOTE(sedivy): Double clicked on a node. Enter isolation.
      if (doubleClick && this.nodeUnderCursor) {
        if (
          this.nodeUnderCursor.type === "text" ||
          this.nodeUnderCursor.type === "note" ||
          this.nodeUnderCursor.type === "prompt" ||
          this.nodeUnderCursor.type === "context"
        ) {
          sm.textEditorManager.startTextEditing(this.nodeUnderCursor);
        }

        // NOTE(sedivy): Double clicking on a group/frame should select the child
        // inside the group and not the container.
        if (
          this.nodeUnderCursor.type === "group" ||
          this.nodeUnderCursor.type === "frame"
        ) {
          const child = sm.selectionManager.findNodeAtPosition(
            screenPoint.x,
            screenPoint.y,
            false,
            undefined,
            this.nodeUnderCursor,
          );

          if (child) {
            this.nodeUnderCursor = child;
            sm.selectionManager.selectNode(child);
            this.selectNodeOnMouseUp = false;
          }
        }

        return;
      }

      // NOTE(sedivy): Record the current position so inside mouse move we can
      // determine if we are dragging or just doing a mouse up without movement.
      this.dragStartPoint = new Point(screenPoint.x, screenPoint.y);
    }
  }

  private updateIntersection(event: MouseEvent) {
    if (!this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;
    const shouldDirectSelect = event.ctrlKey || event.metaKey;
    const screenPoint = this.sceneManager.input.mouse.canvas;
    const worldPoint = this.sceneManager.input.worldMouse;

    this.selectionBoundingBoxUnderCursor = false;

    const parents = new Set<SceneNode>();

    for (const node of this.sceneManager.selectionManager.selectedNodes) {
      for (
        let parent = node.parent;
        parent && !parent.root;
        parent = parent.parent
      ) {
        if (parents.has(parent)) {
          break;
        }

        parents.add(parent);
      }
    }

    // NOTE(sedivy): Find node under the cursor.
    this.nodeUnderCursor = sm.selectionManager.findNodeAtPosition(
      screenPoint.x,
      screenPoint.y,
      shouldDirectSelect,
      parents,
    );

    if (this.nodeUnderCursor) {
      const cursor = this.nodeUnderCursor.handleCursorForView(
        worldPoint.x,
        worldPoint.y,
      );
      if (cursor) {
        sm.setCursor(cursor);
      }
    }

    // NOTE(sedivy): Check intersection with the selection bounding box.
    if (!shouldDirectSelect) {
      const selectedNodesBounds = sm.selectionManager.getWorldspaceBounds();
      if (selectedNodesBounds?.containsPoint(worldPoint.x, worldPoint.y)) {
        this.selectionBoundingBoxUnderCursor = true;
      }
    }
  }

  onPointerMove(event: MouseEvent): void {
    if (!this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;
    const screenPoint = this.sceneManager.input.mouse.canvas;

    this.updateIntersection(event);

    // NOTE(sedivy): Start MovingState if we move part the dragging threshold.
    if (this.dragStartPoint && this.didMouseDown) {
      if (
        !this.didMovePastThreshold &&
        math.distance2(screenPoint, this.dragStartPoint) >
          DRAG_THRESHOLD * DRAG_THRESHOLD
      ) {
        // NOTE(sedivy): If we mouse down on a node without selecting it, we
        // should select it the moment we start to drag. This is used for nodes
        // with a custom view (sticky notes) which prevents mouse down selection
        // when clicking on interactive elements.
        if (
          this.mouseDownNode &&
          !this.sceneManager.selectionManager.isInTheSelectionTree(
            this.mouseDownNode,
          )
        ) {
          this.sceneManager.selectionManager.selectNode(
            this.mouseDownNode,
            event.shiftKey,
          );
        }

        this.didMovePastThreshold = true;
        sm.didDrag = true;

        sm.stateManager.transitionTo(new MovingState(sm));
      }
    }
  }

  onPointerUp(event: MouseEvent): void {
    if (!this.didMouseDown || !this.sceneManager.input) {
      return;
    }

    const sm = this.sceneManager;

    this.updateIntersection(event);

    const worldPoint = this.sceneManager.input.worldMouse;

    // NOTE(sedivy): We mouse down on a node, did not move, and the did a mouse up. Select the node.
    if (
      this.selectNodeOnMouseUp &&
      !this.didMovePastThreshold &&
      this.nodeUnderCursor
    ) {
      sm.selectionManager.selectNode(this.nodeUnderCursor, event.shiftKey);
    }

    let handled = false;

    if (!handled && this.nodeUnderCursor) {
      if (
        this.nodeUnderCursor.handleViewClick(event, worldPoint.x, worldPoint.y)
      ) {
        handled = true;
      }
    }

    // NOTE(sedivy): We mouse down on empty space, did not move, and did a mouse up. Clear the selection.
    if (!handled && !this.didMovePastThreshold && !this.nodeUnderCursor) {
      sm.selectionManager.clearSelection();
      handled = true;
    }

    this.dragStartPoint = null;
    this.didMovePastThreshold = false;
    sm.didDrag = false;
  }

  render(renderer: SkiaRenderer, canvas: Canvas) {
    const node = this.nodeUnderCursor;
    if (node && !node.destroyed) {
      const zoom = this.sceneManager.camera.zoom;

      // NOTE(sedivy): Render a dashed bounding box for every layout child
      if (node.hasLayout()) {
        const thickness = 1 / zoom;

        canvas.save();
        canvas.concat(node.getWorldMatrix().toArray());

        const paint = new Skia.Paint();
        paint.setStyle(Skia.PaintStyle.Stroke);
        paint.setColor(COLORS.LIGHT_BLUE);
        paint.setStrokeWidth(thickness);
        paint.setAntiAlias(true);

        const effect = Skia.PathEffect.MakeDash([1.5, 1.5]);
        paint.setPathEffect(effect);

        for (const child of node.children) {
          if (!child.properties.resolved.enabled) {
            continue;
          }

          const bounds = child.getTransformedLocalBounds();

          canvas.drawRect4f(
            bounds.minX - thickness / 2,
            bounds.minY - thickness / 2,
            bounds.maxX + thickness / 2,
            bounds.maxY + thickness / 2,
            paint,
          );
        }

        paint.delete();
        effect.delete();
        canvas.restore();
      }

      renderer.renderNodeOutline(node, 2 / zoom);
    }

    if (
      this.sceneManager.activeTool === "sticky_note" &&
      this.sceneManager.input
    ) {
      const worldPoint = this.sceneManager.input.worldMouse;

      const width = 250;
      const height = 219;

      const paint = new Skia.Paint();
      paint.setStyle(Skia.PaintStyle.Fill);
      paint.setColor(hexToColor("#FFF7E5cc"));
      paint.setAntiAlias(true);

      const rect = Skia.RRectXY(
        Skia.XYWHRect(
          worldPoint.x - width / 2,
          worldPoint.y - height / 2,
          width,
          height,
        ),
        8,
        8,
      );

      canvas.drawRRect(rect, paint);

      paint.setStyle(Skia.PaintStyle.Stroke);
      paint.setColor(hexToColor("#8B6311cc"));
      canvas.drawRRect(rect, paint);

      paint.delete();
    }

    if (
      this.sceneManager.activeTool === "icon_font" &&
      this.sceneManager.input
    ) {
      const worldPoint = this.sceneManager.input.worldMouse;

      const size = 24;

      const paint = new Skia.Paint();

      const rect = Skia.XYWHRect(
        worldPoint.x - size / 2,
        worldPoint.y - size / 2,
        size,
        size,
      );

      paint.setStyle(Skia.PaintStyle.Stroke);
      paint.setColor(COLORS.LIGHT_BLUE);
      paint.setStrokeWidth(0);
      canvas.drawRect(rect, paint);

      paint.delete();
    }
  }

  onKeyDown(): void {}
  onKeyUp(): void {}

  onToolChange(): void {}
}
