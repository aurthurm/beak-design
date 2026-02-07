import type * as Schema from "@ha/schema";
import { logger } from "@ha/shared";
import { Matrix } from "pixi.js";
import * as svgo from "svgo";
import svgpath from "svgpath";
import * as svgson from "svgson";
import { SceneGraph } from "../canvas/scene-graph";
import { serializeRotation } from "../canvas/serializer";
import {
  convertFontWeightToSkiaEnum,
  convertFontWeightToSkiaVariation,
  Skia,
} from "../skia";
import { degToRad } from "../utils/math";
import fontIndex from "./data/font-index.json";
import type { SkiaFontManager } from "./skia-font-manager";

export function optimizeSvgPathData(path: string): string {
  return new svgpath(path).rel().round(5).toString();
}

function optimizeSvgString(input: string): string {
  const config: svgo.Config = {
    multipass: true,

    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            convertColors: {
              currentColor: "#000000",
              names2hex: true,
              rgb2hex: true,
              convertCase: false,
              shorthex: true,
              shortname: false,
            },
          },
        },
      },
      {
        name: "convertTransform",
        params: {
          convertToShorts: false,
          floatPrecision: 3,
          transformPrecision: 5,
          matrixToTransform: false,
          shortTranslate: false,
          shortScale: false,
          shortRotate: false,
          removeUseless: true,
          collapseIntoOne: true,
        },
      },
      "convertStyleToAttrs",
    ],
  };

  return svgo.optimize(input, config).data;
}

type ConvertedNode =
  | Schema.Frame
  | Schema.Group
  | Schema.Text
  | Schema.Ellipse
  | Schema.Path
  | Schema.Rectangle;

type SvgPropertyInfo = {
  inherits: boolean;
  initial: string | undefined;
};

const svgProperties: Record<string, SvgPropertyInfo> = {
  // https://www.w3.org/TR/SVG/propidx.html
  "alignment-baseline": { inherits: false, initial: "auto" },
  "baseline-shift": { inherits: false, initial: "baseline" },
  color: { inherits: true, initial: "currentColor" },
  "color-interpolation": { inherits: true, initial: "sRGB" },
  "color-rendering": { inherits: true, initial: "auto" },
  direction: { inherits: true, initial: "ltr" },
  display: { inherits: false, initial: "inline" },
  "dominant-baseline": { inherits: true, initial: "auto" },
  fill: { inherits: true, initial: "black" },
  "fill-opacity": { inherits: true, initial: "1" },
  "fill-rule": { inherits: true, initial: "nonzero" },
  "font-variant": { inherits: true, initial: "normal" },
  "glyph-orientation-vertical": { inherits: true, initial: "auto" },
  "image-rendering": { inherits: true, initial: "auto" },
  "line-height": { inherits: true, initial: "normal" },
  marker: { inherits: true, initial: "none" },
  "marker-end": { inherits: true, initial: "none" },
  "marker-mid": { inherits: true, initial: "none" },
  "marker-start": { inherits: true, initial: "none" },
  opacity: { inherits: false, initial: "1" },
  overflow: { inherits: false, initial: "visible" },
  "paint-order": { inherits: true, initial: "normal" },
  "pointer-events": { inherits: true, initial: "visiblePainted" },
  "shape-rendering": { inherits: true, initial: "auto" },
  "stop-color": { inherits: false, initial: "black" },
  "stop-opacity": { inherits: false, initial: "1" },
  stroke: { inherits: true, initial: "none" },
  "stroke-dasharray": { inherits: true, initial: "none" },
  "stroke-dashoffset": { inherits: true, initial: "0" },
  "stroke-linecap": { inherits: true, initial: "butt" },
  "stroke-linejoin": { inherits: true, initial: "miter" },
  "stroke-miterlimit": { inherits: true, initial: "4" },
  "stroke-opacity": { inherits: true, initial: "1" },
  "stroke-width": { inherits: true, initial: "1" },
  "text-anchor": { inherits: true, initial: "start" },
  "text-decoration": { inherits: false, initial: "none" },
  "text-rendering": { inherits: true, initial: "auto" },
  "vector-effect": { inherits: false, initial: "none" },
  visibility: { inherits: true, initial: "visible" },
  "white-space": { inherits: true, initial: "normal" },
  "writing-mode": { inherits: false, initial: "lr-tb" },

  // https://www.w3.org/TR/css-fonts-3/#propdef-font-size
  "font-size": { inherits: true, initial: "16" },
  // https://www.w3.org/TR/css-fonts-3/#propdef-font-family
  "font-family": { inherits: true, initial: undefined },
  // https://www.w3.org/TR/css-fonts-3/#propdef-font-weight
  "font-weight": { inherits: true, initial: "400" },
  // https://www.w3.org/TR/css-fonts-3/#propdef-font-style
  "font-style": { inherits: true, initial: "normal" },

  // https://svgwg.org/specs/strokes/#SpecifyingStrokeAlignment
  "stroke-alignment": { inherits: true, initial: "center" },
};

