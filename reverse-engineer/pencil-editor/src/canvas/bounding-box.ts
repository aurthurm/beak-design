import gsap from "gsap";
import { Container, Graphics, Point, Polygon, Rectangle } from "pixi.js";
import { ConnectingState } from "../interaction-states/connecting-state";
import { CornerRadiusAdjustingState } from "../interaction-states/corner-radius-adjusting-state";
import { ResizingState } from "../interaction-states/resizing-state";
import { RotatingState } from "../interaction-states/rotating-state";
import type { HandleType, SceneManager } from "../managers/scene-manager";
import type { ReadOnlyBounds } from "../utils/bounds";
import { COLORS } from "../utils/constants";
import * as math from "../utils/math";
import { getRotatedIconFor } from "./cursor-generator";
import type { SceneNode } from "./scene-node";

// Constants for desired apparent size on screen
const DESIRED_RADIUS_HANDLE_SIZE = 9;
const DESIRED_RADIUS_HANDLE_OFFSET = 12; // Offset inside the box
const BASE_BUTTON_STROKE_WIDTH = 1.0;

const ROTATION_45 = Math.sin(Math.PI / 4);

export class BoundingBox extends Container {
  private sceneManager: SceneManager;

  constructor(sceneManger: SceneManager) {
    super();
    this.sceneManager = sceneManger;
  }

  // Draws the box outline and handles for a SceneNode
  public drawForNode(node: SceneNode): void {
    const transform = node.getWorldMatrix().clone();
    transform.appendFrom(transform, this.sceneManager.camera.worldTransform);

    const worldRotation = Math.atan2(transform.b, transform.a);
    const scaleX = Math.sqrt(
      transform.a * transform.a + transform.c * transform.c,
    );
    const scaleY = Math.sqrt(
      transform.b * transform.b + transform.d * transform.d,
    );
    const worldScale = Math.min(scaleX, scaleY);

    const worldMatrix = node.getWorldMatrix();
    const bounds = node.localBounds();
    const worldCorners = [
      worldMatrix.apply(new Point(bounds.minX, bounds.minY)),
      worldMatrix.apply(new Point(bounds.maxX, bounds.minY)),
      worldMatrix.apply(new Point(bounds.maxX, bounds.maxY)),
      worldMatrix.apply(new Point(bounds.minX, bounds.maxY)),
    ];

    const cornerRadius: readonly [number, number, number, number] =
      node.type === "rectangle"
        ? (node.properties.resolved.cornerRadius ?? [0, 0, 0, 0])
        : [0, 0, 0, 0];

    this.drawHandles(
      worldCorners,
      node,
      worldRotation,
      cornerRadius,
      worldScale,
      Boolean(node.prototype)
        ? COLORS.PURPLE
        : node.reusable
          ? COLORS.MAGENTA
          : COLORS.LIGHT_BLUE,
    );
  }

  // Draws the box outline and handles from a screen-coordinate rectangle (e.g., multi-select)
  public drawFromWorldRect(worldRect: ReadOnlyBounds): void {
    // Calculate world corners for the axis-aligned rectangle
    const worldCorners = [
      new Point(worldRect.x, worldRect.y), // Top-left
      new Point(worldRect.x + worldRect.width, worldRect.y), // Top-right
      new Point(worldRect.x + worldRect.width, worldRect.y + worldRect.height), // Bottom-right
      new Point(worldRect.x, worldRect.y + worldRect.height), // Bottom-left
    ];

    this.drawHandles(
      worldCorners,
      undefined,
      0,
      [0, 0, 0, 0],
      1.0,
      COLORS.LIGHT_BLUE,
    );
  }

