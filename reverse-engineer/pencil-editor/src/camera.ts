import EventEmitter from "eventemitter3";
import { Matrix, type PointData } from "pixi.js";
import { Bounds, type ReadOnlyBounds } from "./utils/bounds";
import { clamp, safeRatio1 } from "./utils/math";

interface CameraEvents {
  change: () => void;
  zoom: () => void;
}

export class Camera extends EventEmitter<CameraEvents> {
  left: number = 0;
  top: number = 0;
  screenWidth: number = 0;
  screenHeight: number = 0;
  zoom: number = 1;

  pixelPadding: [number, number, number, number] = [0, 0, 0, 0]; // top, right, bottom, left

  private dirty: boolean = true;

  private _bounds: Bounds = new Bounds();
  private _worldTransform: Matrix = new Matrix();

  get width() {
    return this.screenWidth / this.zoom;
  }

  get height() {
    return this.screenHeight / this.zoom;
  }

  get centerX(): number {
    return this.left + this.screenWidth / 2 / this.zoom;
  }

  get centerY(): number {
    return this.top + this.screenHeight / 2 / this.zoom;
  }

  get worldTransform(): Matrix {
    this.refresh();
    return this._worldTransform;
  }

  get bounds(): ReadOnlyBounds {
    this.refresh();
    return this._bounds;
  }

  refresh() {
    if (this.dirty) {
      const l = this.left;
      const t = this.top;
      const r = this.left + this.width;
      const b = this.top + this.height;

      this._bounds.set(l, t, r, b);

      this._worldTransform.set(
        this.zoom,
        0,
        0,
        this.zoom,
        -l * this.zoom,
        -t * this.zoom,
      );

      this.dirty = false;
    }
  }

  toScreen(worldX: number, worldY: number): PointData {
    const screenX = (worldX - this.left) * this.zoom;
    const screenY = (worldY - this.top) * this.zoom;

    return { x: screenX, y: screenY };
  }

  toWorld(screenX: number, screenY: number): PointData {
    const worldX = this.left + screenX / this.zoom;
    const worldY = this.top + screenY / this.zoom;

    return { x: worldX, y: worldY };
  }

  setCenter(x: number, y: number) {
    if (this.centerX === x && this.centerY === y) {
      return;
    }

    const bounds = this.bounds;

    this.left = x - bounds.width / 2;
    this.top = y - bounds.height / 2;

    this.dirty = true;
    this.emit("change");
  }

  setZoom(zoom: number, keepCenter: boolean) {
    zoom = Math.min(256, Math.max(0.02, zoom));

    if (this.zoom === zoom) {
      return;
    }

    const originalCenterX = this.centerX;
    const originalCenterY = this.centerY;

    this.zoom = zoom;
    this.dirty = true;

    if (keepCenter) {
      this.setCenter(originalCenterX, originalCenterY);
    }

    this.emit("change");
    this.emit("zoom");
  }

  setSize(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.dirty = true;
  }

  zoomToBounds(bounds: ReadOnlyBounds, padding: number) {
    const centerX = bounds.centerX;
    const centerY = bounds.centerY;

    const horizontalPadding = this.pixelPadding[3] + this.pixelPadding[1];
    const verticalPadding = this.pixelPadding[0] + this.pixelPadding[2];

    const scaleX = safeRatio1(
      this.screenWidth - padding * 2 - horizontalPadding,
      bounds.width,
    );
    const scaleY = safeRatio1(
      this.screenHeight - padding * 2 - verticalPadding,
      bounds.height,
    );

    const zoom = Math.min(scaleX, scaleY);
    this.setZoom(zoom, false);

    const paddingOffsetX =
      (this.pixelPadding[1] - this.pixelPadding[3]) / 2 / zoom;
    const paddingOffsetY =
      (this.pixelPadding[2] - this.pixelPadding[0]) / 2 / zoom;

    this.setCenter(centerX + paddingOffsetX, centerY + paddingOffsetY);
  }

  zoomTowardsPoint(x: number, y: number, newZoom: number) {
    const cameraMin = 0.02;
    const cameraMax = 256;

    newZoom = clamp(cameraMin, newZoom, cameraMax);

    const screenSpaceX = (x - this.centerX) * this.zoom;
    const screenSpaceY = (y - this.centerY) * this.zoom;

    const newCameraX = x - screenSpaceX / newZoom;
    const newCameraY = y - screenSpaceY / newZoom;

    this.setZoom(newZoom, false);
    this.setCenter(newCameraX, newCameraY);
  }

  translate(deltaX: number, deltaY: number) {
    this.setCenter(this.centerX + deltaX, this.centerY + deltaY);
  }

  overlapsBounds(bounds: ReadOnlyBounds): boolean {
    return bounds.intersects(this.bounds);
  }

  ensureVisible(bounds: ReadOnlyBounds, padding: number = 40) {
    const paddingTop = this.pixelPadding[0] / this.zoom;
    const paddingRight = this.pixelPadding[1] / this.zoom;
    const paddingBottom = this.pixelPadding[2] / this.zoom;
    const paddingLeft = this.pixelPadding[3] / this.zoom;

    const worldPadding = padding / this.zoom;
    const availableWidth =
      this.width - paddingLeft - paddingRight - worldPadding * 2;
    const availableHeight =
      this.height - paddingTop - paddingBottom - worldPadding * 2;

    const fitsInViewport =
      bounds.width <= availableWidth && bounds.height <= availableHeight;

    // NOTE(sedivy): If the bounds fit within the viewport, we try to
    // just pan to make them visible, preserving the current zoom level.
    if (fitsInViewport) {
      const viewLeft = this.left + paddingLeft;
      const viewRight = this.left + this.width - paddingRight;
      const viewTop = this.top + paddingTop;
      const viewBottom = this.top + this.height - paddingBottom;

      let dx = 0;
      let dy = 0;

      if (bounds.x < viewLeft) {
        dx = bounds.x - worldPadding - viewLeft;
      } else if (bounds.x + bounds.width > viewRight) {
        dx = bounds.x + bounds.width + worldPadding - viewRight;
      }

      if (bounds.y < viewTop) {
        dy = bounds.y - worldPadding - viewTop;
      } else if (bounds.y + bounds.height > viewBottom) {
        dy = bounds.y + bounds.height + worldPadding - viewBottom;
      }

      if (dx !== 0 || dy !== 0) {
        this.translate(dx, dy);
      }
    } else {
      // NOTE(sedivy): If the bounds do not fit within the viewport, we
      // zoom to fit the entire bounds.
      this.zoomToBounds(bounds, padding);
    }
  }
}
