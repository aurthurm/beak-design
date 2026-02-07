import type * as Schema from "@ha/schema";
import { logger } from "@ha/shared";
import EventEmitter from "eventemitter3";
import ShortUniqueId from "short-unique-id";
import {
  createNodeProperties,
  deserializeRotation,
  deserializeToProperties,
  type SerializedNode,
  type VariableMapping,
} from "../managers/file-manager";
import type { SceneManager } from "../managers/scene-manager";
import {
  type Resolved,
  type Theme,
  themesEqual,
  type Value,
  Variable,
} from "../managers/variable-manager";
import {
  type ReplacePropertyMap,
  replaceProperties,
  searchUniqueProperties,
  type UniqueProperties,
  type UniquePropertyKeys,
} from "../property-search-and-replace";
import { Bounds, type ReadOnlyBounds } from "../utils/bounds";
import { clamp } from "../utils/math";
import {
  type Action,
  FunctionAction,
  NodeAddAction,
  NodeChangeParentAction,
  NodeDeleteAction,
  NodeUpdateAction,
} from "./actions";
import type { Effect } from "./effect";
import type { Fill } from "./fill";
import {
  type AlignItems,
  type JustifyContent,
  type LayoutMode,
  layout,
  type SizingBehavior,
} from "./layout";
import { NodeUtils } from "./node-utils";
import { FrameNode } from "./nodes/frame-node";
import { GroupNode } from "./nodes/group-node";
import { IconFontNode } from "./nodes/icon-font-node";
import { ShapeNode } from "./nodes/shape-node";
import { StickyNode } from "./nodes/sticky-node";
import { TextNode } from "./nodes/text-node";
import { ObjectUpdateBlock } from "./object-update-block";
import { SceneNode } from "./scene-node";

export enum ReorderAction {
  SendToBack = 0, // index = 0
  BringToFront = 1, // index = children.length
  SendBackward = 2, // index -= 1
  BringForward = 3, // index += 1
}

export type NodeType =
  | "group"
  | "frame"
  | "text"
  | "path"
  | "rectangle"
  | "ellipse"
  | "line"
  | "polygon"
  | "note"
  | "prompt"
  | "context"
  | "icon_font";

export type NodeProperty = keyof NodeProperties;

export enum StrokeAlignment {
  Inside = 0,
  Center = 1,
  Outside = 2,
}

export interface NodeProperties {
  name?: string;
  context?: string;
  theme?: ReadonlyMap<string, string>;
  enabled: Value<"boolean">;
  width: number;
  height: number;

  // Transform
  x: number;
  y: number;
  rotation: Value<"number">;
  flipX: Value<"boolean">;
  flipY: Value<"boolean">;

  fills?: ReadonlyArray<Fill>;

  clip: Value<"boolean">;

  // Stroke
  strokeFills?: ReadonlyArray<Fill>;
  strokeWidth?: readonly [
    Value<"number">,
    Value<"number">,
    Value<"number">,
    Value<"number">,
  ];
  strokeAlignment?: StrokeAlignment;
  lineJoin?: "miter" | "bevel" | "round";
  lineCap?: "none" | "square" | "round";
  opacity: Value<"number">;
  textContent?: string;
  textAlign: "left" | "center" | "right" | "justify";
  textAlignVertical: "top" | "middle" | "bottom";
  textGrowth: "auto" | "fixed-width" | "fixed-width-height";
  fontSize: Value<"number">;
  letterSpacing: Value<"number">;
  lineHeight: Value<"number">; // NOTE(zaza): 0 means auto!
  fontFamily: Value<"string">;
  fontWeight: Value<"string">;
  fontStyle: Value<"string">;
  placeholder: boolean;
  cornerRadius?: readonly [
    Value<"number">,
    Value<"number">,
    Value<"number">,
    Value<"number">,
  ];
  iconFontName?: Value<"string">;
  iconFontFamily?: Value<"string">;
  iconFontWeight?: Value<"number">;
  effects?: ReadonlyArray<Readonly<Effect>>;
  pathData?: string;
  fillRule?: Schema.Path["fillRule"];
  modelName?: Value<"string">;
  polygonCount?: Value<"number">;

  layoutIncludeStroke?: boolean;
  layoutMode: LayoutMode;
  layoutChildSpacing?: Value<"number">;
  layoutPadding?:
    | Value<"number">
    | [Value<"number">, Value<"number">]
    | [Value<"number">, Value<"number">, Value<"number">, Value<"number">];
  layoutJustifyContent: JustifyContent;
  layoutAlignItems: AlignItems;
  verticalSizing: SizingBehavior;
  horizontalSizing: SizingBehavior;
  metadata?: Schema.Entity["metadata"];
}

export const NodePropertyKeys = [
  "name",
  "context",
  "theme",
  "enabled",
  "width",
  "height",
  "x",
  "y",
  "rotation",
  "flipX",
  "flipY",
  "clip",
  "placeholder",
  "fills",
  "strokeFills",
  "strokeWidth",
  "strokeAlignment",
  "lineJoin",
  "lineCap",
  "opacity",
  "textContent",
  "textAlign",
  "textAlignVertical",
  "textGrowth",
  "fontSize",
  "letterSpacing",
  "lineHeight",
  "fontFamily",
  "fontWeight",
  "fontStyle",
  "cornerRadius",
  "iconFontName",
  "iconFontFamily",
  "iconFontWeight",
  "effects",
  "pathData",
  "fillRule",
  "polygonCount",
  "layoutIncludeStroke",
  "layoutMode",
  "layoutChildSpacing",
  "layoutPadding",
  "layoutJustifyContent",
  "layoutAlignItems",
  "verticalSizing",
  "horizontalSizing",
  "modelName",
  "metadata",
] as const;
type _AssertEmpty<T extends never> = T;
type _AssertNoMissingNodePropertyKey = _AssertEmpty<
  Exclude<keyof NodeProperties, (typeof NodePropertyKeys)[number]>
>;

export class NodePropertiesStorage implements NodeProperties {
  readonly resolved: Readonly<Resolved<NodeProperties>>;
  private resolvedValues: Map<keyof NodeProperties, any> = new Map();

