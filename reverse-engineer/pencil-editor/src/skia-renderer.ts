import { logger } from "@ha/shared";
import type {
  Blender,
  Canvas,
  Paint,
  Path,
  RuntimeEffect,
  Surface,
} from "@highagency/pencil-skia";
import { Matrix } from "pixi.js";
import {
  type Fill,
  FillType,
  type MeshGradientPoint,
  StretchMode,
} from "./canvas/fill";
import { ShapeNode } from "./canvas/nodes/shape-node";
import { TextNode } from "./canvas/nodes/text-node";
import type { SceneNode } from "./canvas/scene-node";
import type { SceneManager } from "./managers/scene-manager";
import { SkiaFontManager } from "./managers/skia-font-manager";
import type { Resolved } from "./managers/variable-manager";
import { createGradientShader } from "./renderer/gradient";
import { generateMeshGradientVertices } from "./renderer/mesh-gradient";
import {
  convertBlendModeToSkia,
  hexToColor,
  roundedRectangleSkia,
  Skia,
} from "./skia";
import type { PencilCanvas } from "./types";
import { Bounds, type ReadOnlyBounds } from "./utils/bounds";
import { COLORS } from "./utils/constants";
import { clamp, easeOutCubic, easeOvershoot, lerp, remap } from "./utils/math";

export type GeneratingEffect = {
  node: SceneNode;
};

type Flash = {
  x: number;
  y: number;
  width: number;
  height: number;

  longHold: boolean;
  color: [number, number, number];
  strokeWidth: number;
  scanLine: boolean;

  startTime: number;
};

type FlashOptions = {
  color?: [number, number, number];
  strokeWidth?: number;
  longHold?: boolean;
  scanLine?: boolean;
};

export class SkiaRenderer {
  public fontManager: SkiaFontManager;
  public contentRenderedAtZoom: number | null = null;

  private colorContrastOverlay: Blender | undefined = undefined;
  private checkerBoardEffect: RuntimeEffect | undefined = undefined;
  private hatchEffect: RuntimeEffect | undefined = undefined;

  private canvas: PencilCanvas;
  private canvasDPI: number = 0;
  private surfaceCanvas!: Canvas;
  private surface!: Surface;
  private sceneManager: SceneManager;
  private flashes: Flash[] = [];
  private generatingEffects: GeneratingEffect[] = [];
  private contentSurface!: Surface;
  private contentCanvas!: Canvas;
  private contentRenderPadding: number = 512;
  private contentNeedsRedraw: boolean = true;
  private contentInvCameraTransform: Matrix = new Matrix();
  private contentRenderedBounds: Bounds | null = null;

  constructor(sceneManager: SceneManager, canvas: PencilCanvas) {
    this.sceneManager = sceneManager;
    this.canvasDPI = sceneManager.dpi;
    this.canvas = canvas;

    this.canvas.on("context-restored", () => {
      this.resize();
    });

    this.fontManager = new SkiaFontManager(() => {
      for (const node of sceneManager.scenegraph.getNodes()) {
        node.onPropertyChanged("fontFamily");
      }

      sceneManager.skiaRenderer.invalidateContent();
      sceneManager.selectionManager.updateMultiSelectGuides();
    }, true);

    this.colorContrastOverlay = Skia.RuntimeEffect.MakeForBlender(`
      half getLuminance(half3 linear) {
        return dot(linear, half3(0.2126, 0.7152, 0.0722));
      }

      // half getContrastRatio(half a, half b) {
      //   half lighter = max(a, b);
      //   half darker = min(a, b);
      //   return (lighter + 0.05) / (darker + 0.05);
      // }

      half4 main(half4 src, half4 dst) {
        half luminance = getLuminance(toLinearSrgb(dst.rgb));

        // NOTE(sedivy): We want to find the contrast against white and
        // black to select the overlay color. Normally we have to do
        // this calculation below, but because it's a constant at the end
        // we can just use pre-calculated value 0.1791287847.
        //
        // half blackContrast = getContrastRatio(luminance, 0.0);
        // half whiteContrast = getContrastRatio(luminance, 1.0);
        // blackContrast > whiteContrast

        half3 outputColor = luminance > 0.1791287847 ?
          mix(half3(0), dst.rgb, 0.93) :
          mix(half3(1), dst.rgb, 0.85);

        return half4(outputColor, 1);
      }
    `)?.makeBlender([]);

    this.checkerBoardEffect =
      Skia.RuntimeEffect.Make(`
      uniform float2 scale;
      uniform half4 color1;
      uniform half4 color2;

      half4 main(float2 coord) {
        float2 cell = floor(coord / scale);
        float checker = mod(cell.x + cell.y, 2.0);
        return checker < 0.5 ? color1 : color2;
      }
    `) ?? undefined;

    this.hatchEffect =
      Skia.RuntimeEffect.Make(`
      #version 300

      uniform float ratio;
      uniform half4 color1;
      uniform half4 color2;

      inline float smoothbump(float a, float b, float x) {
        return smoothstep(a, b, abs(x));
      }

      half4 main(float2 coord) {
        float bump = fract(coord.x) * 2.0 - 1.0;
        float pixel = fwidth(coord.x * 2.0);
        return mix(color1, color2, smoothbump(ratio - 0.5 * pixel, ratio + 0.5 * pixel, bump));
      }
    `) ?? undefined;
  }

