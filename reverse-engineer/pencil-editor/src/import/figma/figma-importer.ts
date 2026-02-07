import type { BlendMode } from "@ha/schema";
import { logger } from "@ha/shared";
import { compileSchema, decodeBinarySchema } from "kiwi-schema";
import { inflateRaw } from "pako";
import { Matrix } from "pixi.js";
import { v4 as uuidv4 } from "uuid";
import {
  type DropShadowEffect,
  type Effect,
  EffectType,
} from "../../canvas/effect";
import {
  type ColorStop,
  type Fill,
  FillType,
  type GradientFill,
  StretchMode,
} from "../../canvas/fill";
import {
  AlignItems,
  Axis,
  JustifyContent,
  LayoutMode,
  SizingBehavior,
} from "../../canvas/layout";
import { type NodeProperties, StrokeAlignment } from "../../canvas/scene-graph";
import { serializeRotation } from "../../canvas/serializer";
import {
  createNodeProperties,
  type DesignFile,
  type SerializedNode,
} from "../../managers/file-manager";
import type { Resolved } from "../../managers/variable-manager";
import { colorToHex, hexToColor, Skia } from "../../skia";
import { cross, distance, dot, inverseLerp, lerp } from "../../utils/math";
import type * as FigmaSchema from "./figma-schema";

type VectorSegment = {
  styleID: number;
  start: { vertex: number; dx: number; dy: number };
  end: { vertex: number; dx: number; dy: number };
};

type VectorNetwork = {
  vertices: { styleID: number; x: number; y: number }[];
  segments: VectorSegment[];
  regions: {
    styleID: number;
    windingRule: string;
    loops: { segments: number[] }[];
  }[];
};

function parseBlendMode(
  mode: FigmaSchema.BlendMode | undefined,
): BlendMode | undefined {
  switch (mode) {
    case undefined:
    case "NORMAL":
    case "PASS_THROUGH":
      return undefined;
    case "DARKEN":
      return "darken";
    case "MULTIPLY":
      return "multiply";
    case "LINEAR_BURN":
      return "linearBurn";
    case "COLOR_BURN":
      return "colorBurn";
    case "LIGHTEN":
      return "light";
    case "SCREEN":
      return "screen";
    case "LINEAR_DODGE":
      return "linearDodge";
    case "COLOR_DODGE":
      return "colorDodge";
    case "OVERLAY":
      return "overlay";
    case "SOFT_LIGHT":
      return "softLight";
    case "HARD_LIGHT":
      return "hardLight";
    case "DIFFERENCE":
      return "difference";
    case "EXCLUSION":
      return "exclusion";
    case "HUE":
      return "hue";
    case "SATURATION":
      return "saturation";
    case "COLOR":
      return "color";
    case "LUMINOSITY":
      return "luminosity";
    default: {
      const missing: never = mode;
      logger.warn(`Unknown blend mode "${missing}" during import.`);
      return undefined;
    }
  }
}

export type Header = { prelude: string; version: number };

const FIG_KIWI_PRELUDE = "fig-kiwi";
const FIGJAM_KIWI_PRELUDE = "fig-jam.";

type FigmaNode = {
  props: FigmaSchema.NodeChange;
  children: Array<FigmaNode> | null;
  parent: FigmaNode | null;
};

function guidMatches(
  a: FigmaSchema.GUID | undefined,
  b: FigmaSchema.GUID | undefined,
): boolean {
  if (a == null || b == null) {
    return false;
  }

  return a.sessionID === b.sessionID && a.localID === b.localID;
}

function decomposeMatrixIntoNodeProperties(
  matrix: FigmaSchema.Matrix,
  node: SerializedNode,
) {
  const a = matrix.m00;
  const b = matrix.m10;
  const c = matrix.m01;
  const d = matrix.m11;
  const tx = matrix.m02;
  const ty = matrix.m12;

  const determinant = a * d - b * c;
  const flipX = determinant < 0;

  const scaleX = Math.sqrt(a * a + b * b) * (flipX ? -1 : 1);
  const scaleY = Math.sqrt(c * c + d * d);

  let rotation = Math.atan2(b, a);
  if (flipX) {
    rotation = Math.atan2(-b, -a);
  }

  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  const expectedA = Math.abs(scaleX) * cosR;
  const expectedB = Math.abs(scaleX) * sinR;
  const expectedC = -Math.abs(scaleY) * sinR;
  const expectedD = Math.abs(scaleY) * cosR;

  const tolerance = 1e-6;
  const flipXAxis =
    Math.abs(a - expectedA) > tolerance || Math.abs(b - expectedB) > tolerance;
  const flipYAxis =
    Math.abs(c - expectedC) > tolerance || Math.abs(d - expectedD) > tolerance;

  node.properties.x = tx;
  node.properties.y = ty;
  node.properties.flipX = flipXAxis;
  node.properties.flipY = flipYAxis;
  node.properties.rotation = rotation;
}

class FigmaArchiveParser {
  buffer: Uint8Array;
  data: DataView;
  offset = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.data = new DataView(buffer.buffer);
  }

  private readUint32(): number {
    const n = this.data.getUint32(this.offset, true);
    this.offset += 4;
    return n;
  }

  private read(bytes: number): Uint8Array {
    if (this.offset + bytes <= this.buffer.length) {
      const d = this.buffer.slice(this.offset, this.offset + bytes);
      this.offset += bytes;
      return d;
    } else {
      throw new Error(`read(${bytes}) is past end of data`);
    }
  }

  private readHeader(): Header {
    const preludeData = this.read(FIG_KIWI_PRELUDE.length);
    // @ts-expect-error
    const prelude = String.fromCharCode.apply(String, preludeData);
    if (prelude !== FIG_KIWI_PRELUDE && prelude !== FIGJAM_KIWI_PRELUDE) {
      throw new Error(`Unexpected prelude: "${prelude}"`);
    }
    const version = this.readUint32();
    return { prelude, version };
  }

  private readData(size: number): Uint8Array {
    return this.read(size);
  }

  private readAll(): { header: Header; files: Uint8Array[] } {
    const header = this.readHeader();
    const files: Uint8Array[] = [];
    while (this.offset + 4 < this.buffer.length) {
      const size = this.readUint32();
      const data = this.readData(size);
      files.push(data);
    }
    return { header, files };
  }

  static parseArchive(data: Uint8Array): {
    header: Header;
    files: Uint8Array[];
  } {
    const parser = new FigmaArchiveParser(data);
    return parser.readAll();
  }
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function colorVec4ToHex(
  data: FigmaSchema.Color | undefined,
  opacity: number,
): string | null {
  if (!data) {
    return null;
  }

  const r = Math.round(data.r * 255);
  const g = Math.round(data.g * 255);
  const b = Math.round(data.b * 255);
  const a = Math.round(data.a * opacity * 255);

  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
}