  private _name?: NodeProperties["name"];
  private _context?: NodeProperties["context"];
  private _theme?: NodeProperties["theme"];
  private _enabled!: NodeProperties["enabled"];
  private _width!: NodeProperties["width"];
  private _height!: NodeProperties["height"];
  private _x!: NodeProperties["x"];
  private _y!: NodeProperties["y"];
  private _rotation!: NodeProperties["rotation"];
  private _flipX!: NodeProperties["flipX"];
  private _flipY!: NodeProperties["flipY"];
  private _fills?: NodeProperties["fills"];
  private _clip!: NodeProperties["clip"];
  private _placeholder!: NodeProperties["placeholder"];
  private _strokeFills?: NodeProperties["strokeFills"];
  private _strokeWidth?: NodeProperties["strokeWidth"];
  private _strokeAlignment?: NodeProperties["strokeAlignment"];
  private _lineJoin?: NodeProperties["lineJoin"];
  private _lineCap?: NodeProperties["lineCap"];
  private _opacity: NodeProperties["opacity"] = 1;
  private _textContent?: NodeProperties["textContent"];
  private _textAlign!: NodeProperties["textAlign"];
  private _textAlignVertical!: NodeProperties["textAlignVertical"];
  private _textGrowth!: NodeProperties["textGrowth"];
  private _fontSize!: NodeProperties["fontSize"];
  private _letterSpacing!: NodeProperties["letterSpacing"];
  private _lineHeight!: NodeProperties["lineHeight"];
  private _fontFamily!: NodeProperties["fontFamily"];
  private _fontWeight!: NodeProperties["fontWeight"];
  private _fontStyle!: NodeProperties["fontStyle"];
  private _cornerRadius?: NodeProperties["cornerRadius"];
  private _iconFontName?: NodeProperties["iconFontName"];
  private _iconFontFamily?: NodeProperties["iconFontFamily"];
  private _iconFontWeight?: NodeProperties["iconFontWeight"];
  private _effects?: NodeProperties["effects"];
  private _pathData?: NodeProperties["pathData"];
  private _fillRule?: NodeProperties["fillRule"];
  private _polygonCount?: NodeProperties["polygonCount"];
  private _modelName?: NodeProperties["modelName"];
  private _layoutIncludeStroke?: NodeProperties["layoutIncludeStroke"];
  private _layoutMode!: NodeProperties["layoutMode"];
  private _layoutChildSpacing!: NodeProperties["layoutChildSpacing"];
  private _layoutPadding!: NodeProperties["layoutPadding"];
  private _layoutJustifyContent!: NodeProperties["layoutJustifyContent"];
  private _layoutAlignItems!: NodeProperties["layoutAlignItems"];
  private _verticalSizing!: NodeProperties["verticalSizing"];
  private _horizontalSizing!: NodeProperties["horizontalSizing"];
  private _metadata?: NodeProperties["metadata"];

  private _inheritedTheme?: Theme;
  get inheritedTheme(): Theme | undefined {
    return this._inheritedTheme;
  }
  set inheritedTheme(inheritedTheme: Theme | undefined) {
    if (this._inheritedTheme === inheritedTheme) {
      return;
    }
    this._inheritedTheme = inheritedTheme;
    this.updateEffectiveTheme();
  }

  private _effectiveTheme!: Theme;
  get effectiveTheme(): Theme {
    return this._effectiveTheme;
  }
  private updateEffectiveTheme() {
    let newEffectiveTheme;
    if (!this.theme) {
      newEffectiveTheme = this.inheritedTheme;
    } else if (!this.inheritedTheme) {
      newEffectiveTheme = this.theme;
    }
    if (!newEffectiveTheme) {
      newEffectiveTheme = new Map<string, string>([
        ...(this._inheritedTheme?.entries() ?? []),
        ...(this.theme?.entries() ?? []),
      ]);
    }

    // NOTE(zaza): we can skip the change events the first time updateEffectiveTheme() is called from the constructor.
    const shouldFireChangeEvents =
      this._effectiveTheme &&
      !themesEqual(this._effectiveTheme, newEffectiveTheme);
    this._effectiveTheme = newEffectiveTheme;

    if (shouldFireChangeEvents) {
      this.onEffectiveThemeChanged?.();
      for (const key of NodePropertyKeys) {
        if (this.hasVariables(this[key])) {
          this.resolvedValues.delete(key);
          this.onPropertyValueChanged?.(key);
        }
      }
    }
  }

  private variableUnlisteners: Map<keyof NodeProperties, (() => void)[]> =
    new Map();

  private onPropertyChanged?: (property: keyof NodeProperties) => void;
  private onPropertyValueChanged?: (property: keyof NodeProperties) => void;
  private onEffectiveThemeChanged?: () => void;

  private updateVariableListeners(key: keyof NodeProperties) {
    this.variableUnlisteners.get(key)?.forEach((unlistener) => {
      unlistener();
    });
    this.variableUnlisteners.delete(key);
    const unlisteners: (() => void)[] = [];
    const addListeners = (value: any) => {
      if (value === null || value === undefined) {
        return;
      } else if (value instanceof Variable) {
        const listener = () => {
          this.resolvedValues.delete(key);
          this.onPropertyValueChanged?.(key);
        };
        value.addListener(listener);
        unlisteners.push(() => value.removeListener(listener));
      } else if (Array.isArray(value)) {
        value.forEach(addListeners);
      } else if (typeof value === "object") {
        Object.values(value).forEach(addListeners);
      }
    };
    addListeners(this[key]);
    this.variableUnlisteners.set(key, unlisteners);
  }

  resolveVariables<T>(value: T): Resolved<T> {
    if (value === null || value === undefined) {
      return value as Resolved<T>;
    } else if (value instanceof Variable) {
      return value.getValue(this._effectiveTheme) as Resolved<T>;
    } else if (Array.isArray(value)) {
      let i = 0;
      for (const item of value) {
        const resolved = this.resolveVariables(item);
        if (!Object.is(item, resolved)) {
          return value.toSpliced(
            i,
            value.length - i,
            resolved,
            ...value.slice(i + 1).map((item) => this.resolveVariables(item)),
          ) as Resolved<T>;
        }
        i++;
      }
      return value as Resolved<T>;
    } else if (typeof value === "object") {
      let i = 0;
      const entries = Object.entries(value);
      for (const [key, value] of entries) {
        const resolved = this.resolveVariables(value);
        if (!Object.is(value, resolved)) {
          return Object.fromEntries(
            entries.toSpliced(
              i,
              entries.length - i,
              [key, resolved],
              ...entries
                .slice(i + 1)
                .map<[string, any]>(([key, value]) => [
                  key,
                  this.resolveVariables(value),
                ]),
            ),
          ) as Resolved<T>;
        }
        i++;
      }
      return value as Resolved<T>;
    } else {
      return value as Resolved<T>;
    }
  }

