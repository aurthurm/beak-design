import type {
  CanHaveGraphics,
  Connection,
  Document,
  Effect,
  Effects,
  Ellipse,
  Fills,
  Frame,
  Group,
  IconFont,
  Line,
  Note,
  Path,
  Rectangle,
  Stroke,
  Text,
} from "@ha/schema";
import { logger } from "@ha/shared";
import { v4 as uuidv4 } from "uuid";
import { colorToHex, hexToColor } from "../skia";
import { degToRad, radToDeg } from "../utils/math";

// Inlined types from the current format (will be removed in new version)

export type NodeType =
  | "group"
  | "frame"
  | "text"
  | "path"
  | "rectangle"
  | "ellipse"
  | "line"
  | "polygon"
  | "icon"
  | "image"
  | "sticky_note"
  | "icon_font";

export interface ColorStop {
  offset: number; // 0 to 1
  color: string; // Hex string or color name
}

export interface LinearGradientData {
  type: "linear";
  x1: number; // Absolute coords relative to node top-left (0,0)
  y1: number;
  x2: number;
  y2: number;
  stops: ColorStop[];
}

export interface RadialGradientData {
  type: "radial";
  x1: number; // Start circle center x (relative to node top-left 0,0)
  y1: number; // Start circle center y
  r1: number; // Start circle radius
  x2: number; // End circle center x (relative to node top-left 0,0)
  y2: number; // End circle center y
  r2: number; // End circle radius
  stops: ColorStop[];
}

export interface DropShadowFilterData {
  enabled: boolean;
  color?: string;
  alpha?: number;
  blur?: number;
  offset?: { x: number; y: number };
  spread?: number;
}

export interface NodeProperties {
  name?: string;
  disabled?: boolean;

  width: number;
  height: number;

  // Transform
  x: number;
  y: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;

  fillColor?: string | null;
  frameMaskDisabled?: boolean;
  fillGradient?: LinearGradientData | RadialGradientData;
  strokeColor?: string | null;
  strokeWidth?: number;
  strokeAlignment?: number;
  lineJoin?: "miter" | "bevel" | "round";
  lineCap?: "none" | "square" | "round";
  opacity?: number;
  textContent?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  textAlignVertical?: "top" | "middle" | "bottom";
  textGrowth?: "auto" | "fixed-width" | "fixed-width-height";
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: "normal" | "italic" | "oblique";
  cornerRadius?: number;
  iconFontName?: string;
  iconFontFamily?: string;
  imageUrl?: string;
  blurFilter?: number;
  dropShadowFilter?: DropShadowFilterData;
  pathData?: string;

  // TODO(sedivy): Store this outside of properties. This should not be serialized.
  _normalizedPathSize?: { x: number; y: number };
}

// Define the structure for the serialized node in the JSON file
export interface SerializedNode {
  id: string;
  type: NodeType;
  properties: NodeProperties;
  children: SerializedNode[];
}

// Union type for all possible schema nodes
export type SchemaNode =
  | Frame
  | Group
  | Rectangle
  | Ellipse
  | Line
  | Path
  | Text
  | Connection
  | Note
  | IconFont;

export function convertLegacySchema(data: any): Document {
  if (data.version === "1.0") {
    data = convertLegacySchema_1_0(data);
  }
  if (data.version === "2.0") {
    data = convertLegacySchema_2_0(data);
  }
  if (data.version === "2.1") {
    data = convertLegacySchema_2_1(data);
  }
  if (data.version === "2.2") {
    data = convertLegacySchema_2_2(data);
  }
  if (data.version === "2.3") {
    data = convertLegacySchema_2_3(data);
  }
  if (data.version === "2.4") {
    data = convertLegacySchema_2_4(data);
  }
  if (data.version === "2.5") {
    data = convertLegacySchema_2_5(data);
  }
  return data;
}