  destroy() {
    this.canvas.destroy();

    this.colorContrastOverlay?.delete();

    if (this.surface) {
      this.surface.delete();
    }

    if (this.contentSurface) {
      this.contentSurface.delete();
    }

    this.fontManager.destroy();

    // TODO(sedivy): Destroy all skia resources
  }

  readPixel(x: number, y: number): Uint8Array {
    const pixels = this.surfaceCanvas.readPixels(
      Math.floor(x * this.sceneManager.dpi),
      Math.floor(y * this.sceneManager.dpi),
      {
        width: 1,
        height: 1,
        colorType: Skia.ColorType.RGBA_8888,
        alphaType: Skia.AlphaType.Premul,
        colorSpace: Skia.ColorSpace.SRGB,
      },
    );

    return pixels as Uint8Array;
  }

  resize() {
    const width = Math.floor(
      this.sceneManager.camera.screenWidth * this.sceneManager.dpi,
    );
    const height = Math.floor(
      this.sceneManager.camera.screenHeight * this.sceneManager.dpi,
    );

    // NOTE(sedivy): Don't recreate the entire canvas when the new size is
    // smaller than the current canvas size. This is mainly here because
    // every time the selection changes we hide/show the properties panel
    // which will resize the canvas.
    if (
      this.canvasDPI === this.sceneManager.dpi &&
      this.canvas.initialized &&
      width <= this.canvas.width &&
      height <= this.canvas.height
    ) {
      // NOTE(sedivy): Force a redraw so there is no flicker during resize.
      this.render();
      return;
    }

    this.canvasDPI = this.sceneManager.dpi;
    this.canvas.resize(
      width,
      height,
      this.sceneManager.camera.screenWidth,
      this.sceneManager.camera.screenHeight,
    );

    if (this.surface) {
      this.surface.delete();
    }

    if (this.contentSurface) {
      this.contentSurface.delete();
    }

    const surface = this.canvas.createSurface();
    if (!surface) {
      throw new Error("Unable to create a sufrace from skia.");
    }
    this.surface = surface;

    const info = surface.imageInfo();
    this.contentSurface = surface.makeSurface({
      ...surface.imageInfo(),
      width: info.width + this.contentRenderPadding * 2,
      height: info.height + this.contentRenderPadding * 2,
    });
    this.contentCanvas = this.contentSurface.getCanvas();
    this.contentRenderedAtZoom = null;

    this.contentNeedsRedraw = true;

    this.surfaceCanvas = surface.getCanvas();

    // NOTE(sedivy): Force a redraw so there is no flicker during resize.
    this.render();
  }

  setActive(active: boolean) {
    this.canvas.setActive(active);
    this.resize();
  }

  redrawContentIfNeeded() {
    if (this.contentRenderedAtZoom != null) {
      // NOTE(sedivy): Request a content redraw if the we zoomed in 3x from the last render.
      if (this.sceneManager.camera.zoom > this.contentRenderedAtZoom * 3) {
        this.contentNeedsRedraw = true;
      }

      // NOTE(sedivy): If the camera is outside the last rendered bounds we need
      // to invalidate the rendered content.
      if (
        this.contentRenderedBounds &&
        !this.contentRenderedBounds.includes(this.sceneManager.camera.bounds)
      ) {
        const documentBounds =
          this.sceneManager.scenegraph.getDocumentBoundingBox();

        // NOTE(sedivy): We don't need to request a redraw if the last rendered
        // bounds is larger than the entire document because we know there is
        // nothing outside.
        if (
          documentBounds &&
          !this.contentRenderedBounds.includes(documentBounds)
        ) {
          this.contentNeedsRedraw = true;
        }
      }
    }

    if (this.contentNeedsRedraw) {
      this.contentNeedsRedraw = false;

      this.contentInvCameraTransform.copyFrom(
        this.sceneManager.camera.worldTransform,
      );
      this.contentInvCameraTransform.invert();
      this.contentRenderedAtZoom = this.sceneManager.camera.zoom;

      this.contentRenderedBounds = this.sceneManager.camera.bounds.clone();
      this.contentRenderedBounds.inflate(
        this.contentRenderPadding /
          (this.sceneManager.camera.zoom * this.sceneManager.dpi),
      );

      // NOTE(sedivy): Make sure layout is up-to-date before rendering.
      this.sceneManager.scenegraph.updateLayout();

      const canvas = this.contentCanvas;
      canvas.clear([0, 0, 0, 0]);

      canvas.save();
      canvas.translate(this.contentRenderPadding, this.contentRenderPadding);

      canvas.scale(this.sceneManager.dpi, this.sceneManager.dpi);
      canvas.concat(this.sceneManager.camera.worldTransform.toArray());

      const root = this.sceneManager.scenegraph.getViewportNode();
      for (const child of root.children) {
        child.renderSkia(this, canvas, this.contentRenderedBounds);
      }

      canvas.restore();
    }
  }