  resolveVariable<T>(value: T, variable: Variable<any>): T | Resolved<T> {
    if (value === null || value === undefined) {
      return value;
    } else if (Object.is(value, variable)) {
      return variable.getValue(this._effectiveTheme) as Resolved<T>;
    } else if (Array.isArray(value)) {
      let i = 0;
      for (const item of value) {
        const resolved = this.resolveVariable(item, variable);
        if (!Object.is(item, resolved)) {
          return value.toSpliced(
            i,
            value.length - i,
            resolved,
            ...value
              .slice(i + 1)
              .map((item) => this.resolveVariable(item, variable)),
          ) as Resolved<T>;
        }
        i++;
      }
      return value;
    } else if (typeof value === "object") {
      let i = 0;
      const entries = Object.entries(value);
      for (const [key, value] of entries) {
        const resolved = this.resolveVariable(value, variable);
        if (!Object.is(value, resolved)) {
          return Object.fromEntries(
            entries.toSpliced(
              i,
              entries.length - i,
              [key, resolved],
              ...entries
                .slice(i + 1)
                .map<[string, any]>(([key, value]) => [
                  key,
                  this.resolveVariable(value, variable),
                ]),
            ),
          ) as Resolved<T>;
        }
        i++;
      }
      return value;
    } else {
      return value;
    }
  }

