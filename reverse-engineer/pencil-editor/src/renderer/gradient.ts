import type { Shader } from "@highagency/pencil-skia";
import {
  controlPointsForGradientFill,
  FillType,
  type GradientFill,
} from "../canvas/fill";
import type { Resolved } from "../managers/variable-manager";
import { hexToColor, Skia } from "../skia";

function createLinearGradientShader(
  colors: Float32Array,
  positions: number[],
  matrix: number[],
): Shader | null {
  return Skia.Shader.MakeLinearGradient(
    [-1, 0],
    [1, 0],
    colors,
    positions,
    Skia.TileMode.Clamp,
    matrix,
    0,
  );
}

function createRadialGradientShader(
  colors: Float32Array,
  positions: number[],
  matrix: number[],
): Shader | null {
  return Skia.Shader.MakeRadialGradient(
    [0, 0],
    1,
    colors,
    positions,
    Skia.TileMode.Clamp,
    matrix,
    0,
  );
}

function createAngularGradientShader(
  colors: Float32Array,
  positions: number[],
  matrix: number[],
): Shader | null {
  return Skia.Shader.MakeSweepGradient(
    0,
    0,
    colors,
    positions,
    Skia.TileMode.Clamp,
    matrix,
    0,
  );
}

function createSkiaMatrixForGradient(
  start: [number, number],
  end: [number, number],
  ellipsePoint: [number, number],
) {
  const a = end[0] - start[0];
  const b = end[1] - start[1];

  const c = ellipsePoint[0] - start[0] || 1e-6;
  const d = ellipsePoint[1] - start[1] || 1e-6;

  const tx = start[0];
  const ty = start[1];

  // biome-ignore format: matrix
  return [
    a, c, 0, tx,
    b, d, 0, ty,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

function colorStopsForGradientFill(fill: Resolved<Readonly<GradientFill>>): {
  colors: Float32Array;
  positions: number[];
} {
  const stops = fill.stops.toSorted((a, b) => a.position - b.position);

  const colors = new Float32Array(stops.length * 4);
  const positions = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const color = hexToColor(stop.color);
    colors[i * 4 + 0] = color[0];
    colors[i * 4 + 1] = color[1];
    colors[i * 4 + 2] = color[2];
    colors[i * 4 + 3] = color[3];

    positions.push(stop.position);
  }

  return { colors, positions };
}

export function createGradientShader(
  fill: Resolved<GradientFill>,
  width: number,
  height: number,
): Shader | null {
  const { colors, positions } = colorStopsForGradientFill(fill);

  const { start, end, ellipsePoint } = controlPointsForGradientFill(
    fill,
    width,
    height,
  );

  const matrix = createSkiaMatrixForGradient(start, end, ellipsePoint);

  const type = fill.type;
  switch (type) {
    case FillType.LinearGradient: {
      return createLinearGradientShader(colors, positions, matrix);
    }

    case FillType.RadialGradient: {
      return createRadialGradientShader(colors, positions, matrix);
    }

    case FillType.AngularGradient: {
      return createAngularGradientShader(colors, positions, matrix);
    }

    default: {
      const missing: never = type;
      throw new Error(`Missing gradient type in Skia renderer: ${missing}`);
    }
  }
}