function parseFills(
  fills: FigmaSchema.Paint[] | undefined,
): Fill[] | undefined {
  if (!fills) {
    return;
  }

  const converted: Fill[] = [];

  for (const fill of fills) {
    switch (fill.type) {
      case "SOLID": {
        const hex = colorVec4ToHex(fill.color, fill.opacity ?? 1);
        if (hex) {
          converted.push({
            type: FillType.Color,
            enabled: fill.visible === true,
            color: hex,
            blendMode: parseBlendMode(fill.blendMode),
          });
        }
        break;
      }

      case "IMAGE": {
        let mode = StretchMode.Fill;

        if (fill.imageScaleMode) {
          switch (fill.imageScaleMode) {
            case "FILL": {
              mode = StretchMode.Fill;
              break;
            }
            case "FIT": {
              mode = StretchMode.Fit;
              break;
            }
            case "TILE": {
              // TODO(sedivy): Implement tile mode.
              break;
            }
            case "STRETCH": {
              mode = StretchMode.Stretch;
              break;
            }
            default: {
              const missing: never = fill.imageScaleMode;
              logger.warn(
                `Unknown image scale mode: "${missing}" during import.`,
              );
              break;
            }
          }
        }

        converted.push({
          type: FillType.Image,
          enabled: fill.visible === true,
          url: "",
          mode: mode,
          opacityPercent: fill.opacity ? fill.opacity * 100 : 100,
          blendMode: parseBlendMode(fill.blendMode),
        });
        break;
      }

      case "GRADIENT_RADIAL":
      case "GRADIENT_ANGULAR":
      case "GRADIENT_LINEAR": {
        const transform = fill.transform;
        if (!transform) {
          break;
        }

        if (!fill.stops) {
          break;
        }

        let stops: Resolved<ColorStop>[] = fill.stops.map((stop) => {
          return {
            position: stop.position,
            color: colorVec4ToHex(stop.color, 1) ?? "#000000ff",
          };
        });

        const enabled = fill.visible === true;
        const opacityPercent = (fill.opacity ?? 1) * 100;
        const blendMode = parseBlendMode(fill.blendMode);

        const matrix = new Matrix(
          transform.m00,
          transform.m10,
          transform.m01,
          transform.m11,
          transform.m02,
          transform.m12,
        ).invert();

        let result: GradientFill | null = null;

        switch (fill.type) {
          case "GRADIENT_LINEAR": {
            const start = matrix.apply({
              x: 0,
              y: 0.5,
            });

            const end = matrix.apply({
              x: 1.0,
              y: 0.5,
            });

            const figmaMinorPoint = matrix.apply({ x: 0, y: 1 });

            let dx = figmaMinorPoint.x - start.x;
            let dy = figmaMinorPoint.y - start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length !== 0) {
              dx = dx / length;
              dy = dy / length;
            }

            const endDirectionX = -dy;
            const endDirectionY = dx;

            let width = dot(
              endDirectionX,
              endDirectionY,
              end.x - start.x,
              end.y - start.y,
            );

            let rotation =
              Math.atan2(endDirectionY, endDirectionX) + Math.PI / 2;

            if (width < 0) {
              width = -width;
              rotation += Math.PI;
            }

            result = {
              type: FillType.LinearGradient,
              enabled: enabled,
              opacityPercent: opacityPercent,
              stops: stops,
              center: [(start.x + end.x) / 2, (start.y + end.y) / 2],
              rotationDegrees: serializeRotation(rotation),
              size: [1, width],
              blendMode: blendMode,
            };
            break;
          }

          case "GRADIENT_RADIAL": {
            const center = matrix.apply({
              x: 0.5,
              y: 0.5,
            });

            const figmaMajorPoint = matrix.apply({
              x: 1.0,
              y: 0.5,
            });

            const figmaMinorPoint = matrix.apply({ x: 0.5, y: 1 });

            // biome-ignore format: matrix
            const m = [
              figmaMajorPoint.x - center.x, figmaMinorPoint.x - center.x,
              figmaMajorPoint.y - center.y, figmaMinorPoint.y - center.y,
            ];

            // M · Mᵀ
            const mmt_a = m[0] * m[0] + m[1] * m[1];
            const mmt_b = m[0] * m[2] + m[1] * m[3];
            const mmt_c = m[2] * m[2] + m[3] * m[3];

            const trace = mmt_a + mmt_c;
            const determinant = mmt_a * mmt_c - mmt_b * mmt_b;
            const discriminant = Math.sqrt(trace * trace - 4 * determinant);

            const lambda1 = (trace + discriminant) / 2;
            const lambda2 = (trace - discriminant) / 2;

            const width = Math.sqrt(lambda1) * 2;
            const height = Math.sqrt(lambda2) * 2;
            const rotation = Math.atan2(lambda1 - mmt_a, mmt_b) + Math.PI / 2;

            result = {
              type: FillType.RadialGradient,
              enabled: enabled,
              opacityPercent: opacityPercent,
              stops: stops,
              rotationDegrees: serializeRotation(rotation),
              center: [center.x, center.y],
              size: [height, width],
              blendMode: blendMode,
            };
            break;
          }

          case "GRADIENT_ANGULAR": {
            const center = matrix.apply({
              x: 0.5,
              y: 0.5,
            });

            const figmaMajorPoint = matrix.apply({
              x: 1.0,
              y: 0.5,
            });

            const figmaMinorPoint = matrix.apply({ x: 0.5, y: 1 });

            const rotation =
              Math.atan2(
                figmaMajorPoint.y - center.y,
                figmaMajorPoint.x - center.x,
              ) +
              Math.PI / 2;

            const ellipseSign =
              cross(
                figmaMinorPoint.x - center.x,
                figmaMinorPoint.y - center.y,
                figmaMajorPoint.x - center.x,
                figmaMajorPoint.y - center.y,
              ) > 0
                ? -1
                : 1;

            const width = distance(center, figmaMajorPoint) * 2;
            const height = ellipseSign * distance(center, figmaMinorPoint) * 2;

            if (stops.length >= 2) {
              stops = stops.toSorted((a, b) => {
                return a.position - b.position;
              });

              const first = stops[0];
              const last = stops[stops.length - 1];

              if (first.position !== 0 || last.position !== 1) {
                const length = first.position + (1 - last.position);
                const ratio = inverseLerp(0, length, first.position);

                const firstColor = hexToColor(first.color);
                const lastColor = hexToColor(last.color);

                const color: [number, number, number, number] = [
                  lerp(firstColor[0], lastColor[0], ratio),
                  lerp(firstColor[1], lastColor[1], ratio),
                  lerp(firstColor[2], lastColor[2], ratio),
                  lerp(firstColor[3], lastColor[3], ratio),
                ];

                if (first.position !== 0) {
                  stops.unshift({
                    position: 0,
                    color: colorToHex(color),
                  });
                }

                if (last.position !== 1) {
                  stops.push({ position: 1, color: colorToHex(color) });
                }
              }
            }

            result = {
              type: FillType.AngularGradient,
              enabled: enabled,
              opacityPercent: opacityPercent,
              stops: stops,
              rotationDegrees: serializeRotation(rotation),
              center: [center.x, center.y],
              size: [height, width],
              blendMode: blendMode,
            };
            break;
          }

          default: {
            const missing: never = fill.type;
            logger.warn(
              `Unknown gradient fill type: "${missing}" during import.`,
            );
            break;
          }
        }

        if (result) {
          converted.push(result);
        }

        break;
      }

      default: {
        logger.warn(`Unsupported fill type "${fill.type} during import.`);
        break;
      }
    }
  }

  if (converted.length === 0) {
    return;
  }

  return converted;
}