  private hasVariables(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    } else if (value instanceof Variable) {
      return true;
    } else if (Array.isArray(value)) {
      return value.some((element) => this.hasVariables(element));
    } else if (typeof value === "object") {
      return Object.values(value).some((value) => this.hasVariables(value));
    } else {
      return value as any;
    }
  }

  get name(): typeof this._name {
    return this._name;
  }
  set name(name: typeof this._name) {
    this._name = name;
    this.onPropertySet("name");
  }

  get context(): typeof this._context {
    return this._context;
  }
  set context(context: typeof this._context) {
    this._context = context;
    this.onPropertySet("context");
  }

  get theme(): typeof this._theme {
    return this._theme;
  }
  set theme(theme: typeof this._theme) {
    this._theme = theme;
    this.onPropertySet("theme");

    this.updateEffectiveTheme();
  }

  get enabled(): typeof this._enabled {
    return this._enabled;
  }
  set enabled(enabled: typeof this._enabled) {
    this._enabled = enabled;
    this.onPropertySet("enabled");
  }

  get width(): typeof this._width {
    return this._width;
  }
  set width(width: typeof this._width) {
    this._width = width;
    this.onPropertySet("width");
  }

  get height(): typeof this._height {
    return this._height;
  }
  set height(height: typeof this._height) {
    this._height = height;
    this.onPropertySet("height");
  }

  get x(): typeof this._x {
    return this._x;
  }
  set x(x: typeof this._x) {
    this._x = x;
    this.onPropertySet("x");
  }

  get y(): typeof this._y {
    return this._y;
  }
  set y(y: typeof this._y) {
    this._y = y;
    this.onPropertySet("y");
  }

  get rotation(): typeof this._rotation {
    return this._rotation;
  }
  set rotation(rotation: typeof this._rotation) {
    this._rotation = rotation;
    this.onPropertySet("rotation");
  }

  get flipX(): typeof this._flipX {
    return this._flipX;
  }
  set flipX(flipX: typeof this._flipX) {
    this._flipX = flipX;
    this.onPropertySet("flipX");
  }

  get flipY(): typeof this._flipY {
    return this._flipY;
  }
  set flipY(flipY: typeof this._flipY) {
    this._flipY = flipY;
    this.onPropertySet("flipY");
  }

  get fills(): typeof this._fills {
    return this._fills;
  }
  set fills(fills: typeof this._fills) {
    this._fills = fills;
    this.onPropertySet("fills");
  }

  get clip(): typeof this._clip {
    return this._clip;
  }
  set clip(clip: typeof this._clip) {
    this._clip = clip;
    this.onPropertySet("clip");
  }

  get placeholder(): typeof this._placeholder {
    return this._placeholder;
  }
  set placeholder(placeholder: typeof this._placeholder) {
    this._placeholder = placeholder;
    this.onPropertySet("placeholder");
  }

  get strokeFills(): typeof this._strokeFills {
    return this._strokeFills;
  }
  set strokeFills(strokeFills: typeof this._strokeFills) {
    this._strokeFills = strokeFills;
    this.onPropertySet("strokeFills");
  }

  get strokeWidth(): typeof this._strokeWidth {
    return this._strokeWidth;
  }
  set strokeWidth(strokeWidth: typeof this._strokeWidth) {
    this._strokeWidth = strokeWidth;
    this.onPropertySet("strokeWidth");
  }

  get strokeAlignment(): typeof this._strokeAlignment {
    return this._strokeAlignment;
  }
  set strokeAlignment(strokeAlignment: typeof this._strokeAlignment) {
    this._strokeAlignment = strokeAlignment;
    this.onPropertySet("strokeAlignment");
  }

  get lineJoin(): typeof this._lineJoin {
    return this._lineJoin;
  }
  set lineJoin(lineJoin: typeof this._lineJoin) {
    this._lineJoin = lineJoin;
    this.onPropertySet("lineJoin");
  }

  get lineCap(): typeof this._lineCap {
    return this._lineCap;
  }
  set lineCap(lineCap: typeof this._lineCap) {
    this._lineCap = lineCap;
    this.onPropertySet("lineCap");
  }

  get opacity(): typeof this._opacity {
    return this._opacity;
  }
  set opacity(opacity: typeof this._opacity) {
    this._opacity = opacity;
    this.onPropertySet("opacity");
  }

  get textContent(): typeof this._textContent {
    return this._textContent;
  }
  set textContent(textContent: typeof this._textContent) {
    this._textContent = textContent;
    this.onPropertySet("textContent");
  }

  get textAlign(): typeof this._textAlign {
    return this._textAlign;
  }
  set textAlign(textAlign: typeof this._textAlign) {
    this._textAlign = textAlign;
    this.onPropertySet("textAlign");
  }

  get textAlignVertical(): typeof this._textAlignVertical {
    return this._textAlignVertical;
  }
  set textAlignVertical(textAlignVertical: typeof this._textAlignVertical) {
    this._textAlignVertical = textAlignVertical;
    this.onPropertySet("textAlignVertical");
  }

  get textGrowth(): typeof this._textGrowth {
    return this._textGrowth;
  }
  set textGrowth(textGrowth: typeof this._textGrowth) {
    this._textGrowth = textGrowth;
    this.onPropertySet("textGrowth");
  }

  get fontSize(): typeof this._fontSize {
    return this._fontSize;
  }
  set fontSize(fontSize: typeof this._fontSize) {
    this._fontSize = fontSize;
    this.onPropertySet("fontSize");
  }

  get letterSpacing(): typeof this._letterSpacing {
    return this._letterSpacing;
  }
  set letterSpacing(letterSpacing: typeof this._letterSpacing) {
    this._letterSpacing = letterSpacing;
    this.onPropertySet("letterSpacing");
  }

  get lineHeight(): typeof this._lineHeight {
    return this._lineHeight;
  }
  set lineHeight(lineHeight: typeof this._lineHeight) {
    this._lineHeight = lineHeight;
    this.onPropertySet("lineHeight");
  }

  get fontFamily(): typeof this._fontFamily {
    return this._fontFamily;
  }
  set fontFamily(fontFamily: typeof this._fontFamily) {
    this._fontFamily = fontFamily;
    this.onPropertySet("fontFamily");
  }

  get fontWeight(): typeof this._fontWeight {
    return this._fontWeight;
  }
  set fontWeight(fontWeight: typeof this._fontWeight) {
    this._fontWeight = fontWeight;
    this.onPropertySet("fontWeight");
  }

  get fontStyle(): typeof this._fontStyle {
    return this._fontStyle;
  }
  set fontStyle(fontStyle: typeof this._fontStyle) {
    this._fontStyle = fontStyle;
    this.onPropertySet("fontStyle");
  }

  get cornerRadius(): typeof this._cornerRadius {
    return this._cornerRadius;
  }
  set cornerRadius(cornerRadius: typeof this._cornerRadius) {
    this._cornerRadius = cornerRadius;
    this.onPropertySet("cornerRadius");
  }

  get iconFontName(): typeof this._iconFontName {
    return this._iconFontName;
  }
  set iconFontName(iconFontName: typeof this._iconFontName) {
    this._iconFontName = iconFontName;
    this.onPropertySet("iconFontName");
  }

  get iconFontFamily(): typeof this._iconFontFamily {
    return this._iconFontFamily;
  }
  set iconFontFamily(iconFontFamily: typeof this._iconFontFamily) {
    this._iconFontFamily = iconFontFamily;
    this.onPropertySet("iconFontFamily");
  }

  get iconFontWeight(): typeof this._iconFontWeight {
    return this._iconFontWeight;
  }
  set iconFontWeight(iconFontWeight: typeof this._iconFontWeight) {
    this._iconFontWeight = iconFontWeight;
    this.onPropertySet("iconFontWeight");
  }

  get effects(): typeof this._effects {
    return this._effects;
  }
  set effects(effects: typeof this._effects) {
    this._effects = effects;
    this.onPropertySet("effects");
  }

  get pathData(): typeof this._pathData {
    return this._pathData;
  }
  set pathData(pathData: typeof this._pathData) {
    this._pathData = pathData;
    this.onPropertySet("pathData");
  }

  get fillRule(): typeof this._fillRule {
    return this._fillRule;
  }
  set fillRule(fillRule: typeof this._fillRule) {
    this._fillRule = fillRule;
    this.onPropertySet("fillRule");
  }

  get polygonCount(): typeof this._polygonCount {
    return this._polygonCount;
  }
  set polygonCount(polygonCount: typeof this._polygonCount) {
    this._polygonCount = polygonCount;
    this.onPropertySet("polygonCount");
  }

  get modelName(): typeof this._modelName {
    return this._modelName;
  }
  set modelName(modelName: typeof this._modelName) {
    this._modelName = modelName;
    this.onPropertySet("modelName");
  }

  get layoutIncludeStroke(): typeof this._layoutIncludeStroke {
    return this._layoutIncludeStroke;
  }
  set layoutIncludeStroke(layoutIncludeStroke: typeof this._layoutIncludeStroke,) {
    this._layoutIncludeStroke = layoutIncludeStroke;
    this.onPropertySet("layoutIncludeStroke");
  }
  get layoutMode(): typeof this._layoutMode {
    return this._layoutMode;
  }
  set layoutMode(layoutMode: typeof this._layoutMode) {
    this._layoutMode = layoutMode;
    this.onPropertySet("layoutMode");
  }
  get layoutChildSpacing(): typeof this._layoutChildSpacing {
    return this._layoutChildSpacing;
  }
  set layoutChildSpacing(layoutChildSpacing: typeof this._layoutChildSpacing) {
    this._layoutChildSpacing = layoutChildSpacing;
    this.onPropertySet("layoutChildSpacing");
  }
  get layoutPadding(): typeof this._layoutPadding {
    return this._layoutPadding;
  }
  set layoutPadding(layoutPadding: typeof this._layoutPadding) {
    this._layoutPadding = layoutPadding;
    this.onPropertySet("layoutPadding");
  }
  get layoutJustifyContent(): typeof this._layoutJustifyContent {
    return this._layoutJustifyContent;
  }
  set layoutJustifyContent(layoutJustifyContent: typeof this._layoutJustifyContent,) {
    this._layoutJustifyContent = layoutJustifyContent;
    this.onPropertySet("layoutJustifyContent");
  }
  get layoutAlignItems(): typeof this._layoutAlignItems {
    return this._layoutAlignItems;
  }
  set layoutAlignItems(layoutAlignItems: typeof this._layoutAlignItems) {
    this._layoutAlignItems = layoutAlignItems;
    this.onPropertySet("layoutAlignItems");
  }

  get verticalSizing(): typeof this._verticalSizing {
    return this._verticalSizing;
  }
  set verticalSizing(verticalSizing: typeof this._verticalSizing) {
    this._verticalSizing = verticalSizing;
    this.onPropertySet("verticalSizing");
  }

  get horizontalSizing(): typeof this._horizontalSizing {
    return this._horizontalSizing;
  }
  set horizontalSizing(horizontalSizing: typeof this._horizontalSizing) {
    this._horizontalSizing = horizontalSizing;
    this.onPropertySet("horizontalSizing");
  }

  get metadata(): typeof this._metadata {
    return this._metadata;
  }
  set metadata(metadata: typeof this._metadata) {
    this._metadata = metadata;
    this.onPropertySet("metadata");
  }

  private onPropertySet(property: keyof NodeProperties) {
    this.resolvedValues.delete(property);
    this.updateVariableListeners(property);
    this.onPropertyChanged?.(property);
    this.onPropertyValueChanged?.(property);
  }

  constructor(
    properties: NodeProperties,
    onPropertyChanged?: (property: keyof NodeProperties) => void,
    onPropertyValueChanged?: (property: keyof NodeProperties) => void,
    onEffectiveThemeChanged?: () => void,
  ) {
    for (const key of NodePropertyKeys) {
      const value = properties[key];
      if (value === undefined) {
        continue;
      } else if (key === "theme") {
        // NOTE(zaza): don't want to trigger updateEffectiveTheme() unnecessarily here.
        this._theme = properties.theme;
      } else {
        (this as any)[key] = value;
      }
    }

    this.updateEffectiveTheme();

    this.resolved = new Proxy<NodePropertiesStorage>(this, {
      get(target, key: keyof NodeProperties): any {
        let resolvedValue;
        if (target.resolvedValues.has(key)) {
          resolvedValue = target.resolvedValues.get(key);
        } else {
          const value = target[key];
          if (key === "rotation") {
            // NOTE(zaza): this is hack to handle the conversion from the user-facing degrees to radians.
            if (value instanceof Variable) {
              resolvedValue = deserializeRotation(
                target.resolveVariables(value as typeof target.rotation),
              );
            } else {
              resolvedValue = value;
            }
          } else if (key === "opacity") {
            // NOTE(zaza): this is hack to handle if opacity is bound to a variable outside the [0,1] range.
            if (value instanceof Variable) {
              resolvedValue =
                clamp(
                  0,
                  target.resolveVariables(value as typeof target.rotation),
                  100,
                ) / 100;
            } else {
              resolvedValue = value;
            }
          } else {
            resolvedValue = target.resolveVariables(value);
          }

          target.resolvedValues.set(key, resolvedValue);
        }
        return resolvedValue;
      },
    }) as any;

    this.onPropertyChanged = onPropertyChanged;
    this.onPropertyValueChanged = onPropertyValueChanged;
    this.onEffectiveThemeChanged = onEffectiveThemeChanged;
  }

  destroy() {
    for (const unlisteners of this.variableUnlisteners.values()) {
      for (const unlistener of unlisteners) {
        unlistener();
      }
    }
    this.variableUnlisteners.clear();
  }

  getUsedVariables(variables = new Set<Variable<any>>()): Set<Variable<any>> {
    for (const key of NodePropertyKeys) {
      getUsedVariables(this[key], variables);
    }
    return variables;
  }
}