function convertLegacySchema_1_0(data: any): Document {
  // 1.0 -> 2.0
  // Changes:
  // - complete rewrite

  const children = [];

  if (data.children) {
    for (const child of data.children) {
      const converted = convertNode(child);
      if (converted) {
        children.push(converted);
      }
    }
  }

  if (data.connections) {
    for (const connection of data.connections) {
      const entity: Connection = {
        type: "connection",
        id: connection.id || uuidv4(),
        x: 0,
        y: 0,
        source: {
          path: connection.sourceNodeId,
          anchor: connection.sourceAnchor,
        },
        target: {
          path: connection.targetNodeId,
          anchor: connection.targetAnchor,
        },
      };

      children.push(entity);
    }
  }

  return {
    version: "2.0",
    children: children,
  };
}

function convertLegacySchema_2_0(data: any): Document {
  // 2.0 -> 2.1
  // Changes:
  // - `frameMaskDisabled` flag was replaced with `clip` flag
  // - `disabled` flags were replaced with `enabled` flags

  const converted = structuredClone(data);
  const replaceProperties = (obj: any) => {
    if (typeof obj === "object") {
      if ("frameMaskDisabled" in obj) {
        obj.clip = !obj.frameMaskDisabled;
        delete obj.frameMaskDisabled;
      }
      if ("disabled" in obj) {
        obj.enabled = !obj.disabled;
        delete obj.disabled;
      }
      Object.values(obj).forEach(replaceProperties);
    }
  };
  replaceProperties(converted);
  converted.version = "2.1";
  return converted;
}

function convertLegacySchema_2_1(data: any): Document {
  // 2.1 -> 2.2
  // Changes:
  // - Updated the format of the overrides of `ref` nodes.

  const converted = structuredClone(data);
  const updateRefs = (obj: any) => {
    if (typeof obj === "object") {
      if (Array.isArray(obj)) {
        obj.forEach(updateRefs);
      } else if ("type" in obj && obj.type === "ref" && "overrides" in obj) {
        const overrides = obj.overrides;
        delete obj.overrides;
        for (const override of overrides) {
          if (
            !("property" in override) ||
            typeof override.property !== "string" ||
            !("value" in override)
          ) {
            continue;
          }
          let target;
          if ("path" in override) {
            if (typeof override.path !== "string") {
              continue;
            }
            if (!obj.descendants) {
              obj.descendants = {};
            }
            if (!obj.descendants[override.path]) {
              obj.descendants[override.path] = {};
            }
            target = obj.descendants[override.path];
          } else {
            target = obj;
          }
          target[override.property] = override.value;
        }
      } else {
        Object.values(obj).forEach(updateRefs);
      }
    }
  };
  updateRefs(converted);
  converted.version = "2.2";
  return converted;
}

function convertLegacySchema_2_2(data: any): Document {
  // 2.2 -> 2.3
  // Changes:
  // - Removed ImageNode and migrated all images to rectangle image fills

  const converted = structuredClone(data);

  const migrateImages = (node: any) => {
    if (node.type === "image") {
      node.type = "rectangle";
      delete node.imageUrl;
      node.fill = {
        type: "image",
        url: node.url,
        mode: "fill",
      };
    }

    if (node.children) {
      for (const child of node.children) {
        migrateImages(child);
      }
    }
  };

  if (converted.children) {
    for (const child of converted.children) {
      migrateImages(child);
    }
  }
  converted.version = "2.3";
  return converted;
}

function convertLegacySchema_2_3(data: any): Document {
  // 2.3 -> 2.4
  // Changes:
  // - Inline `layout` object into many top level properties
  // - Make frame `clip` default to false
  // - Make `layout` default to 'horizontal' for frames
  // - Make frame width and height default to fit_content
  const converted = structuredClone(data);

  const migrateNode = (node: any) => {
    const layout = node.layout;
    delete node.layout;

    if (node.type === "frame" || node.type === "group") {
      if (layout) {
        node.layout = layout.mode ?? "none";
        node.gap = layout.spacing;
        node.layoutIncludeStroke = layout.includeStroke;
        node.padding = layout.padding;
        node.justifyContent = layout.justify;
        node.alignItems = layout.align;
      } else {
        node.layout = "none";
      }
    }

    if (node.type === "frame") {
      if (node.width == null) {
        node.width = 0;
      }

      if (node.height == null) {
        node.height = 0;
      }

      if (node.clip == null) {
        node.clip = true;
      }
    }

    if (node.children) {
      for (const child of node.children) {
        migrateNode(child);
      }
    }
  };

  if (converted.children) {
    for (const child of converted.children) {
      migrateNode(child);
    }
  }

  converted.version = "2.4";
  return converted;
}

