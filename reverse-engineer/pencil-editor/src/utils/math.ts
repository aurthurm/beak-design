import type { Matrix, PointData } from "pixi.js";
import { Bounds } from "./bounds";

export function distance(a: PointData, b: PointData): number {
  return Math.sqrt(distance2(a, b));
}

export function distance2(a: PointData, b: PointData): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

export function rotateVector(x: number, y: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return {
    x: x * c - y * s,
    y: x * s + y * c,
  };
}

export function normalizeAngle(rotation: number): number {
  const tau = Math.PI * 2;

  return ((rotation % tau) + tau) % tau;
}

export function angleDifference(current: number, target: number): number {
  return normalizeAngle(target - current);
}

export function rectangleFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Bounds {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const width = Math.abs(x1 - x2);
  const height = Math.abs(y1 - y2);
  return Bounds.MakeXYWH(x, y, width, height);
}

export function safeRatio0(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export function safeRatio1(a: number, b: number): number {
  return b === 0 ? 1 : a / b;
}

export function radToDeg(value: number) {
  return value * (180 / Math.PI);
}

export function degToRad(value: number) {
  return value * (Math.PI / 180);
}

export function remap(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  return toMin + ((value - fromMin) * (toMax - toMin)) / (fromMax - fromMin);
}

export function clamp(min: number, value: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function almostEquals(
  a: number,
  b: number,
  tolerance: number = Number.EPSILON,
): boolean {
  return Math.abs(a - b) < tolerance;
}

export function almostEqualsV2(
  a: [number, number],
  b: [number, number],
  tolerance: number = Number.EPSILON,
): boolean {
  return (
    almostEquals(a[0], b[0], tolerance) && almostEquals(a[1], b[1], tolerance)
  );
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) ** 2;
}

export function easeOvershoot(t: number, c: number): number {
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

export function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

export function inverseLerp(a: number, b: number, value: number): number {
  return safeRatio0(value - a, b - a);
}

export function dot(x0: number, y0: number, x1: number, y1: number): number {
  return x0 * x1 + y0 * y1;
}

export function cross(x0: number, y0: number, x1: number, y1: number): number {
  return x0 * y1 - y0 * x1;
}

export function determinant(matrix: Matrix): number {
  return matrix.a * matrix.d - matrix.b * matrix.c;
}

export function roundToMultiple(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple;
}

export function expDecay(
  a: number,
  b: number,
  decay: number,
  deltaTime: number,
): number {
  return b + (a - b) * Math.exp(-decay * deltaTime);
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// biome-ignore format: math
export function cubicBezier(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const u = 1.0 - t;

  return (1.0 * u * u * u * p0) +
         (3.0 * u * u * t * p1) +
         (3.0 * u * t * t * p2) +
         (1.0 * t * t * t * p3);
}

// biome-ignore format: arguments
export function cubicBezierPatch(
  p00: number, p01: number, p02: number, p03: number,
  p10: number, p11: number, p12: number, p13: number,
  p20: number, p21: number, p22: number, p23: number,
  p30: number, p31: number, p32: number, p33: number,
  u: number, v: number,
): number {
  return cubicBezier(
    cubicBezier(p00, p01, p02, p03, v),
    cubicBezier(p10, p11, p12, p13, v),
    cubicBezier(p20, p21, p22, p23, v),
    cubicBezier(p30, p31, p32, p33, v),
    u,
  );
}