function getUsedVariables<T>(
  value: T,
  variables = new Set<Variable<any>>(),
): Set<Variable<any>> {
  if (value === null || value === undefined) {
    // noop
  } else if (value instanceof Variable) {
    variables.add(value);
  } else if (typeof value === "object") {
    if (Array.isArray(value)) {
      for (const item of value) {
        getUsedVariables(item, variables);
      }
    } else {
      for (const item of Object.values(value)) {
        getUsedVariables(item, variables);
      }
    }
  }
  return variables;
}

export interface IconOptions {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

type SceneGraphEvents = {
  nodeAdded: (node: SceneNode) => void;
  nodeRemoved: (node: SceneNode) => void;
  nodePropertyChange: (node: SceneNode) => void;
};

// Using 5 length unique IDs means a ~4e-8 probability for collision within 1000
// nodes, which should be sufficient for our use case.
const { randomUUID } = new ShortUniqueId({ length: 5 });

export class SceneGraph extends EventEmitter<SceneGraphEvents> {
  // private layout: Layout;
  private viewportNode: SceneNode;

  public nodeByLocalID: Map<number, SceneNode> = new Map();
  public nodes: Set<SceneNode>;
  public sceneManager!: SceneManager;
  public documentPath: string | null = null;
  private needsLayoutUpdate: boolean = true;
  private _isUpdatingLayout: boolean = false;

  public isOpeningDocument: boolean = false;

  get isUpdatingLayout(): boolean {
    return this._isUpdatingLayout;
  }

  public static createUniqueID(): string {
    return randomUUID();
  }

  constructor(sceneManager: SceneManager) {
    super();

    this.nodes = new Set();
    this.sceneManager = sceneManager;
    this.viewportNode = this.createRootNode(true); // Pass true for isViewport
  }

  public getNodeByPath(path: string): SceneNode | undefined {
    return this.viewportNode.getNodeByPath(path);
  }

  getDocumentBoundingBox(): ReadOnlyBounds | null {
    this.updateLayout();

    // TODO(sedivy): Cache this
    return NodeUtils.calculateCombinedBoundsFromArray(
      this.viewportNode.children,
    );
  }

  public createRootNode(isViewport: boolean = false): SceneNode {
    // Add isViewport parameter
    const node = new SceneNode(
      "",
      "group", // TODO(sedivy): This should really not be a group.
      createNodeProperties("group", {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      }),
    );
    node.onInsertToScene(this.sceneManager);

    node.root = true;

    if (!isViewport) {
      // Only add to map if it's not the viewport node
      this.nodes.add(node); // Add group node to map
      this.nodeByLocalID.set(node.localID, node);
      this.emit("nodeAdded", node);
    }
    return node;
  }