function parseAndSetFillPaints(properties: NodeProperties, data: FigmaNode) {
  properties.fills = parseFills(data.props.fillPaints);
}

function parseCornerRadius(properties: NodeProperties, data: FigmaNode) {
  const bl = data.props.rectangleBottomLeftCornerRadius ?? 0;
  const br = data.props.rectangleBottomRightCornerRadius ?? 0;
  const tl = data.props.rectangleTopLeftCornerRadius ?? 0;
  const tr = data.props.rectangleTopRightCornerRadius ?? 0;

  if (bl !== 0 || br !== 0 || tl !== 0 || tr !== 0) {
    properties.cornerRadius = [tl, tr, br, bl];
  }

  if (properties.cornerRadius == null && data.props.cornerRadius != null) {
    // TODO(sedivy): There is also cornerSmoothing which probably affects this.
    properties.cornerRadius = [
      data.props.cornerRadius,
      data.props.cornerRadius,
      data.props.cornerRadius,
      data.props.cornerRadius,
    ];
  }
}

function parseAndSetEffects(properties: NodeProperties, data: FigmaNode) {
  if (data.props.effects) {
    const effects: Effect[] = [];

    for (const effect of data.props.effects) {
      // NOTE(sedivy): For some reason the blur figma uses is stronger
      // than Skia blur or css blur. The constant is to scale it down to
      // more reasonable value.
      const radius = (effect.radius ?? 0) * 0.875;

      switch (effect.type) {
        case "FOREGROUND_BLUR": {
          effects.push({
            type: EffectType.LayerBlur,
            enabled: effect.visible === true,
            radius: radius,
          });
          break;
        }

        case "BACKGROUND_BLUR": {
          effects.push({
            type: EffectType.BackgroundBlur,
            enabled: effect.visible === true,
            radius: radius,
          });
          break;
        }

        case "DROP_SHADOW": {
          const item: DropShadowEffect = {
            type: EffectType.DropShadow,
            enabled: effect.visible === true,
            color: colorToHex([
              effect.color?.r ?? 0,
              effect.color?.g ?? 0,
              effect.color?.b ?? 0,
              effect.color?.a ?? 0,
            ]),
            radius: radius,
            offsetX: effect.offset?.x ?? 0,
            offsetY: effect.offset?.y ?? 0,
            spread: effect.spread ?? 0,

            // TODO(sedivy): Add support for `blendMode`.
            // TODO(sedivy): Add support for `showShadowBehindNode`.
            blendMode: "normal",
          };

          effects.push(item);
          break;
        }

        default: {
          logger.warn(`Unsupported effect "${effect.type} during import.`);
        }
      }
    }

    if (effects.length > 0) {
      properties.effects = effects;
    }
  }
}

function parseAndSetStroke(properties: NodeProperties, data: FigmaNode) {
  switch (data.props.strokeAlign) {
    case "CENTER": {
      properties.strokeAlignment = StrokeAlignment.Center;
      break;
    }
    case "INSIDE": {
      properties.strokeAlignment = StrokeAlignment.Inside;
      break;
    }
    case "OUTSIDE":
      properties.strokeAlignment = StrokeAlignment.Outside;
      break;
  }

  switch (data.props.strokeJoin) {
    case "MITER": {
      properties.lineJoin = "miter";
      break;
    }
    case "BEVEL": {
      properties.lineJoin = "bevel";
      break;
    }
    case "ROUND":
      properties.lineJoin = "round";
      break;
  }

  switch (data.props.strokeCap) {
    case "NONE": {
      properties.lineCap = "none";
      break;
    }
    case "ROUND": {
      properties.lineCap = "round";
      break;
    }
    case "SQUARE": {
      properties.lineCap = "square";
      break;
    }
  }

  if (data.props.borderStrokeWeightsIndependent) {
    properties.strokeWidth = [
      data.props.borderTopWeight ?? 0,
      data.props.borderRightWeight ?? 0,
      data.props.borderBottomWeight ?? 0,
      data.props.borderLeftWeight ?? 0,
    ];
  } else {
    if (data.props.strokeWeight) {
      properties.strokeWidth = [
        data.props.strokeWeight,
        data.props.strokeWeight,
        data.props.strokeWeight,
        data.props.strokeWeight,
      ];
    }
  }

  properties.strokeFills = parseFills(data.props.strokePaints);
}