  // Draws the handles relative to the screen coordinates of the box
  private drawHandles(
    worldCorners: Point[],
    node: SceneNode | undefined,
    rotation: number,
    cornerRadius: readonly [number, number, number, number],
    worldScale: number = 1.0,
    sideColor: number[],
  ): void {
    this.removeChildren().forEach((child) => {
      child.destroy();
    });

    // NOTE(sedivy): Only allow interactive controls for the move tool.
    this.eventMode =
      this.sceneManager.getActiveTool() === "move" ? "static" : "none";

    const tl = this.sceneManager.camera.toScreen(
      worldCorners[0].x,
      worldCorners[0].y,
    );
    const tr = this.sceneManager.camera.toScreen(
      worldCorners[1].x,
      worldCorners[1].y,
    );
    const br = this.sceneManager.camera.toScreen(
      worldCorners[2].x,
      worldCorners[2].y,
    );
    const bl = this.sceneManager.camera.toScreen(
      worldCorners[3].x,
      worldCorners[3].y,
    );

    const tm = new Point((tl.x + tr.x) / 2, (tl.y + tr.y) / 2);
    const rm = new Point((tr.x + br.x) / 2, (tr.y + br.y) / 2);
    const bm = new Point((br.x + bl.x) / 2, (br.y + bl.y) / 2);
    const lm = new Point((bl.x + tl.x) / 2, (bl.y + tl.y) / 2);

    const width = math.distance(tl, tr);
    const height = math.distance(tl, bl);

    // NOTE(sedivy): Don't even bother to show resize handles for layers smaller
    // than 10 pixels on the screen. Zoom in or use the properties panel to resize it.
    if (width < 10 && height < 10) {
      return;
    }

    const handleSize = 7;
    const radiusHandleSize = DESIRED_RADIUS_HANDLE_SIZE;

    const sideHandleClickableSize = 8;
    const cornerHitSize = 15;

    const sideLineThickness = 1.5;

    const nodeType = node ? node.type : "group";

    if (
      nodeType !== "note" &&
      nodeType !== "prompt" &&
      nodeType !== "context"
    ) {
      const controls = [
        { pos: tl, dirX: -ROTATION_45, dirY: -ROTATION_45 },
        { pos: tr, dirX: ROTATION_45, dirY: -ROTATION_45 },
        { pos: bl, dirX: -ROTATION_45, dirY: ROTATION_45 },
        { pos: br, dirX: ROTATION_45, dirY: ROTATION_45 },
      ];

      for (let i = 0; i < controls.length; i++) {
        const control = controls[i];

        const handle = new Graphics();
        handle.eventMode = "static";
        handle.position.set(control.pos.x, control.pos.y);
        handle.pivot.set(0, 0);
        handle.rotation = rotation;

        const hitSize = 35;

        handle.hitArea = new Rectangle(
          -hitSize / 2,
          -hitSize / 2,
          hitSize,
          hitSize,
        );

        handle.on("pointerdown", (event) => {
          this.sceneManager.stateManager.transitionTo(
            new RotatingState(
              this.sceneManager,
              event.global,
              control.dirX,
              control.dirY,
              rotation,
            ),
          );
        });

        handle.on("pointerover", () => {
          handle.cursor = getRotatedIconFor(
            "rotate",
            control.dirX,
            control.dirY,
            rotation,
          );
        });

        this.addChild(handle);
      }
    }

    // NOTE(sedivy): Cover the insides of the rectangle *after* we insert the
    // rotation handles to only make them clickable on the outside.
    {
      const fill = new Graphics();
      fill.hitArea = new Polygon([
        tl.x,
        tl.y,
        tr.x,
        tr.y,
        br.x,
        br.y,
        bl.x,
        bl.y,
      ]);
      this.addChild(fill);
    }

    type Control = {
      sideHandle: boolean;
      x: number;
      y: number;
      dirX: number;
      dirY: number;
      hitWidth: number;
      hitHeight: number;
      width: number;
      height: number;
      id: HandleType;
    };

    const controls: Control[] = [
      {
        sideHandle: true,
        x: tm.x,
        y: tm.y,
        dirX: 0,
        dirY: -1,
        hitWidth: width,
        hitHeight: sideHandleClickableSize,
        width: width,
        height: sideLineThickness,
        id: "t",
      },
      {
        sideHandle: true,
        x: bm.x,
        y: bm.y,
        dirX: 0,
        dirY: 1,
        hitWidth: width,
        hitHeight: sideHandleClickableSize,
        width: width,
        height: sideLineThickness,
        id: "b",
      },
      {
        sideHandle: true,
        x: lm.x,
        y: lm.y,
        dirX: -1,
        dirY: 0,
        hitWidth: sideHandleClickableSize,
        hitHeight: height,
        width: sideLineThickness,
        height: height,
        id: "l",
      },
      {
        sideHandle: true,
        x: rm.x,
        y: rm.y,
        dirX: 1,
        dirY: 0,
        hitWidth: sideHandleClickableSize,
        hitHeight: height,
        width: sideLineThickness,
        height: height,
        id: "r",
      },
      {
        sideHandle: false,
        x: tl.x,
        y: tl.y,
        dirX: -ROTATION_45,
        dirY: -ROTATION_45,
        hitWidth: cornerHitSize,
        hitHeight: cornerHitSize,
        width: handleSize,
        height: handleSize,
        id: "tl",
      },
      {
        sideHandle: false,
        x: tr.x,
        y: tr.y,
        dirX: ROTATION_45,
        dirY: -ROTATION_45,
        hitWidth: cornerHitSize,
        hitHeight: cornerHitSize,
        width: handleSize,
        height: handleSize,
        id: "tr",
      },
      {
        sideHandle: false,
        x: bl.x,
        y: bl.y,
        dirX: -ROTATION_45,
        dirY: ROTATION_45,
        hitWidth: cornerHitSize,
        hitHeight: cornerHitSize,
        width: handleSize,
        height: handleSize,
        id: "bl",
      },
      {
        sideHandle: false,
        x: br.x,
        y: br.y,
        dirX: ROTATION_45,
        dirY: ROTATION_45,
        hitWidth: cornerHitSize,
        hitHeight: cornerHitSize,
        width: handleSize,
        height: handleSize,
        id: "br",
      },
    ];

    for (let i = 0; i < controls.length; i++) {
      const control = controls[i];

      const handle = new Graphics();
      handle.label = `handle-${control.id}`;
      handle.eventMode = "static";
      handle.position.set(control.x, control.y);
      handle.pivot.set(0, 0);
      handle.rotation = rotation;

      handle.hitArea = new Rectangle(
        -control.hitWidth / 2,
        -control.hitHeight / 2,
        control.hitWidth,
        control.hitHeight,
      );

      handle.rect(
        -control.width / 2,
        -control.height / 2,
        control.width,
        control.height,
      );

      if (control.sideHandle) {
        if (!node || !node.isInstanceBoundary) {
          handle.fill(sideColor);
        }
      } else {
        handle.fill("#FFFFFF");
        handle.stroke({
          width: BASE_BUTTON_STROKE_WIDTH,
          color: sideColor,
          alpha: 1.0,
          alignment: 0.5,
        });
      }

      handle.on("pointerdown", (event) => {
        const cursor = getRotatedIconFor(
          "resize",
          control.dirX,
          control.dirY,
          rotation,
        );

        this.sceneManager.stateManager.transitionTo(
          new ResizingState(
            this.sceneManager,
            event.global,
            control.id,
            cursor,
          ),
        );
      });

      handle.on("pointerover", () => {
        handle.cursor = getRotatedIconFor(
          "resize",
          control.dirX,
          control.dirY,
          rotation,
        );
      });

      this.addChild(handle);
    }

    // TODO(sedivy): This component needs to handle all 4 corners, but for now
    // just pick the first one so we can refactor the data model
    const fallbackCornerRadius = cornerRadius[0];

    // --- Draw Corner Radius Handles (Only for Rectangles) ---
    if (nodeType === "rectangle" && width > 150 && height > 150) {
      const radiusHandleOffset = DESIRED_RADIUS_HANDLE_OFFSET; // A smaller, fixed base offset from the corner.

      // Use the approximate dimensions of the box to calculate the max possible radius.
      const approxScreenWidth = Math.sqrt(
        (tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2,
      );
      const approxScreenHeight = Math.sqrt(
        (bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2,
      );

      // This is the max radius in WORLD units
      const maxRadiusInWorld =
        Math.min(approxScreenWidth, approxScreenHeight) / 2;

      // Don't draw handles if the box is too small for them to be meaningful.
      if (radiusHandleOffset < maxRadiusInWorld) {
        // Convert property radius to world radius for positioning
        const cornerRadiusInWorld = fallbackCornerRadius * worldScale;

        // Clamp the world-scaled radius to the max possible radius in world coords.
        const clampedRadiusInWorld = Math.min(
          cornerRadiusInWorld,
          maxRadiusInWorld,
        );

        // Interpolate the handle's distance from the corner.
        // When cornerRadius is 0, offset is radiusHandleOffset.
        // When cornerRadius is maxRadius, offset is maxRadius.
        const interpolationFactor =
          maxRadiusInWorld > 0 ? clampedRadiusInWorld / maxRadiusInWorld : 0;
        const totalOffset =
          radiusHandleOffset +
          interpolationFactor * (maxRadiusInWorld - radiusHandleOffset);

        // --- Calculate inward, normalized vectors for each edge ---
        const vec_tl_tr = { x: tr.x - tl.x, y: tr.y - tl.y };
        const vec_tl_bl = { x: bl.x - tl.x, y: bl.y - tl.y };

        const mag_h = Math.sqrt(vec_tl_tr.x ** 2 + vec_tl_tr.y ** 2); // Horizontal magnitude
        const mag_v = Math.sqrt(vec_tl_bl.x ** 2 + vec_tl_bl.y ** 2); // Vertical magnitude

        const norm_h =
          mag_h > 0
            ? { x: vec_tl_tr.x / mag_h, y: vec_tl_tr.y / mag_h }
            : { x: 1, y: 0 };

        const norm_v =
          mag_v > 0
            ? { x: vec_tl_bl.x / mag_v, y: vec_tl_bl.y / mag_v }
            : { x: 0, y: 1 };

        // Calculate handle positions by moving along both adjacent edge vectors.
        const cr_tl_pos = {
          x: tl.x + norm_h.x * totalOffset + norm_v.x * totalOffset,
          y: tl.y + norm_h.y * totalOffset + norm_v.y * totalOffset,
        };
        const cr_tr_pos = {
          x: tr.x - norm_h.x * totalOffset + norm_v.x * totalOffset,
          y: tr.y - norm_h.y * totalOffset + norm_v.y * totalOffset,
        };
        const cr_bl_pos = {
          x: bl.x + norm_h.x * totalOffset - norm_v.x * totalOffset,
          y: bl.y + norm_h.y * totalOffset - norm_v.y * totalOffset,
        };
        const cr_br_pos = {
          x: br.x - norm_h.x * totalOffset - norm_v.x * totalOffset,
          y: br.y - norm_h.y * totalOffset - norm_v.y * totalOffset,
        };

        const radiusPositions: { x: number; y: number; id: HandleType }[] = [
          { x: cr_tl_pos.x, y: cr_tl_pos.y, id: "cr_tl" },
          { x: cr_tr_pos.x, y: cr_tr_pos.y, id: "cr_tr" },
          { x: cr_bl_pos.x, y: cr_bl_pos.y, id: "cr_bl" },
          { x: cr_br_pos.x, y: cr_br_pos.y, id: "cr_br" },
        ];

        radiusPositions.forEach((pos) => {
          const handle = new Graphics();

          function draw(hover: boolean) {
            handle.clear();
            handle.circle(0, 0, radiusHandleSize / 2);
            handle.fill(hover ? sideColor : "#FFFFFF");
            handle.stroke({
              width: BASE_BUTTON_STROKE_WIDTH,
              color: sideColor,
              alpha: 1.0,
            });
          }

          draw(false);

          handle.label = `handle-${pos.id}`;
          handle.eventMode = "static";
          handle.cursor = "default"; // TODO(sedivy): Add a custom cursor icon
          handle.position.set(pos.x, pos.y);
          handle.pivot.set(0, 0);
          handle.rotation = 0;

          handle.on("pointerover", () => {
            draw(true);
          });

          handle.on("pointerout", () => {
            draw(false);
          });

          handle.on("pointerdown", (event) => {
            this.sceneManager.stateManager.transitionTo(
              new CornerRadiusAdjustingState(
                this.sceneManager,
                event.global,
                pos.id,
              ),
            );
          });

          this.addChild(handle);
        });
      }
    }

    // --- Draw Connection Handles ---
    // TODO(sedivy): Improve connectors before enabling this for objects
    if (false) {
      // Also not for sticky notes
      const DESIRED_CONNECTION_HANDLE_OFFSET = 20;

      const connectionPoints: {
        id: "top" | "right" | "bottom" | "left";
        point: Point;
        vec: Point;
      }[] = [
        { id: "top", point: tm, vec: new Point(tm.x - bm.x, tm.y - bm.y) }, // Top
        { id: "right", point: rm, vec: new Point(rm.x - lm.x, rm.y - lm.y) }, // Right
        { id: "bottom", point: bm, vec: new Point(bm.x - tm.x, bm.y - tm.y) }, // Bottom
        { id: "left", point: lm, vec: new Point(lm.x - rm.x, lm.y - rm.y) }, // Left
      ];

      const handleSize = 7;

      connectionPoints.forEach((cp) => {
        const mag = Math.sqrt(cp.vec.x ** 2 + cp.vec.y ** 2);
        if (mag > 0) {
          const normVec = new Point(cp.vec.x / mag, cp.vec.y / mag);

          const handlePos = new Point(
            cp.point.x + normVec.x * DESIRED_CONNECTION_HANDLE_OFFSET,
            cp.point.y + normVec.y * DESIRED_CONNECTION_HANDLE_OFFSET,
          );

          const handle = new Graphics();
          handle.label = `handle-connection-${cp.id}`;
          handle.circle(0, 0, handleSize / 2); // 5px diameter
          handle.fill(sideColor);

          handle.stroke({
            width: BASE_BUTTON_STROKE_WIDTH,
            color: "#FFFFFF",
            alpha: 1.0,
          });

          handle.eventMode = "static";
          handle.cursor = "grab"; // TODO(sedivy): Use a custom cursor icon
          handle.position.set(handlePos.x, handlePos.y);

          handle.on("pointerover", () => {
            gsap.to(handle, {
              pixi: {
                scaleX: 2.0,
                scaleY: 2.0,
              },
              ease: "power3.out",
              duration: 0.07,
            });
          });

          handle.on("pointerout", () => {
            gsap.to(handle, {
              pixi: {
                scaleX: 1.0,
                scaleY: 1.0,
              },
              ease: "power1.in",
              duration: 0.1,
            });
          });

          handle.on("pointerdown", (event) => {
            const selectedNode =
              this.sceneManager.selectionManager.getSingleSelectedNode();

            if (selectedNode) {
              this.sceneManager.stateManager.transitionTo(
                new ConnectingState(this.sceneManager, selectedNode, cp.id),
              );
            }
          });

          this.addChild(handle);
        }
      });
    }

    // NOTE(sedivy): When the size is really small. Cover the insides of the
    // so it's easier to click and drag the element. Otherwise the resize are
    // rotate handles would spill into middle.
    if (width < 25 || height < 25) {
      const fill = new Graphics();
      fill.hitArea = new Polygon([
        tl.x,
        tl.y,
        tr.x,
        tr.y,
        br.x,
        br.y,
        bl.x,
        bl.y,
      ]);
      this.addChild(fill);
    }
  }
}