  public moveNodeToGroup(
    block: ObjectUpdateBlock,
    groupNode: SceneNode,
    node: SceneNode,
  ): boolean {
    // Ensure the target node is a valid container type
    if (groupNode.type !== "group" && groupNode.type !== "frame") {
      return false;
    }

    const worldPosition = node.getGlobalPosition();

    block.changeParent(node, groupNode);

    if (node.parent !== groupNode) {
      return false;
    }

    this.invalidateLayout(groupNode);

    const newLocalPosition = node.toLocalPointFromParent(
      worldPosition.x,
      worldPosition.y,
    );

    block.update(node, {
      x: newLocalPosition.x,
      y: newLocalPosition.y,
    });

    return true;
  }

  static createNode(
    id: string | undefined,
    type: NodeType,
    properties: NodeProperties,
  ): SceneNode {
    if (id === undefined) {
      id = SceneGraph.createUniqueID();
    }

    let node: SceneNode;

    if (type === "text") {
      node = new TextNode(id, properties);
    } else if (type === "icon_font") {
      node = new IconFontNode(id, properties);
    } else if (type === "group") {
      node = new GroupNode(id, properties);
    } else if (type === "frame") {
      node = new FrameNode(id, properties);
    } else if (type === "note" || type === "prompt" || type === "context") {
      node = new StickyNode(id, type, properties);
    } else if (
      type === "path" ||
      type === "rectangle" ||
      type === "ellipse" ||
      type === "line" ||
      type === "polygon"
    ) {
      node = new ShapeNode(id, type, properties);
    } else {
      throw new Error(`Unhandled node type ${type}`);
    }

    return node;
  }

  unsafeInsertNode(
    node: SceneNode,
    parent: SceneNode | null,
    index: number | null,
    undo: Action[] | null,
    updateInstances: boolean = true,
    instanceUpdate: boolean = false,
  ) {
    node.destroyed = false;

    if (undo) {
      undo.push(new NodeDeleteAction(node));
    }

    node.onInsertToScene(this.sceneManager);
    node.updateTransform();

    if (parent && node.parent !== parent) {
      if (
        !instanceUpdate &&
        parent.prototype &&
        !parent.prototype.childrenOverridden &&
        parent.children.length === 0
      ) {
        parent.setChildrenOverridden(undo, true);
      }

      parent.addChild(node);
      if (index != null) {
        parent.setChildIndex(node, index);
      }

      if (updateInstances) {
        for (const parentInstance of parent.instances) {
          if (parentInstance.prototype!.childrenOverridden) {
            continue;
          }

          this.unsafeInsertNode(
            node.createInstancesFromSubtree(),
            parentInstance,
            index ?? parentInstance.children.length,
            null,
            true,
            true,
          );
        }
      }
    }

    this.nodeByLocalID.set(node.localID, node);
    this.nodes.add(node);
    this.emit("nodeAdded", node);
    this.documentModified();

    this.invalidateLayout(node);

    // NOTE(sedivy): When we insert a node tree structure also insert all the
    // children. This is used in the undo/redo where we store the entire tree
    // when deleting a parent node.
    for (const child of node.children) {
      this.unsafeInsertNode(child, null, null, null);
    }
  }

  unsafeRemoveNode(
    node: SceneNode,
    undo: Action[] | null,
    removeFromParent: boolean,
    updateInstances = true,
  ) {
    if (!node.parent) {
      return;
    }

    const index = node.parent.childIndex(node);

    if (undo) {
      undo.push(new NodeAddAction(node, node.parent, index));
    }

    this.sceneManager.selectionManager.deselectNode(node);

    for (const child of node.children) {
      this.unsafeRemoveNode(child, undo, false, updateInstances);
    }

    if (node.parent) {
      this.invalidateLayout(node.parent);
    }

    if (removeFromParent) {
      const parent = node.parent;

      node.parent.removeChild(node);

      if (updateInstances) {
        for (const parentInstance of parent.instances) {
          if (parentInstance.prototype!.childrenOverridden) {
            continue;
          }
          this.unsafeRemoveNode(parentInstance.children[index], null, true);
        }

        // NOTE(zaza): this triggers ensurePrototypeReusability() for all the node's instances,
        // so they won't be left with a dangling prototype reference.
        node.setReusable(undo, false);
      }
    }

    if (node.prototype) {
      node.detachFromPrototype(undo);
    }

    if (!node.destroyed) {
      node.destroy();
    }

    this.nodeByLocalID.delete(node.localID);
    this.nodes.delete(node);
    this.emit("nodeRemoved", node);
    this.documentModified();
  }

  unsafeChangeParent(
    node: SceneNode,
    parent: SceneNode | null,
    index: number | null,
    undo: Action[] | null,
    updateInstances: boolean = true,
  ) {
    if (!parent) {
      this.unsafeRemoveNode(node, undo, true, updateInstances);
      return;
    } else if (!node.parent) {
      this.unsafeInsertNode(node, parent, index, undo, updateInstances);
      return;
    }

    if (undo) {
      undo.push(
        new NodeChangeParentAction(
          node,
          node.parent,
          node.parent.childIndex(node),
        ),
      );
    }

    const oldParent = node.parent;
    const oldIndex = oldParent.childIndex(node);
    if (oldParent !== parent) {
      oldParent.removeChild(node);
      if (updateInstances) {
        for (const oldParentInstance of oldParent.instances) {
          if (oldParentInstance.prototype!.childrenOverridden) {
            continue;
          }
          this.unsafeRemoveNode(
            oldParentInstance.children[oldIndex],
            null,
            true,
          );
        }
      }
      this.unsafeInsertNode(node, parent, index, null, updateInstances, true);
    } else if (index !== null) {
      oldParent.setChildIndex(node, index);
      if (updateInstances) {
        for (const oldParentInstance of oldParent.instances) {
          if (oldParentInstance.prototype!.childrenOverridden) {
            continue;
          }
          this.unsafeChangeParent(
            oldParentInstance.children[oldIndex],
            oldParentInstance,
            index,
            null,
          );
        }
      }
    }
  }

  unsafeClearChildren(node: SceneNode, undo: Action[] | null) {
    if (node.prototype) {
      undo?.push(
        new FunctionAction((_, undo) =>
          this.unsafeRestoreInstanceChildren(node, undo),
        ),
      );

      for (const child of [...node.children]) {
        this.unsafeRemoveNode(child, null, true);
      }
      node.setChildrenOverridden(null, true);
    } else {
      for (const child of node.children) {
        this.unsafeRemoveNode(child, undo, true);
      }
    }
  }