class FigmaConverter {
  nodes: Map<string, FigmaNode>;
  blobs: FigmaSchema.Blob[] | undefined;

  constructor(
    nodes: Map<string, FigmaNode>,
    blobs: FigmaSchema.Blob[] | undefined,
  ) {
    this.nodes = nodes;
    this.blobs = blobs;
  }

  getNode(guid: FigmaSchema.GUID): FigmaNode | undefined {
    return this.nodes.get(`${guid.sessionID}:${guid.localID}`);
  }

  findChildById(node: FigmaNode, id: FigmaSchema.GUID): FigmaNode | undefined {
    if (!node.children) {
      return;
    }

    for (const child of node.children) {
      if (
        guidMatches(child.props.guid, id) ||
        guidMatches(child.props.overrideKey, id)
      ) {
        return child;
      }

      if (child.children) {
        const found = this.findChildById(child, id);
        if (found) {
          return found;
        }
      }
    }

    return;
  }

  findNestedChild(
    node: FigmaNode,
    path: FigmaSchema.GUID[] | undefined,
  ): FigmaNode | undefined {
    if (!path) {
      return;
    }

    let found = node;

    for (const item of path) {
      const child = this.findChildById(found, item);
      if (!child) {
        return;
      }

      found = child;
    }

    return found;
  }

  cloneNode(root: FigmaNode): FigmaNode {
    const cloned: FigmaNode = {
      props: structuredClone(root.props),
      children: null,
      parent: null,
    };

    if (root.children) {
      cloned.children = [];
      for (const child of root.children) {
        const clonedChild = this.cloneNode(child);
        clonedChild.parent = cloned;
        cloned.children.push(clonedChild);
      }
    }

    return cloned;
  }

  detachInstance(data: FigmaNode) {
    if (data.props.type === "INSTANCE") {
      if (data.props.parameterConsumptionMap?.entries) {
        for (const item of data.props.parameterConsumptionMap.entries) {
          const guid = item.variableData?.value?.propRefValue?.defId;
          if (guid) {
            const found = this.findVariable(data, guid);
            if (found) {
              this.applyVariable(data, item, found);
            }
          }
        }
      }

      const symbolID =
        data.props.overriddenSymbolID || data.props.symbolData?.symbolID;
      if (symbolID) {
        const component = this.getNode(symbolID);
        if (component) {
          const cloned = this.cloneNode(component);

          if (data.props.symbolData?.symbolOverrides) {
            for (const override of data.props.symbolData.symbolOverrides) {
              const child = this.findNestedChild(
                cloned,
                override.guidPath?.guids,
              );
              if (child) {
                Object.assign(child.props, override);
              }
            }
          }

          if (cloned.children) {
            for (const child of cloned.children) {
              child.parent = data;
            }
          }

          data.children = cloned.children;
          data.props.type = "FRAME";
        }
      }
    }

    if (data.children) {
      for (const child of data.children) {
        this.detachInstance(child);
      }
    }

    if (data.props.derivedSymbolData) {
      for (const override of data.props.derivedSymbolData) {
        const child = this.findNestedChild(data, override.guidPath?.guids);
        if (child) {
          Object.assign(child.props, override);
        }
      }
    }

    if (data.props.symbolData?.symbolOverrides) {
      for (const override of data.props.symbolData.symbolOverrides) {
        const child = this.findNestedChild(data, override.guidPath?.guids);
        if (child) {
          Object.assign(child.props, override);
        }
      }
    }
  }

  findVariable(
    start: FigmaNode,
    id: FigmaSchema.GUID,
  ): FigmaSchema.ComponentPropAssignment | undefined {
    for (let iter: FigmaNode | null = start; iter; iter = iter.parent) {
      if (iter.props.componentPropAssignments) {
        for (const variable of iter.props.componentPropAssignments) {
          if (guidMatches(id, variable.defID)) {
            return variable;
          }
        }
      }
    }
  }

  applyVariable(
    node: FigmaNode,
    entry: FigmaSchema.VariableDataMapEntry,
    variable: FigmaSchema.ComponentPropAssignment,
  ) {
    switch (entry.variableField) {
      case "VISIBLE": {
        node.props.visible = variable.value?.boolValue;
        break;
      }
      case "TEXT_DATA": {
        node.props.textData = variable.value?.textValue;
        break;
      }
      case "OVERRIDDEN_SYMBOL_ID": {
        node.props.overriddenSymbolID = variable.value?.guidValue;
        break;
      }
      default: {
        logger.warn(
          `Unexpected variable entry point "${entry.variableField}" with value ${JSON.stringify(variable.value)} during import`,
        );
      }

      // case "MISSING": { break; }
      // case "CORNER_RADIUS": { break; }
      // case "PARAGRAPH_SPACING": { break; }
      // case "PARAGRAPH_INDENT": { break; }
      // case "STROKE_WEIGHT": { break; }
      // case "STACK_SPACING": { break; }
      // case "STACK_PADDING_LEFT": { break; }
      // case "STACK_PADDING_TOP": { break; }
      // case "STACK_PADDING_RIGHT": { break; }
      // case "STACK_PADDING_BOTTOM": { break; }
      // case "WIDTH": { break; }
      // case "HEIGHT": { break; }
      // case "RECTANGLE_TOP_LEFT_CORNER_RADIUS": { break; }
      // case "RECTANGLE_TOP_RIGHT_CORNER_RADIUS": { break; }
      // case "RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS": { break; }
      // case "RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS": { break; }
      // case "BORDER_TOP_WEIGHT": { break; }
      // case "BORDER_BOTTOM_WEIGHT": { break; }
      // case "BORDER_LEFT_WEIGHT": { break; }
      // case "BORDER_RIGHT_WEIGHT": { break; }
      // case "VARIANT_PROPERTIES": { break; }
      // case "STACK_COUNTER_SPACING": { break; }
      // case "MIN_WIDTH": { break; }
      // case "MAX_WIDTH": { break; }
      // case "MIN_HEIGHT": { break; }
      // case "MAX_HEIGHT": { break; }
      // case "FONT_FAMILY": { break; }
      // case "FONT_STYLE": { break; }
      // case "FONT_VARIATIONS": { break; }
      // case "OPACITY": { break; }
      // case "FONT_SIZE": { break; }
      // case "LETTER_SPACING": { break; }
      // case "LINE_HEIGHT": { break; }
      // case "OVERRIDDEN_SYMBOL_ID": { break; }
      // case "HYPERLINK": { break; }
      // case "CMS_SERIALIZED_RICH_TEXT_DATA": { break; }
      // case "SLOT_CONTENT_ID": { break; }
      // case "GRID_ROW_GAP": { break; }
      // case "GRID_COLUMN_GAP": { break; }
    }
  }