  async exportToPNG(
    nodes: SceneNode[],
    options: { dpi: number; maxResolution: number } = {
      dpi: 2,
      maxResolution: 4096,
    },
  ): Promise<Uint8Array> {
    if (this.canvas.isContextLost) {
      throw new Error("Unable to export because the context is lost.");
    }

    const bounds = new Bounds();

    for (const node of nodes) {
      if (!node.properties.resolved.enabled) {
        continue;
      }

      bounds.unionBounds(node.getVisualWorldBounds());
    }

    if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
      throw new Error("Export bounding box is invalid.");
    }

    let width = Math.ceil(bounds.width * options.dpi);
    let height = Math.ceil(bounds.height * options.dpi);
    if (width === 0 || height === 0) {
      throw new Error("Export bounds has zero size.");
    }

    let canvasScale = options.dpi;

    if (width > options.maxResolution || height > options.maxResolution) {
      const scale = options.maxResolution / Math.max(width, height);
      width = Math.ceil(width * scale);
      height = Math.ceil(height * scale);
      canvasScale *= scale;
    }

    const surface = this.surface.makeSurface({
      colorType: Skia.ColorType.RGBA_8888,
      alphaType: Skia.AlphaType.Premul,
      colorSpace: Skia.ColorSpace.SRGB, // TODO(sedivy): Make color space configurable.
      width: width,
      height: height,
    });

    const canvas = surface.getCanvas();
    canvas.clear([0, 0, 0, 0]);

    canvas.save();
    canvas.scale(canvasScale, canvasScale);
    canvas.translate(-bounds.minX, -bounds.minY);

    for (const node of nodes) {
      canvas.save();

      const parent = node.parent;
      if (parent && !parent.root) {
        canvas.concat(parent.getWorldMatrix().toArray());
      }

      node.renderSkia(this, canvas, bounds);

      canvas.restore();
    }

    canvas.restore();

    surface.flush();

    const image = surface.makeImageSnapshot();

    // TODO(sedivy): Convert to PNG in a WebWorker.
    const data = image.encodeToBytes(Skia.ImageFormat.PNG); // TODO(sedivy): Make format configurable.

    image.delete();
    surface.delete();

    if (!data) {
      throw new Error("Unable to encode the image during export.");
    }