  unsafeRestoreInstanceChildren(node: SceneNode, undo: Action[] | null) {
    if (!node.prototype) {
      throw new Error("Can't restore children of non-instance nodes!");
    }
    for (const child of [...node.children]) {
      this.unsafeRemoveNode(child, undo, true);
    }

    for (const prototypeChild of node.prototype.node.children) {
      const cloned = prototypeChild.createInstancesFromSubtree();
      this.unsafeInsertNode(cloned, node, null, undo);
    }

    node.setChildrenOverridden(undo, false);
  }

  public notifyPropertyChange(node: SceneNode) {
    this.emit("nodePropertyChange", node);
  }

  createAndInsertNode(
    block: ObjectUpdateBlock,
    id: string | undefined,
    type: NodeType,
    properties: NodeProperties,
    parent: SceneNode,
  ): SceneNode {
    const node = SceneGraph.createNode(id, type, properties);
    block.addNode(node, parent);
    return node;
  }

  documentModified() {
    this.sceneManager.skiaRenderer.invalidateContent();

    if (!this.isOpeningDocument && !this.isUpdatingLayout) {
      this.sceneManager.eventEmitter.emit("document-modified");
    }
  }

  public reorderNodesInParents(
    block: ObjectUpdateBlock,
    nodes: Iterable<SceneNode>,
    action: ReorderAction,
  ) {
    const map = new Map<SceneNode, { node: SceneNode; index: number }[]>();

    for (const node of nodes) {
      const parent = node.parent;
      if (!parent) continue;

      const record = { node: node, index: parent.childIndex(node) };

      const parentList = map.get(parent);
      if (parentList) {
        parentList.push(record);
      } else {
        map.set(parent, [record]);
      }
    }

    for (const [parent, list] of map) {
      list.sort((a, b) => {
        return a.index - b.index;
      });

      switch (action) {
        case ReorderAction.SendToBack: {
          for (let i = list.length - 1; i >= 0; i--) {
            block.changeParent(list[i].node, parent, 0);
          }
          break;
        }

        case ReorderAction.BringToFront: {
          for (let i = 0; i < list.length; i++) {
            block.changeParent(list[i].node, parent, parent.children.length);
          }
          break;
        }

        case ReorderAction.BringForward: {
          let max = parent.children.length - 1;

          for (let i = list.length - 1; i >= 0; i--) {
            const item = list[i];

            let target = item.index + 1;
            if (target > max) {
              target = max;
              max = target - 1;
            }

            block.changeParent(item.node, parent, target);
          }
          break;
        }

        case ReorderAction.SendBackward: {
          let min = 0;

          for (let i = 0; i < list.length; i++) {
            const item = list[i];

            let target = item.index - 1;
            if (target < min) {
              target = min;
              min = target + 1;
            }

            block.changeParent(item.node, parent, target);
          }
          break;
        }
      }
    }

    this.sceneManager.selectionManager.updateMultiSelectGuides();
  }

  beginUpdate(): ObjectUpdateBlock {
    return new ObjectUpdateBlock(this.sceneManager);
  }

  commitBlock(block: ObjectUpdateBlock, options: { undo: boolean }) {
    if (options.undo) {
      this.sceneManager.undoManager.pushUndo(block.rollback);
    }

    this.sceneManager.scenegraph.documentModified();
    this.sceneManager.selectionManager.updateMultiSelectGuides();
  }

  rollbackBlock(block: ObjectUpdateBlock) {
    this.sceneManager.undoManager.applyFromStack([block.rollback], null);
  }

  getViewportNode(): SceneNode {
    return this.viewportNode;
  }

  getNodes(): Set<SceneNode> {
    return this.nodes;
  }

  setFilePath(documentPath: string | null): void {
    this.documentPath = documentPath;
  }

  // Cleanup
  destroy(): void {
    logger.debug("Destroying SceneGraph...");
    // Stop any ongoing operations if necessary

    const block = this.beginUpdate();

    // Remove all nodes from the PIXI stage/viewport
    this.nodes.forEach((node) => {
      block.deleteNode(node, false);
    });

    this.commitBlock(block, { undo: false });

    this.nodes.clear();
    this.nodeByLocalID.clear();
    this.documentPath = null;
  }

  public normalizeGroup(block: ObjectUpdateBlock, group: SceneNode) {
    if (group.type !== "group") {
      return;
    }

    const originalPositions = [];
    for (const child of group.children) {
      originalPositions.push(child.getGlobalPosition());
    }

    const bounds = group.localBounds();

    const offsetX = bounds.x;
    const offsetY = bounds.y;

    block.update(group, {
      x: group.properties.resolved.x + offsetX,
      y: group.properties.resolved.y + offsetY,
    });

    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i];
      const originalPosition = originalPositions[i];
      const newPosition = group.toLocal(originalPosition.x, originalPosition.y);