  convertNode(
    data: FigmaNode,
    parent: SerializedNode | null,
  ): SerializedNode | null {
    if (data.props.parameterConsumptionMap?.entries) {
      for (const item of data.props.parameterConsumptionMap.entries) {
        const guid = item.variableData?.value?.propRefValue?.defId;
        if (guid) {
          const found = this.findVariable(data, guid);
          if (found) {
            this.applyVariable(data, item, found);
          }
        }
      }
    }

    const node: SerializedNode = {
      id: uuidv4(),
      type: "frame",
      reusable: false,
      properties: createNodeProperties("frame"),
      children: [] as SerializedNode[],
    };

    if (data.props.transform) {
      decomposeMatrixIntoNodeProperties(data.props.transform, node);
    }

    if (data.props.name) {
      node.properties.name = data.props.name;
    }

    if (data.props.visible === false) {
      node.properties.enabled = false;
    }

    if (data.props.opacity != null) {
      node.properties.opacity = data.props.opacity;
    }

    parseLayout(this, node.properties, data);

    const type = data.props.type;
    switch (type) {
      case "SYMBOL":
      case "SECTION":
      case "FRAME": {
        // TODO(sedivy): SYMBOL should be its own thing.
        if (data.props.resizeToFit) {
          node.type = "group";
        } else {
          node.type = "frame";
        }

        node.properties.clip = !(data.props.frameMaskDisabled ?? false);

        parseAndSetFillPaints(node.properties, data);
        parseAndSetStroke(node.properties, data);
        parseAndSetEffects(node.properties, data);
        parseCornerRadius(node.properties, data);

        if (data.props.size) {
          node.properties.width = data.props.size.x;
          node.properties.height = data.props.size.y;
        }
        break;
      }

      case "VECTOR": {
        node.type = "path";

        parseAndSetFillPaints(node.properties, data);
        parseAndSetStroke(node.properties, data);
        parseAndSetEffects(node.properties, data);

        if (data.props.size) {
          node.properties.width = data.props.size.x;
          node.properties.height = data.props.size.y;
        }

        if (data.props.vectorData) {
          if (data.props.vectorData.vectorNetworkBlob != null) {
            if (this.blobs) {
              const blob = this.blobs[data.props.vectorData.vectorNetworkBlob];
              if (blob) {
                const parsed = this.parseVectorNetworkBlob(blob.bytes);
                if (parsed) {
                  const builder = new Skia.PathBuilder();

                  const scratchPath = new Skia.PathBuilder();

                  let lastWinding;

                  if (parsed.regions && parsed.regions.length > 0) {
                    for (const region of parsed.regions) {
                      for (const loop of region.loops) {
                        if (loop.segments.length === 0) {
                          continue;
                        }

                        const orderedSegments = reorderSegmentPoints(
                          loop.segments.map(
                            (idx: number) => parsed.segments[idx],
                          ),
                        );

                        let currentStart: number | undefined;
                        let previousEnd: number | undefined;

                        for (const seg of orderedSegments) {
                          const startIndex = seg.start.vertex;
                          const startVertex = parsed.vertices[startIndex];

                          const endIndex = seg.end.vertex;
                          const endVertex = parsed.vertices[endIndex];

                          if (previousEnd !== startIndex) {
                            scratchPath.moveTo(startVertex.x, startVertex.y);
                            currentStart = startIndex;
                          }

                          if (
                            seg.start.dx === 0 &&
                            seg.start.dy === 0 &&
                            seg.end.dx === 0 &&
                            seg.end.dy === 0
                          ) {
                            scratchPath.lineTo(endVertex.x, endVertex.y);
                          } else {
                            scratchPath.cubicTo(
                              startVertex.x + seg.start.dx,
                              startVertex.y + seg.start.dy,
                              endVertex.x + seg.end.dx,
                              endVertex.y + seg.end.dy,
                              endVertex.x,
                              endVertex.y,
                            );
                          }

                          previousEnd = endIndex;
                          if (
                            currentStart != null &&
                            endIndex === currentStart
                          ) {
                            scratchPath.close();
                            previousEnd = undefined;
                            currentStart = undefined;
                          }
                        }
                      }

                      // TODO(sedivy): Handle multiple different windings per
                      // each region. Right now we store just a single path and
                      // a single winding rule.
                      lastWinding = region.windingRule;

                      builder.addPath(scratchPath.detach());
                    }
                  } else {
                    const orderedSegments = reorderSegmentPoints(
                      parsed.segments,
                    );

                    let currentStart: number | undefined;
                    let previousEnd: number | undefined;

                    for (const seg of orderedSegments) {
                      const startIndex = seg.start.vertex;
                      const startVertex = parsed.vertices[startIndex];

                      const endIndex = seg.end.vertex;
                      const endVertex = parsed.vertices[endIndex];

                      if (previousEnd !== startIndex) {
                        scratchPath.moveTo(startVertex.x, startVertex.y);
                        currentStart = startIndex;
                      }

                      if (
                        seg.start.dx === 0 &&
                        seg.start.dy === 0 &&
                        seg.end.dx === 0 &&
                        seg.end.dy === 0
                      ) {
                        scratchPath.lineTo(endVertex.x, endVertex.y);
                      } else {
                        scratchPath.cubicTo(
                          startVertex.x + seg.start.dx,
                          startVertex.y + seg.start.dy,
                          endVertex.x + seg.end.dx,
                          endVertex.y + seg.end.dy,
                          endVertex.x,
                          endVertex.y,
                        );
                      }

                      previousEnd = endIndex;
                      if (currentStart != null && endIndex === currentStart) {
                        scratchPath.close();
                        previousEnd = undefined;
                        currentStart = undefined;
                      }
                    }

                    builder.addPath(scratchPath.detach());
                  }

                  const path = builder.detachAndDelete();

                  node.properties.pathData = path.toSVGString();

                  switch (lastWinding) {
                    case "NONZERO": {
                      node.properties.fillRule = "nonzero";
                      break;
                    }

                    case "ODD": {
                      node.properties.fillRule = "evenodd";
                      break;
                    }
                  }

                  path.delete();
                  scratchPath.delete();
                }
              }
            }
          }
        }

        break;
      }

      case "TEXT": {
        node.type = "text";

        parseAndSetEffects(node.properties, data);

        if (data.props.textAlignVertical) {
          switch (data.props.textAlignVertical) {
            case "TOP": {
              node.properties.textAlignVertical = "top";
              break;
            }
            case "CENTER": {
              node.properties.textAlignVertical = "middle";
              break;
            }
            case "BOTTOM": {
              node.properties.textAlignVertical = "bottom";
              break;
            }
          }
        }

        if (data.props.fontName?.family != null) {
          node.properties.fontFamily = data.props.fontName.family;
          switch (data.props.fontName.style) {
            case "Thin": {
              node.properties.fontWeight = "100";
              break;
            }
            case "ExtraLight":
            case "Extra Light": {
              node.properties.fontWeight = "200";
              break;
            }
            case "Light": {
              node.properties.fontWeight = "300";
              break;
            }
            case "Regular": {
              node.properties.fontWeight = "normal";
              break;
            }
            case "Medium": {
              node.properties.fontWeight = "500";
              break;
            }
            case "SemiBold":
            case "Semi Bold": {
              node.properties.fontWeight = "600";
              break;
            }
            case "Bold": {
              node.properties.fontWeight = "700";
              break;
            }
            case "ExtraBold":
            case "Extra Bold": {
              node.properties.fontWeight = "800";
              break;
            }
            case "Black": {
              node.properties.fontWeight = "900";
              break;
            }
            case "ExtraBlack":
            case "Extra Black": {
              node.properties.fontWeight = "950";
              break;
            }
            default: {
              logger.warn(
                `Unsupported font weight ${data.props.fontName.style} during import.`,
              );
              break;
            }
          }
        }

        if (data.props.textData?.characters != null) {
          node.properties.textContent = data.props.textData.characters;
        }

        if (data.props.fontSize != null) {
          node.properties.fontSize = data.props.fontSize;
        }

        if (data.props.letterSpacing) {
          switch (data.props.letterSpacing.units) {
            case "RAW": {
              node.properties.letterSpacing = data.props.letterSpacing.value;
              break;
            }
            case "PIXELS": {
              node.properties.letterSpacing = data.props.letterSpacing.value;
              break;
            }
            case "PERCENT": {
              node.properties.letterSpacing =
                (data.props.letterSpacing.value / 100) *
                (data.props.fontSize ?? 1);
              break;
            }
          }
        }

        if (data.props.textAlignHorizontal) {
          switch (data.props.textAlignHorizontal) {
            case "LEFT": {
              node.properties.textAlign = "left";
              break;
            }
            case "CENTER": {
              node.properties.textAlign = "center";
              break;
            }
            case "RIGHT": {
              node.properties.textAlign = "right";
              break;
            }
            case "JUSTIFIED": {
              node.properties.textAlign = "justify";
              break;
            }
          }
        }

        if (data.props.lineHeight) {
          switch (data.props.lineHeight.units) {
            case "RAW": {
              node.properties.lineHeight = data.props.lineHeight.value;
              break;
            }
            case "PIXELS": {
              node.properties.lineHeight =
                data.props.lineHeight.value / (data.props.fontSize ?? 1);
              break;
            }
            case "PERCENT": {
              if (data.props.lineHeight.value !== 100) {
                logger.warn("Line Height has percent value that's not 100%");
              }

              // NOTE(sedivy): We need to distinguish between `auto` line height
              // and explicit percentage. auto will produce { PERCENT, 100 }
              // while setting percentage will create { RAW, 1 }.
              //
              // The reason why we need to know about `auto` is because 100% and
              // `auto` will produce different visual result.
              //
              // My assumption is PERCENT is used to set auto and RAW and PIXELS
              // are the explicit heights.

              node.properties.lineHeight = 0;
              break;
            }
          }
        }

        switch (data.props.textAutoResize ?? "NONE") {
          case "NONE": {
            node.properties.textGrowth = "fixed-width-height";
            break;
          }

          case "WIDTH_AND_HEIGHT": {
            node.properties.textGrowth = "auto";
            break;
          }

          case "HEIGHT": {
            node.properties.textGrowth = "fixed-width";
            break;
          }
        }

        if (data.props.size) {
          node.properties.width = data.props.size.x;
          node.properties.height = data.props.size.y;
        }

        parseAndSetFillPaints(node.properties, data);
        break;
      }

      case "RECTANGLE":
      case "LINE":
      case "ELLIPSE":
      case "REGULAR_POLYGON":
      case "ROUNDED_RECTANGLE": {
        switch (type) {
          case "LINE": {
            node.type = "line";
            break;
          }
          case "ELLIPSE": {
            node.type = "ellipse";
            break;
          }
          case "ROUNDED_RECTANGLE": {
            node.type = "rectangle";
            break;
          }
          case "REGULAR_POLYGON": {
            node.type = "polygon";
            break;
          }
          case "RECTANGLE": {
            node.type = "rectangle";
            break;
          }

          default: {
            const missing: never = type;
            logger.warn(`Unhandled shape type ${missing} during import.`);
            return null;
          }
        }

        if (data.props.count != null) {
          node.properties.polygonCount = data.props.count;
        }

        parseAndSetStroke(node.properties, data);
        parseAndSetEffects(node.properties, data);

        if (data.props.size) {
          node.properties.width = data.props.size.x;
          node.properties.height = data.props.size.y;
        }

        parseCornerRadius(node.properties, data);

        parseAndSetFillPaints(node.properties, data);

        break;
      }

      default: {
        logger.warn(
          `Unsupported figma node type "${data.props.type}" during import.`,
        );
        return null;
      }
    }

    if (data.children) {
      for (let i = data.children.length - 1; i >= 0; i--) {
        const converted = this.convertNode(data.children[i], node);
        if (converted) {
          node.children.push(converted);
        }
      }
    }

    return node as SerializedNode;
  }