function getAttribute(
  attributes: Record<string, string>,
  property: keyof typeof svgProperties,
): string;
function getAttribute(
  attributes: Record<string, string>,
  property: string,
): string | undefined {
  return attributes[property] ?? svgProperties[property]?.initial;
}

function parseSvgNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const num = parseFloat(value);
  if (Number.isNaN(num)) {
    return undefined;
  }

  return num;
}

function parseLineCap(value: string): Schema.Stroke["cap"] | undefined {
  switch (value) {
    case "butt":
      // NOTE(sedivy): We don't have `butt` in our schema.
      return "none";
    case "round":
      return "round";
    case "square":
      return "square";
  }

  return "none";
}

function parseLineJoin(value: string): Schema.Stroke["join"] | undefined {
  switch (value) {
    case "miter":
      return "miter";
    case "round":
      return "round";
    case "bevel":
      return "bevel";
  }

  return "miter";
}

function parseStrokeAlign(
  value: string | undefined,
): Schema.Stroke["align"] | undefined {
  switch (value) {
    case "center":
      return "center";
    case "inner":
      return "inside";
    case "outer":
      return "outside";
  }

  return "center";
}

function parseColor(value: string | undefined): string | undefined {
  if (value === "currentColor") {
    return "#000000";
  }

  if (typeof value === "string" && value.startsWith("#")) {
    return value;
  }

  return undefined;
}

function parseFontFamily(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const validFont = fontIndex.find(
    (font) => font.name.toLowerCase() === value.toLowerCase(),
  );

  if (validFont) {
    return validFont.name;
  }

  return undefined;
}

function parseFontWeight(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  value = value.toLowerCase();

  const validWeights = [
    "normal",
    "bold",
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
    "950",
  ];

  if (validWeights.includes(value)) {
    return value;
  }

  return undefined;
}

function applyStroke(
  node: Schema.Rectangle | Schema.Path | Schema.Text | Schema.Ellipse,
  attributes: Record<string, string>,
): void {
  const strokeColor = parseColor(getAttribute(attributes, "stroke"));
  if (strokeColor) {
    node.stroke = {
      thickness: parseSvgNumber(getAttribute(attributes, "stroke-width")),
      cap: parseLineCap(getAttribute(attributes, "stroke-linecap")),
      join: parseLineJoin(getAttribute(attributes, "stroke-linejoin")),
      align: parseStrokeAlign(getAttribute(attributes, "stroke-alignment")),
      fill: strokeColor,
      miterAngle: parseSvgNumber(getAttribute(attributes, "stroke-miterlimit")),
    };
  }
}

function svgTransformToMatrix(transform: string): Matrix {
  const matrix = new Matrix();
  const regex = /(\w+)\s*\(([^)]+)\)/g;
  const matches = [...transform.matchAll(regex)];

  for (const match of matches) {
    const type = match[1];
    const values = match[2].split(/[\s,]+/).map(parseFloat);

    switch (type) {
      case "translate": {
        matrix.translate(values[0] || 0, values[1] || 0);
        break;
      }
      case "rotate": {
        matrix.rotate(degToRad(values[0]));
        break;
      }
      case "scale": {
        matrix.scale(values[0], values[1] ?? values[0]);
        break;
      }
      case "skewX": {
        matrix.append(new Matrix(1, 0, Math.tan(degToRad(values[0])), 1, 0, 0));
        break;
      }
      case "skewY": {
        matrix.append(new Matrix(1, Math.tan(degToRad(values[0])), 0, 1, 0, 0));
        break;
      }
      case "matrix": {
        matrix.append(
          new Matrix(
            values[0],
            values[1],
            values[2],
            values[3],
            values[4],
            values[5],
          ),
        );
        break;
      }
    }
  }

  return matrix;
}