function convertLegacySchema_2_4(data: any): Document {
  // 2.4 -> 2.5
  // Changes:
  // - Text node size property inlined into top-level width and height
  const converted = structuredClone(data);

  const migrateNode = (node: any) => {
    if (node.type === "text") {
      if (node.size != null) {
        if (node.size.width != null) {
          node.width = node.size.width;
        }

        if (node.size.height != null) {
          node.height = node.size.height;
        }

        delete node.size;
      }
    }

    if (node.children) {
      for (const child of node.children) {
        migrateNode(child);
      }
    }
  };

  if (converted.children) {
    for (const child of converted.children) {
      migrateNode(child);
    }
  }

  converted.version = "2.5";
  return converted;
}

function convertLegacySchema_2_5(data: any): Document {
  // 2.5 -> 2.6
  // Changes:
  // - Gradient rotation now follows CSS default direction. The rotation still remains counterclockwise (0°=up, 90°=left, 180°=down)
  // - Gradient size.height now controls linear gradient length, size.width is perpendicular
  // - Linear gradient center is now in the middle of the gradient and not the start point
  // - Fix linear gradient length being double what was expected
  const converted = structuredClone(data);

  const migrateGradient = (fill: any) => {
    if (fill.type !== "gradient") {
      return;
    }

    const oldWidth: string | number = fill.size?.width ?? 1;
    const oldHeight: string | number = fill.size?.height ?? 1;

    const centerX: number = fill.center?.x ?? 0.5;
    const centerY: number = fill.center?.y ?? 0.5;

    fill.size.width = oldHeight;
    if (fill.gradientType === "linear" && typeof oldWidth === "number") {
      fill.size.height = oldWidth / 2;
    } else {
      fill.size.height = oldWidth;
    }

    if (
      fill.gradientType === "linear" &&
      typeof fill.rotation === "number" &&
      typeof fill.size.height === "number"
    ) {
      const rotation = degToRad(fill.rotation * -1);
      const shift = fill.size.height / 2;

      fill.center = {
        x: centerX + Math.sin(rotation) * shift,
        y: centerY - Math.cos(rotation) * shift,
      };
    }
  };

  const convertFill = (fill: any) => {
    if (Array.isArray(fill)) {
      for (const item of fill) {
        migrateGradient(item);
      }
    } else if (typeof fill === "object") {
      migrateGradient(fill);
    }
  };

  const migrateNode = (node: any) => {
    if (node.fill) {
      convertFill(node.fill);
    }

    if (node.stroke?.fill) {
      convertFill(node.stroke.fill);
    }

    if (node.children) {
      for (const child of node.children) {
        migrateNode(child);
      }
    }

    if (node.descendants) {
      for (const descendant of Object.values(node.descendants)) {
        migrateNode(descendant);
      }
    }
  };

  if (converted.children) {
    for (const child of converted.children) {
      migrateNode(child);
    }
  }

  converted.version = "2.6";
  return converted;
}