    return data;
  }

  displayContentCanvas() {
    this.redrawContentIfNeeded();

    if (this.contentRenderedAtZoom != null) {
      const canvas = this.surfaceCanvas;

      canvas.save();

      canvas.concat(this.contentInvCameraTransform.toArray());

      canvas.scale(1 / this.sceneManager.dpi, 1 / this.sceneManager.dpi);

      const snapshot = this.contentSurface.makeImageSnapshot();
      if (this.contentRenderedAtZoom !== this.sceneManager.camera.zoom) {
        canvas.drawImageCubic(
          snapshot,
          -this.contentRenderPadding,
          -this.contentRenderPadding,
          0.3,
          0.3,
        );
      } else {
        canvas.drawImage(
          snapshot,
          -this.contentRenderPadding,
          -this.contentRenderPadding,
        );
      }
      snapshot.delete();
      canvas.restore();
    }
  }

  invalidateContent() {
    this.contentNeedsRedraw = true;
    this.sceneManager.requestFrame();
  }

  render() {
    if (this.canvas.isContextLost) {
      return;
    }

    const canvas = this.surfaceCanvas;

    canvas.clear(this.sceneManager.getBackgroundColor());

    canvas.save();
    canvas.scale(this.sceneManager.dpi, this.sceneManager.dpi);

    canvas.save();
    canvas.concat(this.sceneManager.camera.worldTransform.toArray());

    this.displayContentCanvas();
    this.renderPixelGrid();

    this.sceneManager.render(this, canvas);

    if (this.sceneManager.config.data.generatingEffectEnabled) {
      this.renderGeneratingEffects();
    }
    this.renderFlashes();

    canvas.restore();

    this.renderScrollbars();

    canvas.restore();

    this.surface.flush();
  }

  // TODO(sedivy): Possibly merge it into the flash effects and reuse the same transitions.
  renderGeneratingEffects() {
    if (!this.generatingEffects.length) {
      return;
    }

    const camera = this.sceneManager.camera;

    for (const effect of this.generatingEffects) {
      const node = effect.node;

      if (camera.overlapsBounds(node.getVisualWorldBounds()) !== true) {
        continue;
      }

      const canvas = this.sceneManager.skiaRenderer.surfaceCanvas;

      const bounds = node.getWorldBounds();
      canvas.save();

      const zoom = camera.zoom;

      const rect = roundedRectangleSkia(
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        [5 / zoom, 5 / zoom, 5 / zoom, 5 / zoom],
      );

      canvas.save();
      canvas.clipRRect(rect, Skia.ClipOp.Intersect, false);

      {
        const size = Math.max(bounds.width, bounds.height);
        const radius = size * 0.4;
        const distance = size * 0.5;

        const imageBlur = Skia.ImageFilter.MakeBlur(
          size * 0.2,
          size * 0.2,
          Skia.TileMode.Clamp,
          null,
        );

        const paintCircleBlur = new Skia.Paint();
        paintCircleBlur.setImageFilter(imageBlur);
        canvas.saveLayer(paintCircleBlur, [
          camera.bounds.minX,
          camera.bounds.minY,
          camera.bounds.maxX,
          camera.bounds.maxY,
        ]);

        const paintCircleFill = new Skia.Paint();
        paintCircleFill.setStyle(Skia.PaintStyle.Fill);
        paintCircleFill.setColorComponents(96 / 255, 125 / 255, 255 / 255, 0.5);

        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        const angle = this.sceneManager.currentTime / 2000;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        canvas.drawCircle(
          centerX + dirX * distance,
          centerY + dirY * distance,
          radius,
          paintCircleFill,
        );

        canvas.drawCircle(
          centerX - dirX * distance,
          centerY - dirY * distance,
          radius,
          paintCircleFill,
        );

        paintCircleFill.delete();
        imageBlur.delete();
        paintCircleBlur.delete();

        canvas.restore();
      }

      canvas.restore();

      const stroke = new Skia.Paint();
      stroke.setAntiAlias(true);
      stroke.setColorComponents(96 / 255, 125 / 255, 255 / 255, 1);
      stroke.setStyle(Skia.PaintStyle.Stroke);
      stroke.setStrokeWidth(2 / zoom);
      stroke.setStrokeJoin(Skia.StrokeJoin.Round);
      stroke.setStrokeCap(Skia.StrokeCap.Round);
      canvas.drawRRect(rect, stroke);
      stroke.delete();

      canvas.restore();
    }

    this.sceneManager.requestFrame();
  }

  renderFlashes() {
    if (!this.flashes.length) {
      return;
    }

    const canvas = this.surfaceCanvas;

    const zoom = this.sceneManager.camera.zoom;

    const paint = new Skia.Paint();
    paint.setStyle(Skia.PaintStyle.Stroke);
    paint.setStrokeJoin(Skia.StrokeJoin.Round);
    paint.setAntiAlias(true);

    const gradientPaint = new Skia.Paint();
    gradientPaint.setStyle(Skia.PaintStyle.Fill);
    gradientPaint.setAlphaf(0.5);

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const flash = this.flashes[i];

      const attackTime = 0.2;
      const holdTime = flash.longHold ? 1.5 : 0.4;
      const releaseTime = 0.3;

      const scanStart = 0.04;

      const scanTime = flash.longHold
        ? clamp(0.3, flash.height / 350, 2.0)
        : 0.3;

      const r = flash.color[0];
      const g = flash.color[1];
      const b = flash.color[2];

      let opacity = 1;
      let scale = 1;

      const time = (this.sceneManager.currentTime - flash.startTime) / 1000;

      if (time < 0) {
        // wait
        continue;
      } else if (time < attackTime) {
        // attack
        const t = clamp(0, time / attackTime, 1);

        const ease = easeOvershoot(t, 2);

        scale = remap(ease, 0, 1, 1, 0);

        opacity = ease;
      } else if (time < attackTime + holdTime) {
        // hold
        opacity = 1;
        scale = 0;
      } else if (time < attackTime + holdTime + releaseTime) {
        // release
        const t = clamp(0, (time - (attackTime + holdTime)) / releaseTime, 1);

        scale = remap(easeOutCubic(t), 0, 1, 0, 0.1);
        opacity = 1 - easeOutCubic(t);
      } else {
        this.flashes.splice(i, 1);

        continue;
      }

      const padding = 5 + (30 * scale) / zoom;

      const width = Math.max(0, flash.width + padding);
      const height = Math.max(0, flash.height + padding);
      const x = flash.x + (flash.width - width) / 2;
      const y = flash.y + (flash.height - height) / 2;

      const radius = Math.min(flash.width, flash.height) < 20 ? 0 : 3;

      const rect = new Float32Array([
        x, // left
        y, // top
        x + width, // right
        y + height, // bottom

        radius,
        radius,
        radius,
        radius,
        radius,
        radius,
        radius,
        radius,
      ]);

      paint.setStyle(Skia.PaintStyle.Stroke);
      paint.setStrokeWidth(flash.strokeWidth / zoom);
      paint.setColorComponents(r, g, b, opacity);

      canvas.drawRRect(rect, paint);

      if (flash.scanLine) {
        if (time > scanStart) {
          const lineTransition = clamp(
            0,
            ((time - scanStart) / scanTime) % (flash.longHold ? 1.5 : 3),
            1,
          );
          const boxHeight = height;

          const position = lerp(
            -boxHeight / 2,
            height + boxHeight / 2,
            lineTransition,
          );

          const top = y + position - boxHeight / 2;
          const bottom = y + position + boxHeight / 2;

          const gradientShader = Skia.Shader.MakeLinearGradient(
            [0, top],
            [0, bottom],
            new Float32Array([0, 0, 0, 0, r, g, b, 0.4 * opacity]),
            null,
            Skia.TileMode.Repeat,
            undefined,
            1,
          );
          if (gradientShader) {
            gradientPaint.setShader(gradientShader);
            gradientShader.delete();
          } else {
            logger.error(
              "Unable to create gradient shader for flash effect with values:",
              {
                top,
                bottom,

                r,
                g,
                b,
                opacity,
              },
            );
            continue;
          }

          canvas.save();
          canvas.clipRRect(rect, Skia.ClipOp.Intersect, false);

          canvas.drawRect4f(x, top, x + width, bottom, gradientPaint);

          canvas.restore();
        }
      }
    }

    paint.delete();
    gradientPaint.delete();

    this.sceneManager.requestFrame();
  }

  addGeneratingEffect(node: SceneNode): GeneratingEffect {
    const effect: GeneratingEffect = {
      node: node,
    };

    this.generatingEffects.push(effect);

    return effect;
  }

  removeGeneratingEffect(effect: GeneratingEffect) {
    const index = this.generatingEffects.indexOf(effect);
    if (index !== -1) {
      this.generatingEffects.splice(index, 1);
    }
  }

  addFlash(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: FlashOptions,
  ) {
    this.flashes.push({
      x: x,
      y: y,
      width: width,
      height: height,
      startTime: performance.now() + Math.random() * 50,
      color: options?.color ?? [96 / 255, 125 / 255, 255 / 255],
      longHold: options?.longHold ?? false,
      strokeWidth: options?.strokeWidth ?? 2,
      scanLine: options?.scanLine ?? true,
    });

    this.sceneManager.requestFrame();
  }

  addFlashForNode(node: SceneNode, options?: FlashOptions) {
    if (node.root) {
      return;
    }

    const bounds = node.getWorldBounds();
    if (bounds.width <= 1 || bounds.height <= 1) {
      return;
    }

    this.addFlash(bounds.x, bounds.y, bounds.width, bounds.height, options);
  }

  renderPixelGrid() {
    if (
      this.sceneManager.camera.zoom > 4 &&
      this.colorContrastOverlay != null &&
      this.sceneManager.config.data.showPixelGrid
    ) {
      const bounds = this.sceneManager.camera.bounds;

      const left = bounds.left;
      const top = bounds.top;
      const right = bounds.right;
      const bottom = bounds.bottom;

      const columnStart = Math.floor(left);
      const columnEnd = Math.floor(right);

      const rowStart = Math.floor(top);
      const rowEnd = Math.floor(bottom);

      // NOTE(sedivy): Create the lattice grid with a path. Other approach would
      // be to render a full-screen quad and do this in a shader. I measured
      // performance of this path approach and it's not even showing up in the
      // cpu and gpu timings. We can switch it to a shader based approach if we
      // encounter any issues.
      const builder = new Skia.PathBuilder();

      for (let y = rowStart + 1; y <= rowEnd; y++) {
        builder.moveTo(left, y);
        builder.lineTo(right, y);
      }

      for (let x = columnStart + 1; x <= columnEnd; x++) {
        builder.moveTo(x, top);
        builder.lineTo(x, bottom);
      }

      const path = builder.detachAndDelete();

      const canvas = this.surfaceCanvas;

      const paint = new Skia.Paint();
      paint.setStyle(Skia.PaintStyle.Stroke);
      paint.setStrokeWidth(0); // NOTE(sedivy): Use Skia's hairline rendering.
      paint.setBlender(this.colorContrastOverlay);
      canvas.drawPath(path, paint);
      path.delete();
      paint.delete();
    }
  }

  renderScrollbars() {
    const canvas = this.surfaceCanvas;

    const scrollbarThickness = 4;
    const scrollbarPadding = 3;
    const endPadding = 15;
    const fillColor =
      this.sceneManager.colorScheme === "dark"
        ? [24 / 255, 24 / 255, 24 / 255, 1]
        : [0, 0, 0, 0.5];
    const strokeColor =
      this.sceneManager.colorScheme === "dark"
        ? [90 / 255, 90 / 255, 90 / 255, 1]
        : [1, 1, 1, 0.5];

    const scrollbarCornerRadius = 3;

    const fill = new Skia.Paint();
    fill.setStyle(Skia.PaintStyle.Fill);
    fill.setColor(fillColor);

    const stroke = new Skia.Paint();
    stroke.setStyle(Skia.PaintStyle.Stroke);
    stroke.setColor(strokeColor);
    stroke.setStrokeWidth(1);
    stroke.setAntiAlias(true);

    const documentBounds =
      this.sceneManager.scenegraph.getDocumentBoundingBox();
    if (documentBounds) {
      const cameraBounds = this.sceneManager.camera.bounds;

      const window = [
        this.sceneManager.camera.screenWidth,
        this.sceneManager.camera.screenHeight,
      ];

      // Horizontal scrollbar
      if (
        cameraBounds.left >= documentBounds.left ||
        cameraBounds.right <= documentBounds.right
      ) {
        const scrollbarX = calculateScrollbarRatio(
          cameraBounds,
          documentBounds,
          0,
        );

        const start = scrollbarX[0] * window[0] + endPadding;
        const end = scrollbarX[1] * window[0] - endPadding;
        const size = Math.max(0.0, end - start); // TODO: Handle minimum size correctly

        canvas.drawRRect(
          Skia.RRectXY(
            Skia.XYWHRect(
              start,
              window[1] - (scrollbarThickness + scrollbarPadding),
              size,
              scrollbarThickness,
            ),
            scrollbarCornerRadius,
            scrollbarCornerRadius,
          ),
          stroke,
        );

        canvas.drawRRect(
          Skia.RRectXY(
            Skia.XYWHRect(
              start,
              window[1] - (scrollbarThickness + scrollbarPadding),
              size,
              scrollbarThickness,
            ),
            scrollbarCornerRadius,
            scrollbarCornerRadius,
          ),
          fill,
        );
      }

      // Vertical scrollbar
      if (
        cameraBounds.top >= documentBounds.top ||
        cameraBounds.bottom <= documentBounds.bottom
      ) {
        const scrollbarY = calculateScrollbarRatio(
          cameraBounds,
          documentBounds,
          1,
        );

        const start = scrollbarY[0] * window[1] + endPadding;
        const end = scrollbarY[1] * window[1] - endPadding;
        const size = Math.max(0.0, end - start); // TODO: Handle minimum size correctly

        canvas.drawRRect(
          Skia.RRectXY(
            Skia.XYWHRect(
              window[0] - (scrollbarThickness + scrollbarPadding),
              start,
              scrollbarThickness,
              size,
            ),
            scrollbarCornerRadius,
            scrollbarCornerRadius,
          ),
          stroke,
        );

        canvas.drawRRect(
          Skia.RRectXY(
            Skia.XYWHRect(
              window[0] - (scrollbarThickness + scrollbarPadding),
              start,
              scrollbarThickness,
              size,
            ),
            scrollbarCornerRadius,
            scrollbarCornerRadius,
          ),
          fill,
        );
      }
    }

    fill.delete();
    stroke.delete();
  }

  renderFills(
    canvas: Canvas,
    path: Path,
    fills: ReadonlyArray<Readonly<Resolved<Fill>>> | undefined,
    width: number,
    height: number,
  ) {
    if (!fills) {
      return;
    }

    for (const fill of fills) {
      if (!fill.enabled) continue;

      const paint = new Skia.Paint();
      paint.setAntiAlias(true);

      if (fill.blendMode) {
        paint.setBlendMode(convertBlendModeToSkia(fill.blendMode));
      }

      const type = fill.type;
      switch (type) {
        case FillType.Color: {
          paint.setColor(hexToColor(fill.color));
          canvas.drawPath(path, paint);
          break;
        }

        case FillType.RadialGradient:
        case FillType.AngularGradient:
        case FillType.LinearGradient: {
          const gradient = createGradientShader(fill, width, height);
          if (!gradient) {
            break;
          }

          paint.setShader(gradient);
          paint.setDither(true);
          paint.setAlphaf(fill.opacityPercent / 100);
          gradient.delete();

          canvas.drawPath(path, paint);

          break;
        }

        case FillType.MeshGradient: {
          canvas.save();
          canvas.clipPath(path, Skia.ClipOp.Intersect, true);
          paint.setAlphaf(fill.opacityPercent / 100);
          this.renderMeshGradient(
            paint,
            canvas,
            width,
            height,
            fill.columns,
            fill.rows,
            fill.points,
          );
          canvas.restore();

          break;
        }

        case FillType.Image: {
          const asset = this.sceneManager.assetManager.getAsset(fill.url);

          const state = asset.state;
          switch (state.status) {
            case "loaded": {
              const matrix = new Matrix();

              const assetWidth = state.decodedImage.width();
              const assetHeight = state.decodedImage.height();

              const scaleX = width / assetWidth;
              const scaleY = height / assetHeight;

              const mode = fill.mode;
              switch (mode) {
                case StretchMode.Stretch: {
                  matrix.scale(scaleX, scaleY);
                  break;
                }

                case StretchMode.Fill:
                case StretchMode.Fit: {
                  const scale =
                    mode === StretchMode.Fill
                      ? Math.max(scaleX, scaleY)
                      : Math.min(scaleX, scaleY);

                  const scaledWidth = assetWidth * scale;
                  const scaledHeight = assetHeight * scale;
                  const offsetX = (width - scaledWidth) / 2;
                  const offsetY = (height - scaledHeight) / 2;
                  matrix.scale(scale, scale);
                  matrix.translate(offsetX, offsetY);
                  break;
                }

                default: {
                  const missing: never = mode;
                  logger.error(
                    "Missing stretch mode in Skia renderer:",
                    missing,
                  );
                  break;
                }
              }

              const shader = state.decodedImage.makeShaderOptions(
                Skia.TileMode.Decal,
                Skia.TileMode.Decal,
                Skia.FilterMode.Linear,
                Skia.MipmapMode.Linear,
                matrix.toArray(),
              );

              paint.setAlphaf(fill.opacityPercent / 100);
              paint.setShader(shader);

              shader.delete();

              canvas.drawPath(path, paint);
              break;
            }

            case "error": {
              if (this.checkerBoardEffect) {
                const shader = this.checkerBoardEffect.makeShader([
                  // size
                  8, 8,
                  // color1
                  1.0, 1.0, 1.0, 1.0,
                  // color2
                  0.0, 0.0, 0.0, 1.0,
                ]);
                paint.setAlphaf(0.1);
                paint.setShader(shader);
                shader.delete();

                canvas.drawPath(path, paint);

                // NOTE(sedivy): Render an outline.
                canvas.save();
                canvas.clipPath(path, Skia.ClipOp.Intersect, true);
                paint.setShader(null);
                paint.setAlphaf(1.0);
                paint.setColorComponents(128 / 255, 128 / 255, 128 / 255, 1);
                paint.setStyle(Skia.PaintStyle.Stroke);
                paint.setStrokeWidth(2);
                canvas.drawPath(path, paint);
                canvas.restore();
              }

              break;
            }

            case "loading":
            case "init": {
              break;
            }

            default: {
              const missing: never = state;
              logger.warn("Missing asset status in Skia renderer:", missing);
              break;
            }
          }
          break;
        }

        default: {
          const missing: never = type;
          logger.debug("Missing fill type in Skia renderer:", missing);
        }
      }

      paint.delete();
    }
  }

  renderNodeOutline(node: SceneNode, thickness: number) {
    // TODO(sedivy): We should never call these functions with destroyed
    // nodes, but in in order to do that we need to change how we store selected
    // nodes and handle hover
    if (node.destroyed || node.root) {
      return;
    }

    const hexColor = node.reusable
      ? COLORS.MAGENTA
      : node.prototype
        ? COLORS.PURPLE
        : COLORS.LIGHT_BLUE;

    const canvas = this.surfaceCanvas;

    canvas.save();
    canvas.concat(node.getWorldMatrix().toArray());

    const paint = new Skia.Paint();
    paint.setStyle(Skia.PaintStyle.Stroke);
    paint.setColor(hexColor);
    paint.setStrokeWidth(thickness);
    paint.setAntiAlias(true);

    if (node.isInstanceBoundary) {
      const zoom = this.sceneManager.camera.zoom;
      const dashSize = 4 / zoom;
      const dashGap = 2 / zoom;
      const effect = Skia.PathEffect.MakeDash([dashSize, dashGap]);
      if (effect) {
        paint.setPathEffect(effect);
        effect.delete();
      }

      const bounds = node.localBounds();

      canvas.drawRect4f(
        bounds.minX - thickness / 2,
        bounds.minY - thickness / 2,
        bounds.maxX + thickness / 2,
        bounds.maxY + thickness / 2,
        paint,
      );
    } else if (node instanceof TextNode && !node.isTextHidden) {
      const position = node.getParagraphPosition(this);
      const paragraph = node.getParagraph(this);

      const lines = paragraph.getLineMetrics();

      for (const line of lines) {
        canvas.drawLine(
          position[0] + line.left,
          position[1] + Math.round(line.ascent),
          position[0] + line.left + line.width,
          position[1] + Math.round(line.ascent),
          paint,
        );

        position[1] += line.height;
      }
    } else if (node instanceof ShapeNode) {
      canvas.drawPath(node.getFillPath().path, paint);
    } else {
      const bounds = node.localBounds();

      canvas.drawRect4f(
        bounds.minX - thickness / 2,
        bounds.minY - thickness / 2,
        bounds.maxX + thickness / 2,
        bounds.maxY + thickness / 2,
        paint,
      );
    }

    paint.delete();

    canvas.restore();
  }

  renderSlot(canvas: Canvas, path: Path, instance: boolean) {
    // TODO(zaza): make this independent of the global zoom level,
    // because this is not correct for off-screen rendering like PNG export.
    const zoom = this.sceneManager.camera.zoom;

    const color = instance ? COLORS.PURPLE : COLORS.MAGENTA;

    if (this.hatchEffect) {
      const paint = new Skia.Paint();
      paint.setAntiAlias(true);

      if (zoom > 0.2) {
        const shader = this.hatchEffect.makeShader(
          [
            // ratio
            0.2,
            // color1
            ...color,
            // color2
            0.0,
            0.0,
            0.0,
            0.0,
          ],
          Skia.Matrix.multiply(
            Skia.Matrix.rotated((135 * Math.PI) / 180),
            Skia.Matrix.scaled(5, 5),
          ),
        );
        paint.setShader(shader);
        shader.delete();
        canvas.drawPath(path, paint);
      } else {
        paint.setColor(color.toSpliced(3, 1, 0.2));
        canvas.drawPath(path, paint);
      }

      paint.setStyle(Skia.PaintStyle.Stroke);
      paint.setShader(null);
      paint.setColor(color);
      paint.setStrokeWidth(1.0);
      canvas.drawPath(path, paint);
      paint.delete();
    }
  }

  renderMeshGradient(
    paint: Paint,
    canvas: Canvas,
    width: number,
    height: number,
    columns: number,
    rows: number,
    meshData: Resolved<MeshGradientPoint[]>,
  ) {
    // TODO(sedivy): Cache the generated mesh and only regenerate when
    // the parameters change.
    const geometry = generateMeshGradientVertices(
      32,
      width,
      height,
      columns,
      rows,
      meshData,
    );
    if (geometry) {
      canvas.drawVertices(geometry, Skia.BlendMode.Dst, paint);
      geometry.delete();
    }
  }

  async waitForAllAssets() {
    // TODO(sedivy): Right now we don't have a good way to pre-load all
    // the assets before we render the document. So now we need to do
    // this dirty throw away render to queue up the async tasks to wait
    // for them for the real export.
    await this.exportToPNG(
      this.sceneManager.scenegraph.getViewportNode().children,
      {
        dpi: 1,
        maxResolution: 10,
      },
    );

    await this.fontManager.waitForAllFontsLoaded();
    await this.sceneManager.assetManager.waitForAllAssetsLoaded();
  }
}

