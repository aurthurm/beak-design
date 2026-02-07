import type * as Schema from "@ha/schema";
import { logger } from "@ha/shared";
import type {
  BlendMode,
  CanvasKit,
  FontSlant,
  FontWeight,
  Path,
  PathBuilder,
  RRect,
  StrokeCap,
  StrokeJoin,
  TextAlign,
} from "@highagency/pencil-skia";
import CanvasKitInit from "@highagency/pencil-skia";
import type { NodeProperties } from "./canvas/scene-graph";
import type { CanvasKitConfig } from "./types";

export function colorToCss(color: number[]): string {
  const r = Math.round(color[0] * 255);
  const g = Math.round(color[1] * 255);
  const b = Math.round(color[2] * 255);
  const a = color[3];

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function hexColorEquals(a: string, b: string): boolean {
  return hexToUint32(a) === hexToUint32(b);
}

export function colorToHex(
  color: readonly [number, number, number, number] | Float32Array,
): string {
  return uint32ColorToHex(
    uint32ColorFromComponents(
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
      Math.round(color[3] * 255),
    ),
  );
}

export function uint32ColorToHex(color: number): string {
  const r = (color & 0xff000000) >>> 24;
  const g = (color & 0x00ff0000) >>> 16;
  const b = (color & 0x0000ff00) >>> 8;
  const a = (color & 0x000000ff) >>> 0;

  if (a === 255) {
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${a.toString(16).padStart(2, "0")}`;
}

export function canonicalizeHexColor(color: string) {
  return uint32ColorToHex(hexToUint32(color));
}

export function uint32ColorFromComponents(
  r: number,
  g: number,
  b: number,
  a: number,
): number {
  return ((r << 24) | (g << 16) | (b << 8) | (a << 0)) >>> 0;
}

export function hexToUint32(hex: string): number {
  if (hex[0] === "#") hex = hex.slice(1);

  if (hex.length === 3) {
    const r = parseInt(hex[0], 16) * 0x11;
    const g = parseInt(hex[1], 16) * 0x11;
    const b = parseInt(hex[2], 16) * 0x11;

    return uint32ColorFromComponents(r, g, b, 255);
  }

  if (hex.length === 6) {
    const num = parseInt(hex, 16);

    const b = (num >>> 0) & 0xff;
    const g = (num >>> 8) & 0xff;
    const r = (num >>> 16) & 0xff;

    return uint32ColorFromComponents(r, g, b, 255);
  }

  if (hex.length === 8) {
    const num = parseInt(hex, 16);

    const a = (num >>> 0) & 0xff;
    const b = (num >>> 8) & 0xff;
    const g = (num >>> 16) & 0xff;
    const r = (num >>> 24) & 0xff;

    return uint32ColorFromComponents(r, g, b, a);
  }

  return 0;
}

export function hexToColor(hex: string): [number, number, number, number] {
  if (hex[0] === "#") hex = hex.slice(1);

  if (hex.length === 3) {
    const r = parseInt(hex[0], 16) * 17;
    const g = parseInt(hex[1], 16) * 17;
    const b = parseInt(hex[2], 16) * 17;

    return [r / 255, g / 255, b / 255, 1];
  }

  if (hex.length === 6) {
    const num = parseInt(hex, 16);

    const b = (num >>> 0) & 0xff;
    const g = (num >>> 8) & 0xff;
    const r = (num >>> 16) & 0xff;

    return [r / 255, g / 255, b / 255, 1];
  }

  if (hex.length === 8) {
    const num = parseInt(hex, 16);

    const a = (num >>> 0) & 0xff;
    const b = (num >>> 8) & 0xff;
    const g = (num >>> 16) & 0xff;
    const r = (num >>> 24) & 0xff;

    return [r / 255, g / 255, b / 255, a / 255];
  }

  // TODO(sedivy): Should we report this somewhere?
  return [0, 0, 0, 0];
}

export function convertTextAlignToSkia(
  value: NodeProperties["textAlign"],
): TextAlign {
  switch (value) {
    case "left":
      return Skia.TextAlign.Left;
    case "center":
      return Skia.TextAlign.Center;
    case "right":
      return Skia.TextAlign.Right;
    case "justify":
      return Skia.TextAlign.Justify;
  }

  return Skia.TextAlign.Left;
}

export function convertLineJoinToSkia(
  value: NodeProperties["lineJoin"],
): StrokeCap {
  switch (value) {
    case "miter":
      return Skia.StrokeJoin.Miter;
    case "bevel":
      return Skia.StrokeJoin.Bevel;
    case "round":
      return Skia.StrokeJoin.Round;
  }

  return Skia.StrokeJoin.Miter;
}

export function convertLineCapToSkia(
  value: NodeProperties["lineCap"],
): StrokeJoin {
  switch (value) {
    case "none":
      return Skia.StrokeCap.Butt;
    case "square":
      return Skia.StrokeCap.Square;
    case "round":
      return Skia.StrokeCap.Round;
  }

  return Skia.StrokeCap.Butt;
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight#common_weight_name_mapping
export function convertFontWeightToSkiaEnum(
  weight: string | undefined,
): FontWeight {
  switch (weight) {
    case "normal":
      return Skia.FontWeight.Normal;
    case "bold":
      return Skia.FontWeight.Bold;

    case "100":
      return Skia.FontWeight.Thin;
    case "200":
      return Skia.FontWeight.ExtraLight;
    case "300":
      return Skia.FontWeight.Light;
    case "400":
      return Skia.FontWeight.Normal;
    case "500":
      return Skia.FontWeight.Medium;
    case "600":
      return Skia.FontWeight.SemiBold;
    case "700":
      return Skia.FontWeight.Bold;
    case "800":
      return Skia.FontWeight.ExtraBold;
    case "900":
      return Skia.FontWeight.Black;
    case "950":
      return Skia.FontWeight.ExtraBlack;
  }

  return Skia.FontWeight.Normal;
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight#common_weight_name_mapping
export function convertFontWeightToSkiaVariation(
  weight: string | undefined,
): number {
  switch (weight) {
    case "normal":
      return 400;
    case "bold":
      return 700;

    case "100":
      return 100;
    case "200":
      return 200;
    case "300":
      return 300;
    case "400":
      return 400;
    case "500":
      return 500;
    case "600":
      return 600;
    case "700":
      return 700;
    case "800":
      return 800;
    case "900":
      return 900;
    case "950":
      return 950;
  }

  return 400;
}

export function convertFontStyleToSkiaEnum(
  style: string | undefined,
): FontSlant {
  switch (style) {
    case "normal":
      return Skia.FontSlant.Upright;
    case "italic":
      return Skia.FontSlant.Italic;
  }

  return Skia.FontSlant.Upright;
}

export function convertFontStyleToSkiaSlantVariation(
  style: string | undefined,
): number {
  switch (style) {
    case "normal":
      return 0;
    case "italic":
      return 1;
  }

  return 0;
}

export function convertBlendModeToSkia(mode: Schema.BlendMode): BlendMode {
  switch (mode) {
    case "normal":
      return Skia.BlendMode.SrcOver;
    case "darken":
      return Skia.BlendMode.Darken;
    case "multiply":
      return Skia.BlendMode.Multiply;
    case "linearBurn":
      // TODO(sedivy): Skia does not have linear burn. Implement it with a custom blend shader.
      return Skia.BlendMode.Multiply;
    case "colorBurn":
      return Skia.BlendMode.ColorBurn;
    case "light":
      return Skia.BlendMode.Lighten;
    case "screen":
      return Skia.BlendMode.Screen;
    case "linearDodge":
      return Skia.BlendMode.Plus;
    case "colorDodge":
      return Skia.BlendMode.ColorDodge;
    case "overlay":
      return Skia.BlendMode.Overlay;
    case "softLight":
      return Skia.BlendMode.SoftLight;
    case "hardLight":
      return Skia.BlendMode.HardLight;
    case "difference":
      return Skia.BlendMode.Difference;
    case "exclusion":
      return Skia.BlendMode.Exclusion;
    case "hue":
      return Skia.BlendMode.Hue;
    case "saturation":
      return Skia.BlendMode.Saturation;
    case "color":
      return Skia.BlendMode.Color;
    case "luminosity":
      return Skia.BlendMode.Luminosity;
    default: {
      const missing: never = mode;
      logger.error(`Unsupported blend mode: ${missing}`);
      return Skia.BlendMode.SrcOver;
    }
  }
}

// https://www.w3.org/TR/css-backgrounds-3/#corner-overlap
// Let f = min(Li/Si), where i ∈ {top, right, bottom, left},
// Si is the sum of the two corresponding radii of the corners on side i,
// and Ltop = Lbottom = the width of the box, and Lleft = Lright = the height of the box.
// If f < 1, then all corner radii are reduced by multiplying them by f.
export function normalizeCornerRadius(
  width: number,
  height: number,
  radii: readonly [number, number, number, number],
): readonly [number, number, number, number] {
  const [topLeft, topRight, bottomRight, bottomLeft] = radii;

  const sTop = topLeft + topRight;
  const sRight = topRight + bottomRight;
  const sBottom = bottomRight + bottomLeft;
  const sLeft = bottomLeft + topLeft;

  const fTop = sTop > 0 ? width / sTop : Infinity;
  const fRight = sRight > 0 ? height / sRight : Infinity;
  const fBottom = sBottom > 0 ? width / sBottom : Infinity;
  const fLeft = sLeft > 0 ? height / sLeft : Infinity;

  const f = Math.min(fTop, fRight, fBottom, fLeft);
  if (f < 1) {
    return [topLeft * f, topRight * f, bottomRight * f, bottomLeft * f];
  }

  return radii;
}

export function addRoundRectangleToPath(
  path: PathBuilder,
  x: number,
  y: number,
  width: number,
  height: number,
  radius?: readonly [number, number, number, number],
) {
  if (
    radius != null &&
    (radius[0] !== 0 || radius[1] !== 0 || radius[2] !== 0 || radius[3] !== 0)
  ) {
    path.addRRect(roundedRectangleSkia(x, y, width, height, radius));
  } else {
    path.addRect(new Float32Array([x, y, x + width, y + height]));
  }
}

export function roundedRectangleSkia(
  x: number,
  y: number,
  width: number,
  height: number,
  radius?: readonly [number, number, number, number],
): RRect {
  if (radius) {
    return new Float32Array([
      x, // left
      y, // top
      x + width, // right
      y + height, // bottom

      // top-left radius (x, y)
      radius[0],
      radius[0],
      // top-right radius (x, y)
      radius[1],
      radius[1],
      // bottom-right radius (x, y)
      radius[2],
      radius[2],
      // bottom-left radius (x, y)
      radius[3],
      radius[3],
    ]);
  }

  return new Float32Array([
    0, // left
    0, // top
    width, // right
    height, // bottom

    // top-left radius (x, y)
    0,
    0,
    // top-right radius (x, y)
    0,
    0,
    // bottom-right radius (x, y)
    0,
    0,
    // bottom-left radius (x, y)
    0,
    0,
  ]);
}

export function convertBlurRadiusToSigma(radius: number) {
  return radius / 2;
}

let Skia: CanvasKit;

export async function loadSkia(config: CanvasKitConfig) {
  Skia = await CanvasKitInit(config);
}

// NOTE(sedivy): Technically the global Skia object is nullable, but that would
// made the entire codebase really hard to use. To make it easier we export a
// non-null Skia object and we make sure we only use if after it was loaded.
export { Skia };
