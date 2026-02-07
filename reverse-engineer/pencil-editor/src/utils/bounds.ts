import type { Matrix } from "pixi.js";
import { determinant, dot } from "./math";

export interface ReadOnlyBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;

  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;

  readonly width: number;
  readonly height: number;

  readonly x: number;
  readonly y: number;

  readonly centerX: number;
  readonly centerY: number;

  intersects(other: ReadOnlyBounds): boolean;
  intersectsWithTransform(other: ReadOnlyBounds, transform: Matrix): boolean;
  includes(other: Bounds): boolean;
  containsPoint(x: number, y: number): boolean;

  clone(): Bounds;
  copyFrom(source: ReadOnlyBounds): void;
}

export class Bounds implements ReadOnlyBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;

  get width(): number {
    return this.maxX - this.minX;
  }

  get height(): number {
    return this.maxY - this.minY;
  }

  set width(value: number) {
    this.maxX = this.minX + value;
  }

  set height(value: number) {
    this.maxY = this.minY + value;
  }

  get centerX(): number {
    return this.minX + this.width / 2;
  }

  get centerY(): number {
    return this.minY + this.height / 2;
  }

  get left(): number {
    return this.minX;
  }

  get top(): number {
    return this.minY;
  }

  get right(): number {
    return this.maxX;
  }

  get bottom(): number {
    return this.maxY;
  }

  get x(): number {
    return this.minX;
  }

  get y(): number {
    return this.minY;
  }

  set y(value: number) {
    const height = this.height;

    this.minY = value;
    this.maxY = value + height;
  }

  set x(value: number) {
    const width = this.width;

    this.minX = value;
    this.maxX = value + width;
  }

  static MakeXYWH(x: number, y: number, width: number, height: number) {
    return new Bounds(x, y, x + width, y + height);
  }

  constructor(
    minX: number = Infinity,
    minY: number = Infinity,
    maxX: number = -Infinity,
    maxY: number = -Infinity,
  ) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  reset() {
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
  }

  clone(): Bounds {
    return new Bounds(this.minX, this.minY, this.maxX, this.maxY);
  }

  copyFrom(source: ReadOnlyBounds) {
    this.set(source.minX, source.minY, source.maxX, source.maxY);
  }

  set(minX: number, minY: number, maxX: number, maxY: number) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  setXYWH(x: number, y: number, width: number, height: number) {
    this.minX = x;
    this.minY = y;
    this.maxX = x + width;
    this.maxY = y + height;
  }

  translate(x: number, y: number) {
    this.minX += x;
    this.minY += y;
    this.maxX += x;
    this.maxY += y;
  }

  move(minX: number, minY: number) {
    const width = this.width;
    const height = this.height;

    this.minX = minX;
    this.minY = minY;
    this.maxX = minX + width;
    this.maxY = minY + height;
  }

  inflate(value: number) {
    this.minX -= value;
    this.minY -= value;
    this.maxX += value;
    this.maxY += value;
  }

  unionRectangle(minX: number, minY: number, maxX: number, maxY: number): void {
    if (minX < this.minX) this.minX = minX;
    if (minY < this.minY) this.minY = minY;
    if (maxX > this.maxX) this.maxX = maxX;
    if (maxY > this.maxY) this.maxY = maxY;
  }

  unionBounds(other: ReadOnlyBounds) {
    this.unionRectangle(other.minX, other.minY, other.maxX, other.maxY);
  }

  containsPoint(x: number, y: number): boolean {
    return this.minX <= x && this.minY <= y && this.maxX >= x && this.maxY >= y;
  }

  intersects(other: ReadOnlyBounds): boolean {
    return (
      this.minX < other.maxX &&
      this.maxX > other.minX &&
      this.minY < other.maxY &&
      this.maxY > other.minY
    );
  }

  includes(other: ReadOnlyBounds): boolean {
    return (
      this.minX <= other.minX &&
      this.minY <= other.minY &&
      this.maxX >= other.maxX &&
      this.maxY >= other.maxY
    );
  }

  intersectsWithTransform(other: ReadOnlyBounds, matrix: Matrix): boolean {
    if (
      this.width < 0 ||
      this.height < 0 ||
      other.width < 0 ||
      other.height < 0
    ) {
      return false;
    }

    // NOTE(sedivy): Because javascript doesn't have structs or passing data by
    // value, we have to do this in a very manual way to not allocate extra
    // objects. Even just returning a vector2 from a function would require an
    // array or object allocation.

    const minX = this.minX;
    const maxX = this.maxX;
    const minY = this.minY;
    const maxY = this.maxY;

    const otherMinX = other.minX;
    const otherMaxX = other.maxX;
    const otherMinY = other.minY;
    const otherMaxY = other.maxY;

    const a = matrix.a;
    const b = matrix.b;
    const c = matrix.c;
    const d = matrix.d;
    const tx = matrix.tx;
    const ty = matrix.ty;

    // NOTE(sedivy): This function implements the Separating Axis Theorem (SAT)
    // algorithm to check if two rectangles intersect. In our case we have one
    // axis-aligned rectangle and one transformed rectangle.
    //
    // We only need to test 4 axes:
    //   1. world X
    //   2. world Y
    //   3. left edge normal
    //   4. top edge normal

    const sign = Math.sign(determinant(matrix));
    if (sign === 0) {
      return false;
    }

    // NOTE(sedivy): Apply the matrix to all corners to transform the other rectangle.
    const tlX = a * otherMinX + c * otherMinY + tx;
    const tlY = b * otherMinX + d * otherMinY + ty;
    const blX = a * otherMinX + c * otherMaxY + tx;
    const blY = b * otherMinX + d * otherMaxY + ty;
    const brX = a * otherMaxX + c * otherMaxY + tx;
    const brY = b * otherMaxX + d * otherMaxY + ty;
    const trX = a * otherMaxX + c * otherMinY + tx;
    const trY = b * otherMaxX + d * otherMinY + ty;

    // NOTE(sedivy): Test world X and Y axes.
    if (
      Math.max(tlX, blX, trX, brX) <= minX ||
      Math.min(tlX, blX, trX, brX) >= maxX ||
      Math.max(tlY, blY, trY, brY) <= minY ||
      Math.min(tlY, blY, trY, brY) >= maxY
    ) {
      return false;
    }

    // NOTE(sedivy): Test first axis of the transformed rectangle (left edge normal).
    {
      const normalX = sign * (blY - tlY);
      const normalY = sign * (tlX - blX);

      // NOTE(sedivy): Project the current bounding box onto the normal and find the min/max.
      const projected0 = dot(normalX, normalY, minX, minY);
      const projected1 = dot(normalX, normalY, maxX, minY);
      const projected2 = dot(normalX, normalY, minX, maxY);
      const projected3 = dot(normalX, normalY, maxX, maxY);

      const min = Math.min(projected0, projected1, projected2, projected3);
      const max = Math.max(projected0, projected1, projected2, projected3);

      if (
        max < dot(normalX, normalY, tlX, tlY) ||
        min > dot(normalX, normalY, brX, brY)
      ) {
        return false;
      }
    }

    // NOTE(sedivy): Test second axis of the transformed rectangle (top edge normal).
    {
      const normalX = sign * (tlY - trY);
      const normalY = sign * (trX - tlX);

      // NOTE(sedivy): Project the current bounding box onto the normal and find the min/max.
      const projected0 = dot(normalX, normalY, minX, minY);
      const projected1 = dot(normalX, normalY, maxX, minY);
      const projected2 = dot(normalX, normalY, minX, maxY);
      const projected3 = dot(normalX, normalY, maxX, maxY);

      const min = Math.min(projected0, projected1, projected2, projected3);
      const max = Math.max(projected0, projected1, projected2, projected3);

      if (
        max < dot(normalX, normalY, tlX, tlY) ||
        min > dot(normalX, normalY, brX, brY)
      ) {
        return false;
      }
    }

    return true;
  }

  transform(matrix: Matrix) {
    const minX = this.minX;
    const minY = this.minY;
    const maxX = this.maxX;
    const maxY = this.maxY;

    const a = matrix.a;
    const b = matrix.b;
    const c = matrix.c;
    const d = matrix.d;
    const tx = matrix.tx;
    const ty = matrix.ty;

    let x = a * minX + c * minY + tx;
    let y = b * minX + d * minY + ty;
    this.minX = x;
    this.minY = y;
    this.maxX = x;
    this.maxY = y;

    x = a * maxX + c * minY + tx;
    y = b * maxX + d * minY + ty;
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;

    x = a * minX + c * maxY + tx;
    y = b * minX + d * maxY + ty;
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;

    x = a * maxX + c * maxY + tx;
    y = b * maxX + d * maxY + ty;
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
  }
}