function convertNode(node: SerializedNode): SchemaNode | null {
  const props = node.properties ?? {};

  // Base properties all nodes have
  const baseProps: Partial<SchemaNode> = {
    id: node.id || uuidv4(),
    x: props.x ?? 0,
    y: props.y ?? 0,

    ...(props.flipX && { flipX: true }),
    ...(props.flipY && { flipY: true }),

    ...(props.disabled && { disabled: true }),

    ...(props.rotation && { rotation: radToDeg(props.rotation) * -1 }),

    ...(props.opacity != null &&
      props.opacity !== 1 && { opacity: props.opacity }),

    ...(needsStroke(props) && { stroke: convertStroke(props) }),
    ...(needsEffects(props) && { effect: convertEffects(props) }),
  };

  if (needsFill(props)) {
    const fill = convertFill(props);
    if (fill != null) {
      (baseProps as CanHaveGraphics).fill = fill;
    }
  }

  // Convert based on node type
  switch (node.type) {
    case "frame":
      return {
        type: "frame",
        ...baseProps,
        width: props.width ?? 0,
        height: props.height ?? 0,
        ...(props.cornerRadius && { cornerRadius: props.cornerRadius }),
        ...(props.frameMaskDisabled !== undefined && {
          frameMaskDisabled: props.frameMaskDisabled,
        }),
        ...(node.children?.length && {
          children: node.children.map(convertNode),
        }),
      } as Frame;

    case "group":
      return {
        type: "group",
        ...baseProps,
        ...(node.children?.length && {
          children: node.children.map(convertNode),
        }),
      } as Group;

    case "rectangle":
      return {
        type: "rectangle",
        ...baseProps,
        width: props.width ?? 0,
        height: props.height ?? 0,
        ...(props.cornerRadius && { cornerRadius: props.cornerRadius }),
      } as Rectangle;

    case "ellipse":
      return {
        type: "ellipse",
        ...baseProps,
        width: props.width ?? 0,
        height: props.height ?? 0,
      } as Ellipse;

    case "line":
      return {
        type: "line",
        ...baseProps,
        width: props.width ?? 0,
        height: props.height ?? 0,
      } as Line;

    case "path":
      return {
        type: "path",
        ...baseProps,
        width: props.width ?? 0,
        height: props.height ?? 0,
        ...(props.pathData && { geometry: props.pathData }),
      } as Path;
    case "text": {
      const result = {
        type: "text",
        ...baseProps,
        ...(props.textContent && { content: props.textContent }),
        ...(props.fontFamily && { fontFamily: props.fontFamily }),
        ...(props.fontSize && { fontSize: props.fontSize }),
        ...(props.fontWeight && { fontWeight: String(props.fontWeight) }),
        ...(props.fontStyle &&
          props.fontStyle !== "normal" && { fontStyle: props.fontStyle }),
        ...(props.letterSpacing && { letterSpacing: props.letterSpacing }),
        ...(props.textGrowth && { textGrowth: props.textGrowth }),
        ...(props.lineHeight && { lineHeight: props.lineHeight }),
        ...(props.textAlign && { textAlign: props.textAlign }),
      } as Text;

      switch (props.textAlignVertical as string) {
        case "top": {
          result.textAlignVertical = "top";
          break;
        }

        case "center":
        case "middle": {
          result.textAlignVertical = "middle";
          break;
        }

        case "bottom": {
          result.textAlignVertical = "bottom";
          break;
        }
      }

      switch (props.textGrowth) {
        case "auto": {
          break;
        }

        case "fixed-width": {
          result.width = props.width ?? 0;
          break;
        }

        case "fixed-width-height": {
          result.width = props.width ?? 0;
          result.height = props.height ?? 0;
          break;
        }
      }

      return result;
    }

    case "sticky_note":
      return {
        type: "note",
        ...baseProps,
        width: props.width ?? 0,
        height: props.height ?? 0,
        ...(props.textContent && { content: props.textContent }),
        ...(props.fontFamily && { fontFamily: props.fontFamily }),
        ...(props.fontSize && { fontSize: props.fontSize }),
        ...(props.fontWeight && { fontWeight: String(props.fontWeight) }),
        ...(props.fontStyle &&
          props.fontStyle !== "normal" && { fontStyle: props.fontStyle }),
        ...(props.letterSpacing && { letterSpacing: props.letterSpacing }),
        ...(props.fillColor && { color: props.fillColor }),
      } as Note;

    case "icon_font":
      return {
        type: "icon_font",
        ...baseProps,
        width: props.width ?? 0,
        height: props.height ?? 0,
        ...(props.iconFontName && { iconFontName: props.iconFontName }),
        ...(props.iconFontFamily && { iconFontFamily: props.iconFontFamily }),
      } as IconFont;
  }

  logger.error("Failed to convert legacy node with data", node);

  return null;
}