function applyTransform(
  node: ConvertedNode,
  x: number,
  y: number,
  transform: string | undefined,
): void {
  node.x = x;
  node.y = y;

  if (transform) {
    const matrix = svgTransformToMatrix(transform);
    const decomposed = matrix.decompose({
      position: { x: 0, y: 0 },
      scale: { x: 0, y: 0 },
      pivot: { x: 0, y: 0 },
      skew: { x: 0, y: 0 },
      rotation: 0,
    });

    node.x += decomposed.position.x;
    node.y += decomposed.position.y;

    const rotation = serializeRotation(decomposed.rotation);
    if (rotation !== 0) {
      node.rotation = rotation;
    }
  }
}

function applyFill(
  node: Schema.Rectangle | Schema.Path | Schema.Text | Schema.Ellipse,
  attributes: Record<string, string>,
  defaultColor?: string,
): void {
  const fill = parseColor(getAttribute(attributes, "fill")) ?? defaultColor;
  if (fill) {
    node.fill = fill;
  }
}

function applyOpacity(
  node: ConvertedNode,
  attributes: Record<string, string>,
): void {
  const opacity = parseSvgNumber(getAttribute(attributes, "opacity"));
  if (opacity != null) {
    node.opacity = opacity;
  }
}

function getInheritableAttributes(
  attributes: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(attributes)) {
    const property = svgProperties[key];
    if (property?.inherits) {
      result[key] = value;
    }
  }

  return result;
}

function mergeAttributes(
  parentAttributes: Record<string, string>,
  childAttributes: Record<string, string>,
): Record<string, string> {
  return { ...getInheritableAttributes(parentAttributes), ...childAttributes };
}