  parseVectorNetworkBlob(bytes: Uint8Array): VectorNetwork | undefined {
    const view = new DataView(bytes.buffer);
    let offset = 0;

    if (bytes.length < 12) return;
    const vertexCount = view.getUint32(0, true);
    const segmentCount = view.getUint32(4, true);
    const regionCount = view.getUint32(8, true);
    const vertices = [];
    const segments = [];
    const regions = [];
    offset += 12;

    for (let i = 0; i < vertexCount; i++) {
      if (offset + 12 > bytes.length) return;
      vertices.push({
        styleID: view.getUint32(offset + 0, true),
        x: view.getFloat32(offset + 4, true),
        y: view.getFloat32(offset + 8, true),
      });
      offset += 12;
    }

    for (let i = 0; i < segmentCount; i++) {
      if (offset + 28 > bytes.length) return;
      const startVertex = view.getUint32(offset + 4, true);
      const endVertex = view.getUint32(offset + 16, true);
      if (startVertex >= vertexCount || endVertex >= vertexCount) return;
      segments.push({
        styleID: view.getUint32(offset + 0, true),
        start: {
          vertex: startVertex,
          dx: view.getFloat32(offset + 8, true),
          dy: view.getFloat32(offset + 12, true),
        },
        end: {
          vertex: endVertex,
          dx: view.getFloat32(offset + 20, true),
          dy: view.getFloat32(offset + 24, true),
        },
      });
      offset += 28;
    }

    for (let i = 0; i < regionCount; i++) {
      if (offset + 8 > bytes.length) return;
      let styleID = view.getUint32(offset, true);
      const windingRule = styleID & 1 ? "NONZERO" : "ODD";
      styleID >>= 1;
      const loopCount = view.getUint32(offset + 4, true);
      const loops = [];
      offset += 8;

      for (let j = 0; j < loopCount; j++) {
        if (offset + 4 > bytes.length) return;
        const indexCount = view.getUint32(offset, true);
        const indices = [];
        offset += 4;
        if (offset + indexCount * 4 > bytes.length) return;
        for (let k = 0; k < indexCount; k++) {
          const segment = view.getUint32(offset, true);
          if (segment >= segmentCount) return;
          indices.push(segment);
          offset += 4;
        }
        loops.push({ segments: indices });
      }

      regions.push({ styleID, windingRule, loops });
    }

    return { vertices, segments, regions };
  }