      block.update(child, {
        x: newPosition.x,
        y: newPosition.y,
      });
    }
  }

  public createGroup(
    block: ObjectUpdateBlock,
    nodesToGroup: SceneNode[],
  ): SceneNode | null {
    if (nodesToGroup.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;

    const parent = nodesToGroup[0].parent;
    if (!parent) {
      return null;
    }

    for (const node of nodesToGroup) {
      minX = Math.min(minX, node.properties.resolved.x);
      minY = Math.min(minY, node.properties.resolved.y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return null;
    }

    // TODO(sedivy): Creating a node and attaching entities to the node needs to
    // be done as a single "command" to have a proper undo/redo.

    const group = this.createAndInsertNode(
      block,
      undefined,
      "group",
      createNodeProperties("group", {
        x: minX,
        y: minY,
        width: 0,
        height: 0,
      }),
      parent,
    );

    // TODO(sedivy): This is not quite right. When the selection is across
    // multiple different top-level frames, we should make one group in each
    // frame.

    for (const node of nodesToGroup) {
      this.moveNodeToGroup(block, group, node);
    }

    return group;
  }

  unsafeApplyChanges<K extends keyof NodeProperties>(
    node: SceneNode,
    data: Pick<Partial<NodeProperties>, K>,
    undo: Action[] | null,
  ) {
    if (undo) {
      const rollback: Partial<NodeProperties> = {};

      for (const key in data) {
        rollback[key] = node.properties[key];
      }

      undo.push(new NodeUpdateAction(node, rollback));
    }

    Object.assign(node.properties, data);
  }

  public deserializePastedNode(
    resolveVariable: VariableMapping,
    resolveTheme: ([axis, value]: [string, string]) => [string, string],
    block: ObjectUpdateBlock,
    nodeData: Schema.Document["children"][0],
    parent: SceneNode,
  ): SceneNode | undefined {
    if (nodeData.type === "connection" || nodeData.type === "ref") {
      return undefined;
    }

    const properties = deserializeToProperties(
      nodeData,
      resolveVariable,
      resolveTheme,
    );
    if (!properties) {
      return undefined;
    }

    const newNode = this.createAndInsertNode(
      block,
      undefined,
      properties.type,
      properties.properties,
      parent,
    );
    newNode.setReusable(null, nodeData.reusable ?? false);
    if (
      (nodeData.type === "group" || nodeData.type === "frame") &&
      nodeData.children &&
      nodeData.children.length > 0
    ) {
      for (const child of nodeData.children) {
        this.deserializePastedNode(
          resolveVariable,
          resolveTheme,
          block,
          child,
          newNode,
        );
      }
      this.normalizeGroup(block, newNode);
    }
    return newNode;
  }

  public deserializeNode(
    block: ObjectUpdateBlock,
    nodeData: SerializedNode,
    parent: SceneNode,
  ): SceneNode {
    const newNode = this.createAndInsertNode(
      block,
      undefined,
      nodeData.type,
      structuredClone(nodeData.properties),
      parent,
    );
    newNode.setReusable(null, nodeData.reusable);
    if (
      nodeData.children &&
      nodeData.children.length > 0 &&
      (newNode.type === "group" || newNode.type === "frame")
    ) {
      for (const child of nodeData.children) {
        this.deserializeNode(block, child, newNode);
      }
      this.normalizeGroup(block, newNode);
    }
    return newNode;
  }

  invalidateLayout(_node: SceneNode) {
    if (!this._isUpdatingLayout) {
      // TODO(sedivy): Only mark a sub-tree as dirty and not the whole document
      this.needsLayoutUpdate = true;
    }
  }

  updateLayout() {
    // TODO(sedivy): Only do a sub-tree layout and not a the whole document, but
    // even on large documents it takes 0.5ms to lay out everything.
    if (this.needsLayoutUpdate && !this._isUpdatingLayout) {
      this.needsLayoutUpdate = false;

      this._isUpdatingLayout = true;
      layout(this);
      this._isUpdatingLayout = false;

      this.sceneManager.selectionManager.updateMultiSelectGuides();
    }
  }

  public getNextFrameNumber(): number {
    const context = { max: 0 };
    this.findHighestFrameNumber(this.viewportNode, context);
    return context.max + 1;
  }

  private findHighestFrameNumber(node: SceneNode, context: { max: number }) {
    // NOTE(sedivy): This feels sketchy.
    if (node.type === "frame" && node.properties.resolved.name) {
      const match = node.properties.resolved.name.match(/^Frame (\d+)$/);
      if (match) {
        const frameNumber = parseInt(match[1], 10);
        context.max = Math.max(context.max, frameNumber);
      }
    }

    for (const child of node.children) {
      this.findHighestFrameNumber(child, context);
    }
  }

  searchUniqueProperties(
    roots: SceneNode[],
    propertiesToFind: UniquePropertyKeys[],
  ): UniqueProperties {
    const result: UniqueProperties = {};

    for (const node of roots) {
      searchUniqueProperties(result, node, propertiesToFind);
    }

    return result;
  }

  replaceProperties(
    block: ObjectUpdateBlock,
    roots: SceneNode[],
    replacePropertyMap: ReplacePropertyMap,
  ) {
    replaceProperties(block, roots, replacePropertyMap);
  }

  findEmptySpaceAroundNode(
    start: SceneNode,
    width: number,
    height: number,
    padding: number,
    direction: "top" | "right" | "bottom" | "left",
  ): { x: number; y: number; parent: SceneNode | null } {
    const advance = (candidate: Bounds, overlap: ReadOnlyBounds) => {
      switch (direction) {
        case "top": {
          candidate.y = Math.min(
            candidate.y,
            overlap.top - padding - candidate.height,
          );
          break;
        }
        case "right": {
          candidate.x = Math.max(candidate.x, overlap.right + padding);
          break;
        }
        case "bottom": {
          candidate.y = Math.max(candidate.y, overlap.bottom + padding);
          break;
        }
        case "left": {
          candidate.x = Math.min(
            candidate.x,
            overlap.left - padding - candidate.width,
          );
          break;
        }
      }
    };

    // NOTE(sedivy): Ensure the layout is up to date before searching for empty space.
    this.updateLayout();

    const startBounds = start.getTransformedLocalBounds();

    const candidate = Bounds.MakeXYWH(
      startBounds.x,
      startBounds.y,
      width,
      height,
    );

    advance(candidate, startBounds);

    if (start.parent) {
      let siblings = start.parent.children;

      switch (direction) {
        case "top": {
          siblings = siblings.toSorted(
            (a, b) =>
              b.getTransformedLocalBounds().y - a.getTransformedLocalBounds().y,
          );
          break;
        }
        case "right": {
          siblings = siblings.toSorted(
            (a, b) =>
              a.getTransformedLocalBounds().x - b.getTransformedLocalBounds().x,
          );
          break;
        }
        case "bottom": {
          siblings = siblings.toSorted(
            (a, b) =>
              a.getTransformedLocalBounds().y - b.getTransformedLocalBounds().y,
          );
          break;
        }
        case "left": {
          siblings = siblings.toSorted(
            (a, b) =>
              b.getTransformedLocalBounds().x - a.getTransformedLocalBounds().x,
          );
          break;
        }
      }

      for (const node of siblings) {
        if (node === start) {
          continue;
        }

        const bounds = node.getTransformedLocalBounds();
        if (candidate.intersects(bounds)) {
          advance(candidate, bounds);
        }
      }
    }

    return {
      x: candidate.x,
      y: candidate.y,
      parent: start.parent?.root ? null : start.parent,
    };
  }

  canonicalizePath(path: string): string | undefined {
    return this.getViewportNode().canonicalizePath(path);
  }
}
