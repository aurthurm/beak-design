import type * as Schema from "@ha/schema";
import { Matrix } from "pixi.js";
import { deserializeRotation } from "../managers/file-manager";
import type { Resolved, Value } from "../managers/variable-manager";
import { hexToColor } from "../skia";

export enum FillType {
  Color = 1,
  Image = 2,
  LinearGradient = 3,
  RadialGradient = 4,
  AngularGradient = 5,
  MeshGradient = 6,
}

export enum StretchMode {
  Stretch = 1,
  Fill = 2,
  Fit = 3,
}

export type Fill = ColorFill | ImageFill | GradientFill | MeshGradientFill;

export type ColorFill = {
  type: FillType.Color;
  enabled: Value<"boolean">;
  color: Value<"color">;
  blendMode?: Schema.BlendMode;
};

export type ColorStop = {
  position: Value<"number">;
  color: Value<"color">;
};

export type GradientFill = {
  type:
    | FillType.LinearGradient
    | FillType.RadialGradient
    | FillType.AngularGradient;

  enabled: Value<"boolean">;

  center: [number, number];
  rotationDegrees: Value<"number">;

  size: [Value<"number">, Value<"number">];

  opacityPercent: Value<"number">;
  stops: ReadonlyArray<Readonly<ColorStop>>;
  blendMode?: Schema.BlendMode;
};

export type ImageFill = {
  type: FillType.Image;
  enabled: Value<"boolean">;
  url: Value<"string">;
  mode: StretchMode;
  opacityPercent: Value<"number">;
  blendMode?: Schema.BlendMode;
};

export type MeshGradientPoint = {
  position: [number, number];
  color: Value<"color">;
  leftHandle: [number, number];
  rightHandle: [number, number];
  topHandle: [number, number];
  bottomHandle: [number, number];
};

export type MeshGradientFill = {
  type: FillType.MeshGradient;
  enabled: Value<"boolean">;
  columns: number;
  rows: number;
  points: MeshGradientPoint[];
  opacityPercent: Value<"number">;
  blendMode?: Schema.BlendMode;
};

export function isAnyFillVisible(
  fills?: ReadonlyArray<Readonly<Resolved<Fill>>>,
): boolean {
  if (!fills) {
    return false;
  }

  for (const fill of fills) {
    if (!fill.enabled) {
      continue;
    }

    const type = fill.type;
    switch (type) {
      case FillType.Color: {
        if (hexToColor(fill.color)[3] > 0) {
          return true;
        }
        break;
      }

      case FillType.AngularGradient:
      case FillType.RadialGradient:
      case FillType.LinearGradient: {
        if (fill.opacityPercent > 0) {
          for (const stop of fill.stops) {
            if (hexToColor(stop.color)[3] > 0) {
              return true;
            }
          }
        }

        break;
      }

      case FillType.Image: {
        return fill.opacityPercent > 0;
      }

      case FillType.MeshGradient: {
        if (fill.opacityPercent > 0) {
          for (const point of fill.points) {
            if (hexToColor(point.color)[3] > 0) {
              return true;
            }
          }
        }
        break;
      }

      default: {
        const missing: never = type;
        throw new Error(`Unknown fill type: ${missing}`);
      }
    }
  }

  return false;
}

export function controlPointsForGradientFill(
  fill: Resolved<GradientFill>,
  width: number,
  height: number,
): {
  start: [number, number];
  end: [number, number];
  ellipsePoint: [number, number];
} {
  const xExtent = fill.size[0] / 2 || 1e-6;
  const yExtent = fill.size[1] / 2 || 1e-6;

  const matrix = new Matrix();
  matrix.translate(-fill.center[0], -fill.center[1]);
  matrix.rotate(deserializeRotation(fill.rotationDegrees));
  matrix.translate(fill.center[0], fill.center[1]);
  matrix.scale(width, height);

  const start = {
    x: fill.center[0] * width,
    y: fill.center[1] * height,
  };

  const end = matrix.apply({
    x: fill.center[0],
    y: fill.center[1] - yExtent,
  });

  const ellipsePoint = matrix.apply({
    x: fill.center[0] + xExtent,
    y: fill.center[1],
  });

  return {
    start: [start.x, start.y],
    end: [end.x, end.y],
    ellipsePoint: [ellipsePoint.x, ellipsePoint.y],
  };
}