async function convertSvgNode(
  fontManager: SkiaFontManager,
  title: string | null,
  svgNode: svgson.INode,
  attributes: Record<string, string>,
  symbols: Map<string, svgson.INode> = new Map(),
): Promise<ConvertedNode | null> {
  switch (svgNode.name) {
    case "svg": {
      const node: Schema.Frame = {
        id: SceneGraph.createUniqueID(),
        type: "frame",
        layout: "none",
        x: 0,
        y: 0,
      };

      if (title) {
        node.name = title;
      }

      const width = parseSvgNumber(svgNode.attributes.width);
      const height = parseSvgNumber(svgNode.attributes.height);

      const [_x, _y, viewBoxWidth, viewBoxHeight] = svgNode.attributes.viewBox
        ?.split(" ")
        .map(parseFloat) ?? [0, 0, 0, 0];

      node.width = width ?? viewBoxWidth;
      node.height = height ?? viewBoxHeight;

      // Extract symbols from defs
      for (const child of svgNode.children) {
        if (child.name === "defs") {
          for (const defChild of child.children) {
            if (defChild.name === "symbol" && defChild.attributes.id) {
              symbols.set(defChild.attributes.id, defChild);
            }
          }
        }
      }

      const children: Schema.Child[] = [];

      for (const child of svgNode.children) {
        const childNode = await convertSvgNode(
          fontManager,
          title,
          child,
          mergeAttributes(attributes, child.attributes),
          symbols,
        );
        if (childNode) {
          children.push(childNode);
        }
      }

      node.children = children;

      return node;
    }

    case "defs":
      // Skip defs - already processed for symbols
      return null;

    case "rect": {
      const node: Schema.Rectangle = {
        id: SceneGraph.createUniqueID(),
        type: "rectangle",
      };

      applyStroke(node, attributes);
      applyFill(node, attributes);
      applyOpacity(node, attributes);

      node.width = parseSvgNumber(attributes.width) ?? 0;
      node.height = parseSvgNumber(attributes.height) ?? 0;
      node.cornerRadius = parseSvgNumber(attributes.rx) ?? 0;

      applyTransform(
        node,
        parseSvgNumber(attributes.x) ?? 0,
        parseSvgNumber(attributes.y) ?? 0,
        attributes.transform,
      );

      return node;
    }

    case "a":
    case "g": {
      const node: Schema.Group = {
        id: SceneGraph.createUniqueID(),
        type: "group",
        x: 0,
        y: 0,
      };

      applyTransform(node, 0, 0, attributes.transform);
      applyOpacity(node, attributes);

      const children: Schema.Child[] = [];

      for (const child of svgNode.children) {
        const childNode = await convertSvgNode(
          fontManager,
          title,
          child,
          mergeAttributes(attributes, child.attributes),
          symbols,
        );
        if (childNode) {
          children.push(childNode);
        }
      }

      node.children = children;

      return node;
    }

    case "use": {
      const href = attributes.href || attributes["xlink:href"];
      if (!href) {
        return null;
      }

      const symbolId = href.replace("#", "");
      const symbol = symbols.get(symbolId);
      if (!symbol) {
        return null;
      }

      const group: Schema.Group = {
        id: SceneGraph.createUniqueID(),
        type: "group",
        x: 0,
        y: 0,
      };

      const x = parseSvgNumber(attributes.x) ?? 0;
      const y = parseSvgNumber(attributes.y) ?? 0;

      applyTransform(group, x, y, attributes.transform);
      applyOpacity(group, attributes);

      const children: Schema.Child[] = [];
      const symbolAttrs = mergeAttributes(attributes, symbol.attributes);

      for (const child of symbol.children) {
        const childNode = await convertSvgNode(
          fontManager,
          title,
          child,
          mergeAttributes(symbolAttrs, child.attributes),
          symbols,
        );
        if (childNode) {
          children.push(childNode);
        }
      }

      group.children = children;

      return group;
    }

    case "circle": {
      const node: Schema.Ellipse = {
        id: SceneGraph.createUniqueID(),
        type: "ellipse",
      };

      applyStroke(node, attributes);
      applyFill(node, attributes);
      applyOpacity(node, attributes);

      const cx = parseSvgNumber(attributes.cx) ?? 0;
      const cy = parseSvgNumber(attributes.cy) ?? 0;
      const r = parseSvgNumber(attributes.r) ?? 0;

      node.width = r * 2;
      node.height = r * 2;

      applyTransform(node, cx - r, cy - r, attributes.transform);

      return node;
    }

    case "ellipse": {
      const node: Schema.Ellipse = {
        id: SceneGraph.createUniqueID(),
        type: "ellipse",
      };

      applyStroke(node, attributes);
      applyFill(node, attributes);
      applyOpacity(node, attributes);

      const cx = parseSvgNumber(attributes.cx) ?? 0;
      const cy = parseSvgNumber(attributes.cy) ?? 0;
      const rx = parseSvgNumber(attributes.rx) ?? 0;
      const ry = parseSvgNumber(attributes.ry) ?? 0;

      node.width = rx * 2;
      node.height = ry * 2;

      applyTransform(node, cx - rx, cy - ry, attributes.transform);

      return node;
    }

    case "path": {
      const node: Schema.Path = {
        id: SceneGraph.createUniqueID(),
        type: "path",
      };

      applyStroke(node, attributes);
      applyFill(node, attributes);
      applyOpacity(node, attributes);

      if (!svgNode.attributes.d) {
        break;
      }

      const builder = new Skia.PathBuilder();

      const svgPath = Skia.Path.MakeFromSVGString(
        new svgpath(svgNode.attributes.d).unarc().toString(),
      );
      if (!svgPath) {
        break;
      }

      const bounds = svgPath.computeTightBounds();

      node.width = bounds[2] - bounds[0];
      node.height = bounds[3] - bounds[1];

      builder.addPath(svgPath);
      svgPath.delete();
      builder.offset(-bounds[0], -bounds[1]);

      const path = builder.detachAndDelete();

      node.geometry = optimizeSvgPathData(path.toSVGString());

      path.delete();

      applyTransform(node, bounds[0], bounds[1], attributes.transform);

      return node;
    }

    case "text": {
      const baseX = parseSvgNumber(attributes.x) ?? 0;
      const baseY = parseSvgNumber(attributes.y) ?? 0;

      const children: Schema.Child[] = [];
      const position = { x: baseX, y: baseY };

      async function processTextChildren(
        node: svgson.INode,
        attrs: Record<string, string>,
      ) {
        for (const child of node.children) {
          if (child.type === "text") {
            const content = decodeHTML(child.value).trim();
            if (!content) {
              continue;
            }

            const textNode: Schema.Text = {
              id: SceneGraph.createUniqueID(),
              type: "text",
              x: position.x,
              y: position.y,
              content,
            };

            applyStroke(textNode, attrs);
            applyFill(textNode, attrs, "#000000");
            applyOpacity(textNode, attrs);

            const fontSize =
              parseSvgNumber(getAttribute(attrs, "font-size")) ?? 16;
            const fontFamily = parseFontFamily(
              getAttribute(attrs, "font-family"),
            );
            const fontWeight = parseFontWeight(
              getAttribute(attrs, "font-weight"),
            );
            const textAnchor = getAttribute(attrs, "text-anchor");
            const dominantBaseline = getAttribute(attrs, "dominant-baseline");

            const size = await measureText(
              fontManager,
              content,
              fontSize,
              fontFamily,
              fontWeight,
            );

            switch (textAnchor) {
              case "middle":
                textNode.x = position.x - size.width / 2;
                break;
              case "end":
                textNode.x = position.x - size.width;
                break;
              default:
                textNode.x = position.x;
                break;
            }

            switch (dominantBaseline) {
              case "middle":
                textNode.y = position.y - size.height / 2;
                break;
              case "hanging":
              case "text-top":
                textNode.y = position.y;
                break;
              case "text-bottom":
                textNode.y = position.y - size.height;
                break;
              default:
                // alphabetic baseline - convert to top-left
                textNode.y = position.y - size.ascent;
                break;
            }

            textNode.fontWeight = fontWeight;
            textNode.fontSize = fontSize;
            textNode.fontFamily = fontFamily;

            children.push(textNode);

            position.x += size.width;
          } else if (child.name === "tspan") {
            const tspanAttrs = mergeAttributes(attrs, child.attributes);

            const dx = parseSvgNumber(child.attributes.dx) ?? 0;
            const dy = parseSvgNumber(child.attributes.dy) ?? 0;
            position.x += dx;
            position.y += dy;

            if (child.attributes.x) {
              position.x = parseSvgNumber(child.attributes.x) ?? position.x;
            }

            if (child.attributes.y) {
              position.y = parseSvgNumber(child.attributes.y) ?? position.y;
            }

            await processTextChildren(child, tspanAttrs);
          }
        }
      }

      await processTextChildren(svgNode, attributes);

      if (children.length === 1) {
        const textNode = children[0] as Schema.Text;
        applyTransform(
          textNode,
          textNode.x ?? 0,
          textNode.y ?? 0,
          attributes.transform,
        );
        return textNode;
      }

      const group: Schema.Group = {
        id: SceneGraph.createUniqueID(),
        type: "group",
        x: 0,
        y: 0,
        children,
      };

      applyTransform(group, 0, 0, attributes.transform);

      return group;
    }

    default: {
      logger.debug(`Unhandled SVG node '${svgNode.name}'`);
      break;
    }
  }

  return null;
}