  parseCommandsBlob(bytes: Uint8Array) {
    const view = new DataView(bytes.buffer);
    let offset = 0;

    const path: (string | number)[] = [];
    while (offset < bytes.length) {
      switch (bytes[offset++]) {
        case 0: {
          path.push("Z");
          break;
        }

        case 1: {
          if (offset + 8 > bytes.length) return;
          path.push(
            "M",
            view.getFloat32(offset, true),
            view.getFloat32(offset + 4, true),
          );
          offset += 8;
          break;
        }

        case 2: {
          if (offset + 8 > bytes.length) return;
          path.push(
            "L",
            view.getFloat32(offset, true),
            view.getFloat32(offset + 4, true),
          );
          offset += 8;
          break;
        }

        case 3: {
          if (offset + 16 > bytes.length) return;
          path.push(
            "Q",
            view.getFloat32(offset, true),
            view.getFloat32(offset + 4, true),
            view.getFloat32(offset + 8, true),
            view.getFloat32(offset + 12, true),
          );
          offset += 16;
          break;
        }

        case 4: {
          if (offset + 24 > bytes.length) return;
          path.push(
            "C",
            view.getFloat32(offset, true),
            view.getFloat32(offset + 4, true),
            view.getFloat32(offset + 8, true),
            view.getFloat32(offset + 12, true),
            view.getFloat32(offset + 16, true),
            view.getFloat32(offset + 20, true),
          );
          offset += 24;
          break;
        }

        default: {
          return;
        }
      }
    }
    return path;
  }
}

function flipSegment(segment: VectorSegment): void {
  const tmpVertex = segment.start.vertex;
  const tmpDx = segment.start.dx;
  const tmpDy = segment.start.dy;

  segment.start.vertex = segment.end.vertex;
  segment.start.dx = segment.end.dx;
  segment.start.dy = segment.end.dy;

  segment.end.vertex = tmpVertex;
  segment.end.dx = tmpDx;
  segment.end.dy = tmpDy;
}

function reorderSegmentPoints(segments: VectorSegment[]): VectorSegment[] {
  if (segments.length < 2) {
    return segments;
  }

  const result: VectorSegment[] = structuredClone(segments);

  if (
    result[0].end.vertex !== result[1].start.vertex &&
    result[0].end.vertex !== result[1].end.vertex
  ) {
    flipSegment(result[0]);
  }

  for (let i = 1; i < result.length; i++) {
    if (result[i - 1].end.vertex !== result[i].start.vertex) {
      flipSegment(result[i]);
    }
  }

  return result;
}

function parseSizingBehavior(data: FigmaNode, axis: Axis): SizingBehavior {
  const counterAxis =
    axis === Axis.Horizontal ? Axis.Vertical : Axis.Horizontal;

  let parentAxis = null;
  if (data.parent) {
    if (data.parent.props.stackMode === "VERTICAL") {
      parentAxis = Axis.Vertical;
    } else if (data.parent.props.stackMode === "HORIZONTAL") {
      parentAxis = Axis.Horizontal;
    }
  }

  let selfMode = null;
  if (data.props.stackMode === "VERTICAL") {
    selfMode = Axis.Vertical;
  } else if (data.props.stackMode === "HORIZONTAL") {
    selfMode = Axis.Horizontal;
  }

  if (
    (parentAxis === counterAxis &&
      data.props.stackChildAlignSelf === "STRETCH") ||
    (parentAxis === axis && data.props.stackChildPrimaryGrow)
  ) {
    return SizingBehavior.FillContainer;
  }

  if (
    selfMode === counterAxis &&
    data.props.stackCounterSizing === "RESIZE_TO_FIT_WITH_IMPLICIT_SIZE"
  ) {
    return SizingBehavior.FitContent;
  }

  if (
    (selfMode === axis && data.props.stackPrimarySizing === "FIXED") ||
    (parentAxis === axis && data.props.stackChildPrimaryGrow)
  ) {
    return SizingBehavior.Fixed;
  }

  return selfMode === axis ? SizingBehavior.FitContent : SizingBehavior.Fixed;
}