function needsFill(props: NodeProperties): boolean {
  if (props.fillColor != null && props.fillColor !== "transparent") {
    return true;
  }

  if (props.fillGradient != null) {
    return true;
  }

  return false;
}

function needsStroke(props: NodeProperties): boolean {
  return !!(props.strokeColor && props.strokeWidth);
}

function needsEffects(props: NodeProperties): boolean {
  return (
    !!(props.blurFilter && props.blurFilter > 0) ||
    !!props.dropShadowFilter?.enabled
  );
}

function convertFill(props: NodeProperties): Fills | null {
  if (props.fillGradient) {
    return null;
  }

  if (props.fillColor != null) {
    const value = legacyRgbToHex(props.fillColor);
    if (value != null) {
      return value;
    }

    return props.fillColor;
  }

  return "#000000";
}

function convertStroke(props: NodeProperties): Stroke {
  const stroke: Stroke = {};

  if (props.strokeWidth) {
    stroke.thickness = props.strokeWidth;
  }

  if (props.lineJoin) {
    stroke.join = props.lineJoin;
  }

  if (props.strokeColor) {
    stroke.fill = props.strokeColor;
  }

  switch (props.strokeAlignment) {
    case 0: {
      stroke.align = "outside";
      break;
    }
    case 0.5: {
      stroke.align = "center";
      break;
    }
    case 1.0: {
      stroke.align = "inside";
      break;
    }
  }

  stroke.cap = props.lineCap;

  return stroke;
}

function convertEffects(props: NodeProperties): Effects {
  const effects: Effect[] = [];

  if (props.blurFilter && props.blurFilter > 0) {
    effects.push({
      type: "blur",
      radius: props.blurFilter,
    });
  }

  if (props.dropShadowFilter?.enabled) {
    const shadow = props.dropShadowFilter;

    const color = hexToColor(shadow.color ?? "#000000ff");
    color[3] *= shadow.alpha ?? 1;

    if (shadow.color) {
      effects.push({
        type: "shadow",
        shadowType: "outer",
        offset: {
          x: shadow.offset?.x ?? 0,
          y: shadow.offset?.y ?? 0,
        },
        blur: shadow.blur ?? 0,
        spread: shadow.spread ?? 0,
        color: colorToHex(color),
      });
    }
  }

  return effects.length === 1 ? effects[0] : effects;
}

function legacyRgbToHex(rgbString: string): string | null {
  const cleanString = rgbString.replace(/\s/g, "").toLowerCase();

  const rgbaMatch = cleanString.match(
    /^rgba?\((\d+),(\d+),(\d+)(?:,([0-9]*\.?[0-9]+))?\)$/,
  );

  if (!rgbaMatch) {
    return null;
  }

  const [, r, g, b, a] = rgbaMatch;

  const red = parseInt(r, 10);
  const green = parseInt(g, 10);
  const blue = parseInt(b, 10);
  const alpha = a !== undefined ? Math.min(1, Math.max(0, parseFloat(a))) : 1;

  if (
    red < 0 ||
    red > 255 ||
    green < 0 ||
    green > 255 ||
    blue < 0 ||
    blue > 255
  ) {
    return null;
  }

  const toHex = (value: number): string => {
    return Math.round(value).toString(16).padStart(2, "0");
  };

  const hexR = toHex(red);
  const hexG = toHex(green);
  const hexB = toHex(blue);
  const hexA = toHex(alpha * 255);

  if (alpha < 1) {
    return `#${hexR}${hexG}${hexB}${hexA}`;
  }

  return `#${hexR}${hexG}${hexB}`;
}