function calculateScrollbarRatio(
  cameraBounds: ReadOnlyBounds,
  documentBounds: ReadOnlyBounds,
  axis: number,
): [number, number] {
  const cameraMin = axis === 0 ? cameraBounds.left : cameraBounds.top;
  const cameraMax = axis === 0 ? cameraBounds.right : cameraBounds.bottom;
  const documentMin = axis === 0 ? documentBounds.left : documentBounds.top;
  const documentMax = axis === 0 ? documentBounds.right : documentBounds.bottom;
  const documentSize = documentMax - documentMin;
  const cameraSize = cameraMax - cameraMin;

  let start = remap(cameraMin, documentMin, documentMax, 0, 1.0);
  let end = remap(cameraMax, documentMin, documentMax, 0, 1.0);

  if (cameraMax > documentMax) {
    let overflow = (cameraMax - documentMax) / documentSize;
    overflow = 1.0 / (1.0 + overflow);
    start = remap(
      documentMax - cameraSize * overflow,
      documentMin,
      documentMax,
      0,
      1.0,
    );
    end = 1.0;
  }

  if (cameraMin < documentMin) {
    let overflow = (documentMin - cameraMin) / documentSize;
    overflow = 1.0 / (1.0 + overflow);
    start = 0.0;
    end = remap(
      documentMin + cameraSize * overflow,
      documentMin,
      documentMax,
      0,
      1.0,
    );
  }

  return [clamp(0.0, start, 1.0), clamp(0.0, end, 1.0)];
}