function decodeHTML(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export async function convertSvgToNodes(
  fontManager: SkiaFontManager,
  title: string | null,
  input: string,
): Promise<ConvertedNode | null> {
  // NOTE(sedivy): Our parser heavily relies on the optimized svg structure to
  // only handle a subset of SVG features.
  const optimized = optimizeSvgString(input);

  const root = svgson.parseSync(optimized);

  return convertSvgNode(fontManager, title, root, root.attributes);
}

async function measureText(
  fontManager: SkiaFontManager,
  text: string,
  fontSize: number = 16,
  fontFamily: string = "Inter",
  fontWeight: string = "normal",
): Promise<{ width: number; height: number; ascent: number }> {
  const matchedFont = fontManager.matchFont(
    fontFamily,
    convertFontWeightToSkiaVariation(fontWeight),
    false,
  );

  if (matchedFont) {
    await fontManager.loadFont(matchedFont);
  }

  const builder = Skia.ParagraphBuilder.MakeFromFontProvider(
    new Skia.ParagraphStyle({
      applyRoundingHack: false,
      textStyle: {
        fontFamilies: fontManager.getFontList(matchedFont),
        fontSize: fontSize,
        halfLeading: true,
        fontStyle: {
          weight: convertFontWeightToSkiaEnum(fontWeight),
        },
        fontVariations: [
          {
            axis: "wght",
            value: convertFontWeightToSkiaVariation(fontWeight),
          },
        ],
      },
    }),
    fontManager.typefaceFontProvider,
  );

  builder.addText(text);
  const paragraph = builder.build();
  paragraph.layout(999999);
  const width = paragraph.getMaxIntrinsicWidth();
  const height = paragraph.getHeight();
  const ascent = paragraph.getAlphabeticBaseline();

  paragraph.delete();
  builder.delete();

  return { width, height, ascent };
}
