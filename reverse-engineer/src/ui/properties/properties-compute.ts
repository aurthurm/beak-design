import {
  AlignItems,
  Axis,
  almostEquals,
  type Fill,
  JustifyContent,
  type LayoutMode,
  type NodeProperties,
  type Resolved,
  type SceneNode,
  SizingBehavior,
  StrokeAlignment,
  type Value,
  Variable,
} from "@ha/pencil-editor";
import type * as Schema from "@ha/schema";
import { deepEqual } from "fast-equals";

// Generic merger to derive common-or-"Mixed" values across a selection
function merge<T>(
  common: T | "Mixed" | undefined,
  current: T,
  equal?: (a: T, b: T) => boolean,
): T | "Mixed" {
  if (common === undefined) return current;
  return common === "Mixed" ||
    (equal ? !equal(common, current) : common !== current)
    ? "Mixed"
    : common;
}

export type ValueWithResolved<T> = { value: T; resolved: Resolved<T> };

// Reuse empty string to avoid creating new references
const EMPTY_LAYER_NAME = "";

// Stable default corner radii to prevent unnecessary re-renders
const DEFAULT_CORNER_RADII: readonly [number, number, number, number] = [
  0, 0, 0, 0,
] as const;

export function compareValuesWithResolved<T>(
  a: ValueWithResolved<T>,
  b: ValueWithResolved<T>,
  compare: (a: Resolved<T>, b: Resolved<T>) => boolean,
): boolean {
  if (
    (a.value instanceof Variable || b.value instanceof Variable) &&
    a.value !== b.value
  ) {
    return false;
  }
  return compare(a.resolved, b.resolved);
}

/**
 * Computes all properties for selected nodes in a single iteration.
 *
 * Performance improvement: Instead of iterating over selectedNodes 12 times
 * (once for each property type), this function iterates only once and computes
 * all properties simultaneously. For N selected nodes, this reduces complexity
 * from O(12N) to O(N).
 *
 * @param selectedNodes - Iterable of selected scene nodes
 * @param viewport - Viewport object for position calculations
 * @returns Object containing all computed properties
 */