function parseLayout(
  figmaConverter: FigmaConverter,
  properties: NodeProperties,
  data: FigmaNode,
) {
  properties.layoutMode = LayoutMode.None;

  switch (data.props.stackMode) {
    case "NONE": {
      properties.layoutMode = LayoutMode.None;
      break;
    }
    case "HORIZONTAL": {
      properties.layoutMode = LayoutMode.Horizontal;
      break;
    }
    case "VERTICAL": {
      properties.layoutMode = LayoutMode.Vertical;
      break;
    }
    case "GRID": {
      logger.warn(`Unsupported grid layout during import.`);
      break;
    }
  }

  properties.layoutChildSpacing = data.props.stackSpacing ?? 0;

  properties.layoutPadding = [
    data.props.stackVerticalPadding ?? 0,
    data.props.stackPaddingRight ?? 0,
    data.props.stackPaddingBottom ?? 0,
    data.props.stackHorizontalPadding ?? 0,
  ];

  if (data.props.bordersTakeSpace) {
    properties.layoutIncludeStroke = true;
  }

  switch (data.props.stackPrimaryAlignItems) {
    case "MIN": {
      properties.layoutJustifyContent = JustifyContent.Start;
      break;
    }
    case "CENTER": {
      properties.layoutJustifyContent = JustifyContent.Center;
      break;
    }
    case "MAX": {
      properties.layoutJustifyContent = JustifyContent.End;
      break;
    }
    case "SPACE_EVENLY": {
      // NOTE(sedivy): As far as I know, Figma generates SPACE_EVENLY,
      // but it behaves exactly like SPACE_BETWEEN and there isn't even
      // a button in their UI to select it.
      properties.layoutJustifyContent = JustifyContent.SpaceBetween;
      break;
    }
    case "SPACE_BETWEEN": {
      properties.layoutJustifyContent = JustifyContent.SpaceBetween;
      break;
    }
  }

  switch (data.props.stackCounterAlignItems) {
    case "MIN": {
      properties.layoutAlignItems = AlignItems.Start;
      break;
    }
    case "CENTER": {
      properties.layoutAlignItems = AlignItems.Center;
      break;
    }
    case "MAX": {
      properties.layoutAlignItems = AlignItems.End;
      break;
    }
    case "BASELINE": {
      logger.warn(`Unsupported align BASELINE during import.`);
      properties.layoutAlignItems = AlignItems.Start;
      break;
    }
  }

  properties.horizontalSizing = parseSizingBehavior(data, Axis.Horizontal);
  properties.verticalSizing = parseSizingBehavior(data, Axis.Vertical);
}

export function parseFigma(clipboard: string): DesignFile | null {
  const metaStart = "<!--(figmeta)";
  const metaEnd = "(/figmeta)-->";

  const figmaStart = "<!--(figma)";
  const figmaEnd = "(/figma)-->";

  const parser = new DOMParser();
  const doc = parser.parseFromString(clipboard, "text/html");

  const metaElement = doc.querySelector("[data-metadata]");
  if (!(metaElement instanceof HTMLElement)) {
    return null;
  }

  const bufferElement = doc.querySelector("[data-buffer]");
  if (!(bufferElement instanceof HTMLElement)) {
    return null;
  }

  const metaRaw = metaElement.dataset.metadata;
  if (!metaRaw) {
    return null;
  }

  const bufferRaw = bufferElement.dataset.buffer;
  if (!bufferRaw) {
    return null;
  }

  const metaBase64 = metaRaw.substring(
    metaStart.length,
    metaRaw.length - metaEnd.length,
  );
  const bufferBase64 = bufferRaw.substring(
    figmaStart.length,
    bufferRaw.length - figmaEnd.length,
  );

  const meta = JSON.parse(atob(metaBase64));

  const buffer = Uint8Array.from(atob(bufferBase64), (c) => c.charCodeAt(0));

  const { header, files } = FigmaArchiveParser.parseArchive(buffer);

  const schemaCompressed = files[0];
  const dataCompressed = files[1];

  const schema = decodeBinarySchema(inflateRaw(schemaCompressed));
  const compiledSchema = compileSchema(schema);

  const decoded: FigmaSchema.Message = compiledSchema.decodeMessage(
    inflateRaw(dataCompressed),
  );

  const nodeChanges = decoded.nodeChanges;
  if (!nodeChanges) {
    return null;
  }

  const blobs = decoded.blobs;

  const nodes = new Map<string, FigmaNode>();

  const orderByPosition = (a: FigmaNode, b: FigmaNode): number => {
    return (
      // @ts-expect-error
      (a.props.parentIndex?.position < b.props.parentIndex?.position) -
      // @ts-expect-error
      (a.props.parentIndex?.position > b.props.parentIndex?.position)
    );
  };

  for (const node of nodeChanges) {
    if (node.guid) {
      const { sessionID, localID } = node.guid;
      nodes.set(`${sessionID}:${localID}`, {
        props: node,
        children: null,
        parent: null,
      });
    }
  }

  for (const [_, node] of nodes) {
    if (node.props.parentIndex) {
      const parent = nodes.get(
        `${node.props.parentIndex.guid.sessionID}:${node.props.parentIndex.guid.localID}`,
      );
      if (parent) {
        parent.children ||= [];
        parent.children.push(node);
        node.parent = parent;
      }
    }
  }

  for (const [_, node] of nodes) {
    if (node.children) {
      node.children.sort(orderByPosition);
    }
  }

  const root = nodes.get("0:0");
  if (!root) {
    return null;
  }

  if (root.children == null) {
    return null;
  }

  const converter = new FigmaConverter(nodes, blobs);

  const page = root.children[1];

  const children: SerializedNode[] = [];

  converter.detachInstance(page);

  if (page.children) {
    for (let i = page.children.length - 1; i >= 0; i--) {
      const converted = converter.convertNode(page.children[i], null);
      if (converted) {
        children.push(converted);
      }
    }
  }

  return {
    version: "1.0",
    children: children,
  };
}