export function computeAllProperties(selectedNodes: Iterable<SceneNode>): {
  position: {
    x: number | "Mixed";
    y: number | "Mixed";
    rotation: number | "Mixed";
  };

  layoutMode?: LayoutMode | "Mixed";
  layoutModeInitialized: boolean;
  layoutChildSpacing: ValueWithResolved<Value<"number">> | "Mixed";
  layoutPadding: ValueWithResolved<
    | Value<"number">
    | [Value<"number">, Value<"number">]
    | [Value<"number">, Value<"number">, Value<"number">, Value<"number">]
  >;
  layoutJustifyContent: JustifyContent | "Mixed";
  layoutAlignItems: AlignItems | "Mixed";

  width: number | "Mixed";
  height: number | "Mixed";
  sizing: {
    horizontalSizing: SizingBehavior | "Mixed";
    verticalSizing: SizingBehavior | "Mixed";
  };
  opacity: ValueWithResolved<Value<"number">> | "Mixed";
  cornerRadii:
    | ValueWithResolved<
        readonly [
          Value<"number">,
          Value<"number">,
          Value<"number">,
          Value<"number">,
        ]
      >
    | "Mixed"
    | null;
  fills: "Mixed" | ValueWithResolved<ReadonlyArray<Fill>> | undefined;
  stroke: {
    fills: "Mixed" | ValueWithResolved<ReadonlyArray<Fill>> | undefined;
    strokeWidth:
      | ValueWithResolved<
          readonly [
            Value<"number">,
            Value<"number">,
            Value<"number">,
            Value<"number">,
          ]
        >
      | "Mixed"
      | null;
    strokeAlignment: StrokeAlignment | "Mixed";
  };
  text?: {
    fontFamily: ValueWithResolved<Value<"string">> | "Mixed";
    fontSize: ValueWithResolved<Value<"number">> | "Mixed";
    fontWeight: ValueWithResolved<Value<"string">> | "Mixed";
    fontStyle: ValueWithResolved<Value<"string">> | "Mixed";
    textAlign: NodeProperties["textAlign"] | "Mixed";
    textAlignVertical: NodeProperties["textAlignVertical"] | "Mixed";
    lineHeight: ValueWithResolved<Value<"number">> | "Mixed";
    letterSpacing: ValueWithResolved<Value<"number">> | "Mixed";
    textGrowth: "auto" | "fixed-width" | "fixed-width-height" | "Mixed";
  };
  iconFont: {
    isVisible: boolean;
    iconFontName: string | "Mixed" | undefined;
    iconFontFamily: string | "Mixed" | undefined;
    iconFontWeight: number | "Mixed" | undefined;
  };
  effects: "Mixed" | ValueWithResolved<NodeProperties["effects"]> | undefined;
  layerName: string | "Mixed";
  context: string | "Mixed" | undefined;
  clipInitialized: boolean;
  clip: boolean | "Mixed";
  theme: "Mixed" | ReadonlyMap<string, string> | undefined;
  metadata: Schema.Entity["metadata"] | undefined;
} {
  const nearlyEqual = (a: number, b: number, tol: number) =>
    Math.abs(a - b) <= tol;

  const comparePadding = (
    a: number | [number, number] | [number, number, number, number],
    b: number | [number, number] | [number, number, number, number],
  ): boolean => {
    if (typeof a === "number" && typeof b === "number") {
      return nearlyEqual(a, b, 0.01);
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!nearlyEqual(a[i], b[i], 0.01)) return false;
      }
      return true;
    }
    return false;
  };

  // Position tracking
  let commonPositionX: number | null = null;
  let commonPositionY: number | null = null;
  let commonRotation: number | null = null;
  let selectedNodesLength = 0;
  let isFirstNode = true;

  // Layout tracking
  let commonlayoutModeInitialized = false;
  let commonIncludeStroke: boolean | "Mixed" | undefined;
  let commonLayoutMode: LayoutMode | "Mixed" | undefined;
  let commonChildSpacing:
    | ValueWithResolved<Value<"number">>
    | "Mixed"
    | undefined;
  let commonPadding:
    | ValueWithResolved<
        | Value<"number">
        | [Value<"number">, Value<"number">]
        | [Value<"number">, Value<"number">, Value<"number">, Value<"number">]
      >
    | "Mixed"
    | undefined;
  let commonJustifyContent: JustifyContent | "Mixed" | undefined;
  let commonAlignItems: AlignItems | "Mixed" | undefined;

  // Dimensions tracking
  let commonWidth: number | "Mixed" | undefined;
  let commonHeight: number | "Mixed" | undefined;

  // Sizing tracking
  let commonHorizontalSizing: SizingBehavior | "Mixed" | undefined;
  let commonVerticalSizing: SizingBehavior | "Mixed" | undefined;

  // Opacity tracking
  let commonOpacity: ValueWithResolved<Value<"number">> | "Mixed" | undefined;

  // Corner radii tracking
  let commonCornerRadii:
    | ValueWithResolved<
        readonly [
          Value<"number">,
          Value<"number">,
          Value<"number">,
          Value<"number">,
        ]
      >
    | "Mixed"
    | undefined;

  // Fill tracking
  let commonFillsInitialized = false;
  let commonFills: "Mixed" | undefined | ValueWithResolved<ReadonlyArray<Fill>>;

  // Stroke tracking
  let commonStrokeInitialized = false;
  let commonStrokeFills:
    | "Mixed"
    | undefined
    | ValueWithResolved<ReadonlyArray<Fill>>;
  let commonStrokeWidth:
    | ValueWithResolved<
        readonly [
          Value<"number">,
          Value<"number">,
          Value<"number">,
          Value<"number">,
        ]
      >
    | "Mixed"
    | undefined;
  let commonStrokeAlignment: StrokeAlignment | "Mixed" | undefined;

  // Text tracking
  let commonText:
    | {
        fontFamily: ValueWithResolved<Value<"string">> | "Mixed";
        fontSize: ValueWithResolved<Value<"number">> | "Mixed";
        fontWeight: ValueWithResolved<Value<"string">> | "Mixed";
        fontStyle: ValueWithResolved<Value<"string">> | "Mixed";
        textAlign: NodeProperties["textAlign"] | "Mixed";
        textAlignVertical: NodeProperties["textAlignVertical"] | "Mixed";
        lineHeight: ValueWithResolved<Value<"number">> | "Mixed";
        letterSpacing: ValueWithResolved<Value<"number">> | "Mixed";
        textGrowth: NodeProperties["textGrowth"] | "Mixed";
      }
    | undefined;

  // Icon font tracking
  let iconFontIsVisible = false;
  let commonIconFontName: string | "Mixed" | undefined;
  let commonIconFontFamily: string | "Mixed" | undefined;
  let commonIconFontWeight: number | "Mixed" | undefined;

  // Effects tracking
  let commonEffectsInitialized = false;
  let commonEffects:
    | "Mixed"
    | ValueWithResolved<NodeProperties["effects"]>
    | undefined;

  // Theme tracking
  let commonThemeInitialized = false;
  let commonTheme: ReadonlyMap<string, string | "Mixed"> | "Mixed" | undefined;

  // Layer name tracking
  let commonName: string | "Mixed" | undefined;

  // Context tracking
  let commonContextInitialized = false;
  let commonContext: string | "Mixed" | undefined;

  // Clip tracking
  let commonClipInitialized = false;
  let commonClip: boolean | "Mixed" | undefined;

  // Metadata tracking (only for single selection)
  let metadata;

  // Single iteration over all selected nodes
  for (const node of selectedNodes) {
    if (!node) continue;
    selectedNodesLength++;

    // Position computation
    const bounds = node.getWorldBounds();

    let nodeX = bounds.left;
    let nodeY = bounds.top;

    const parentBounds = node.parent?.getWorldBounds();
    if (parentBounds) {
      nodeX -= parentBounds.left;
      nodeY -= parentBounds.top;
    }

    const worldTransform = node.getWorldMatrix();
    const rotation = Math.atan2(worldTransform.b, worldTransform.a);

    if (isFirstNode) {
      commonPositionX = nodeX;
      commonPositionY = nodeY;
      commonRotation = rotation;
    } else {
      if (
        commonPositionX !== null &&
        !almostEquals(commonPositionX, nodeX, 1e-3)
      ) {
        commonPositionX = null;
      }
      if (
        commonPositionY !== null &&
        !almostEquals(commonPositionY, nodeX, 1e-3)
      ) {
        commonPositionY = null;
      }
      if (
        commonRotation !== null &&
        !almostEquals(commonRotation, rotation, 1e-4)
      ) {
        commonRotation = null;
      }
    }

    // Layout properties
    if (node.type === "frame" || node.type === "group") {
      commonlayoutModeInitialized = true;

      const currentIncludeStroke = node.properties.layoutIncludeStroke ?? false;
      const currentDirection = node.properties.layoutMode;
      const currentJustifyContent = node.properties.layoutJustifyContent;
      const currentAlignItems = node.properties.layoutAlignItems;

      commonIncludeStroke = merge(commonIncludeStroke, currentIncludeStroke);
      commonLayoutMode = merge(commonLayoutMode, currentDirection);
      commonChildSpacing = merge(
        commonChildSpacing,
        {
          value: node.properties.layoutChildSpacing ?? 0,
          resolved: node.properties.resolved.layoutChildSpacing ?? 0,
        },
        (a, b) =>
          compareValuesWithResolved(a, b, (a, b) => nearlyEqual(a, b, 0.01)),
      );

      commonPadding = merge(
        commonPadding,
        {
          value: node.properties.layoutPadding ?? [0, 0],
          resolved: node.properties.resolved.layoutPadding ?? [0, 0],
        },
        (a, b) => compareValuesWithResolved(a, b, comparePadding),
      );
      commonJustifyContent = merge(commonJustifyContent, currentJustifyContent);
      commonAlignItems = merge(commonAlignItems, currentAlignItems);
    }

    // Dimensions
    const localBounds = node.localBounds();

    const currentWidth = localBounds.width;
    if (commonWidth == null) {
      commonWidth = currentWidth;
    } else if (
      commonWidth !== "Mixed" &&
      !almostEquals(commonWidth, currentWidth)
    ) {
      commonWidth = "Mixed";
    }

    const currentHeight = localBounds.height;
    if (commonHeight == null) {
      commonHeight = currentHeight;
    } else if (
      commonHeight !== "Mixed" &&
      !almostEquals(commonHeight, currentHeight)
    ) {
      commonHeight = "Mixed";
    }

    // Sizing
    const currentHorizontalSizing =
      node.properties.horizontalSizing ?? SizingBehavior.Fixed;
    const currentVerticalSizing =
      node.properties.verticalSizing ?? SizingBehavior.Fixed;
    commonHorizontalSizing = merge(
      commonHorizontalSizing,
      currentHorizontalSizing,
    );
    commonVerticalSizing = merge(commonVerticalSizing, currentVerticalSizing);

    // Opacity
    commonOpacity = merge(
      commonOpacity,
      {
        value: node.properties.opacity,
        resolved: node.properties.resolved.opacity,
      },
      (a, b) =>
        compareValuesWithResolved(a, b, (a, b) => nearlyEqual(a, b, 0.01)),
    );

    // Corner radii
    if (node.type === "frame" || node.type === "rectangle") {
      commonCornerRadii = merge(
        commonCornerRadii,
        {
          value: node.properties.cornerRadius ?? DEFAULT_CORNER_RADII,
          resolved:
            node.properties.resolved.cornerRadius ?? DEFAULT_CORNER_RADII,
        },
        (a, b) =>
          compareValuesWithResolved(
            a,
            b,
            (a, b) =>
              a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3],
          ),
      );
    }

    // Stroke
    if (
      node.type === "frame" ||
      node.type === "rectangle" ||
      node.type === "path" ||
      node.type === "ellipse" ||
      node.type === "line" ||
      node.type === "polygon"
    ) {
      const alignment =
        node.properties.strokeAlignment ?? StrokeAlignment.Inside;

      if (!commonStrokeInitialized) {
        commonStrokeFills = node.properties.strokeFills && {
          value: node.properties.strokeFills,
          resolved: node.properties.resolved.strokeFills!,
        };
        commonStrokeWidth = {
          value: node.properties.strokeWidth ?? [0, 0, 0, 0],
          resolved: node.properties.resolved.strokeWidth ?? [0, 0, 0, 0],
        };
        commonStrokeAlignment = alignment;

        commonStrokeInitialized = true;
      } else {
        if (
          commonStrokeFills !== "Mixed" &&
          !deepEqual(commonStrokeFills?.value, node.properties.strokeFills)
        ) {
          commonStrokeFills = "Mixed";
        }

        if (
          commonStrokeWidth !== "Mixed" &&
          !deepEqual(commonStrokeWidth?.value, node.properties.strokeWidth)
        ) {
          commonStrokeWidth = "Mixed";
        }

        if (
          commonStrokeAlignment !== "Mixed" &&
          !deepEqual(commonStrokeAlignment, alignment)
        ) {
          commonStrokeAlignment = "Mixed";
        }
      }
    }

    // Text
    if (node.type === "text") {
      commonText = Object.assign<
        NonNullable<typeof commonText> | {},
        NonNullable<typeof commonText>
      >(commonText ?? {}, {
        fontFamily: merge(commonText?.fontFamily, {
          value: node.properties.fontFamily,
          resolved: node.properties.resolved.fontFamily,
        }),
        fontSize: merge(commonText?.fontSize, {
          value: node.properties.fontSize,
          resolved: node.properties.resolved.fontSize,
        }),
        fontWeight: merge(commonText?.fontWeight, {
          value: node.properties.fontWeight,
          resolved: node.properties.resolved.fontWeight,
        }),
        fontStyle: merge(commonText?.fontStyle, {
          value: node.properties.fontStyle,
          resolved: node.properties.resolved.fontStyle,
        }),
        textAlign: merge(commonText?.textAlign, node.properties.textAlign),
        textAlignVertical: merge(
          commonText?.textAlignVertical,
          node.properties.textAlignVertical,
        ),
        lineHeight: merge(commonText?.lineHeight, {
          value: node.properties.lineHeight,
          resolved: node.properties.resolved.lineHeight,
        }),
        letterSpacing: merge(commonText?.letterSpacing, {
          value: node.properties.letterSpacing,
          resolved: node.properties.resolved.letterSpacing,
        }),
        textGrowth: merge(commonText?.textGrowth, node.properties.textGrowth),
      });
    }

    // Icon font
    if (node.type === "icon_font") {
      iconFontIsVisible = true;

      const currentIconFontName =
        node.properties.resolved.iconFontName ?? "search";
      const currentIconFontFamily =
        node.properties.resolved.iconFontFamily ?? "Material Symbols Rounded";
      const currentIconFontWeight =
        node.properties.resolved.iconFontWeight ?? 200;
      commonIconFontName = merge(commonIconFontName, currentIconFontName);
      commonIconFontFamily = merge(commonIconFontFamily, currentIconFontFamily);
      commonIconFontWeight = merge(commonIconFontWeight, currentIconFontWeight);
    }

    // Effects
    if (!commonEffectsInitialized) {
      commonEffects = {
        value: node.properties.effects,
        resolved: node.properties.resolved.effects,
      };
      commonEffectsInitialized = true;
    } else {
      if (
        commonEffects !== "Mixed" &&
        !deepEqual(commonEffects?.value, node.properties.effects)
      ) {
        commonEffects = "Mixed";
      }
    }

    // Theme
    if (!commonThemeInitialized) {
      commonTheme = structuredClone(node.properties.theme);
      commonThemeInitialized = true;
    } else if (!deepEqual(commonTheme, node.properties.theme)) {
      commonTheme = "Mixed";
    }

    // Layer name
    const currentName =
      node.properties.name ||
      node.type.charAt(0).toUpperCase() + node.type.slice(1);
    commonName = merge(commonName, currentName);

    // Context name
    if (!commonContextInitialized) {
      commonContext = node.properties.context;
      commonContextInitialized = true;
    } else {
      commonContext = merge(commonContext, node.properties.context);
    }

    // Metadata
    if (selectedNodesLength === 1) {
      metadata = node.properties.metadata;
    }

    if (node.type === "frame") {
      commonClipInitialized = true;
      commonClip = merge(commonClip, node.properties.resolved.clip);
    }

    if (
      node.type === "frame" ||
      node.type === "rectangle" ||
      node.type === "path" ||
      node.type === "ellipse" ||
      node.type === "text" ||
      node.type === "line" ||
      node.type === "polygon" ||
      node.type === "icon_font"
    ) {
      if (!commonFillsInitialized) {
        commonFills = node.properties.fills && {
          value: node.properties.fills,
          resolved: node.properties.resolved.fills!,
        };
        commonFillsInitialized = true;
      } else {
        if (
          commonFills !== "Mixed" &&
          !deepEqual(commonFills?.value, node.properties.fills)
        ) {
          commonFills = "Mixed";
        }
      }
    }

    isFirstNode = false;
  }

  return {
    position: {
      x: commonPositionX !== null ? commonPositionX : "Mixed",
      y: commonPositionY !== null ? commonPositionY : "Mixed",
      rotation: commonRotation !== null ? commonRotation : "Mixed",
    },
    layoutMode: commonLayoutMode === "Mixed" ? undefined : commonLayoutMode,
    layoutModeInitialized: commonlayoutModeInitialized,
    layoutChildSpacing:
      commonChildSpacing === "Mixed"
        ? commonChildSpacing
        : {
            value: commonChildSpacing?.value ?? 1,
            resolved: commonChildSpacing?.resolved ?? 1,
          },
    layoutPadding:
      commonPadding === undefined || commonPadding === "Mixed"
        ? { value: [0, 0], resolved: [0, 0] }
        : commonPadding,

    layoutJustifyContent: commonJustifyContent ?? JustifyContent.Start,
    layoutAlignItems: commonAlignItems ?? AlignItems.Start,

    width: commonWidth ?? "Mixed",
    height: commonHeight ?? "Mixed",
    sizing: {
      horizontalSizing: commonHorizontalSizing ?? SizingBehavior.Fixed,
      verticalSizing: commonVerticalSizing ?? SizingBehavior.Fixed,
    },
    opacity:
      commonOpacity === "Mixed"
        ? commonOpacity
        : {
            value: commonOpacity?.value ?? 1,
            resolved: commonOpacity?.resolved ?? 1,
          },
    cornerRadii: commonCornerRadii ?? null,
    effects: commonEffects,
    fills: commonFills,
    stroke: {
      fills: commonStrokeFills,
      strokeWidth:
        commonStrokeWidth === "Mixed"
          ? commonStrokeWidth
          : {
              value: commonStrokeWidth?.value ?? [0, 0, 0, 0],
              resolved: commonStrokeWidth?.resolved ?? [0, 0, 0, 0],
            },
      strokeAlignment: commonStrokeAlignment ?? StrokeAlignment.Inside,
    },
    text: commonText,
    iconFont: {
      isVisible: iconFontIsVisible,
      iconFontName: commonIconFontName,
      iconFontFamily: commonIconFontFamily,
      iconFontWeight: commonIconFontWeight,
    },
    layerName: commonName ?? EMPTY_LAYER_NAME,
    context: commonContext,
    clipInitialized: commonClipInitialized,
    clip: commonClip ?? false,
    theme: commonTheme,
    metadata: selectedNodesLength === 1 ? metadata : undefined,
  };
}
