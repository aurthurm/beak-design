import type * as Schema from "@ha/schema";
import { logger } from "@ha/shared";
import {
  type Single,
  type Value,
  Variable,
  type VariableManager,
  type VariableType,
  type VariableValueType,
} from "../managers/variable-manager";
import { almostEqualsV2, radToDeg } from "../utils/math";
import { EffectType } from "./effect";
import { type Fill, FillType, type GradientFill, StretchMode } from "./fill";
import {
  AlignItems,
  JustifyContent,
  LayoutMode,
  SizingBehavior,
} from "./layout";
import {
  type NodeProperties,
  type NodeType,
  StrokeAlignment,
} from "./scene-graph";
import type { SceneNode } from "./scene-node";

export function serializeStroke(
  properties: NodeProperties,
  omitDefault: boolean = true,
): Schema.Stroke | undefined {
  if (omitDefault && properties.strokeWidth === undefined) {
    return undefined;
  }

  const stroke: Schema.Stroke = {};

  switch (properties.strokeAlignment) {
    case StrokeAlignment.Outside: {
      stroke.align = "outside";
      break;
    }
    case StrokeAlignment.Center: {
      stroke.align = "center";
      break;
    }
    case StrokeAlignment.Inside: {
      stroke.align = "inside";
      break;
    }
  }

  if (properties.strokeWidth !== undefined) {
    const serializedStrokeWidth = properties.strokeWidth.map((value) =>
      serializeValue(value),
    );

    if (
      serializedStrokeWidth[0] === serializedStrokeWidth[1] &&
      serializedStrokeWidth[0] === serializedStrokeWidth[2] &&
      serializedStrokeWidth[0] === serializedStrokeWidth[3]
    ) {
      stroke.thickness = serializedStrokeWidth[0];
    } else {
      stroke.thickness = {};

      if (serializedStrokeWidth[0]) {
        stroke.thickness.top = serializedStrokeWidth[0];
      }
      if (serializedStrokeWidth[1]) {
        stroke.thickness.right = serializedStrokeWidth[1];
      }
      if (serializedStrokeWidth[2]) {
        stroke.thickness.bottom = serializedStrokeWidth[2];
      }
      if (serializedStrokeWidth[3]) {
        stroke.thickness.left = serializedStrokeWidth[3];
      }
    }
  }

  if (properties.lineJoin && properties.lineJoin !== "miter") {
    stroke.join = properties.lineJoin;
  }

  if (properties.lineCap && properties.lineCap !== "none") {
    stroke.cap = properties.lineCap;
  }

  stroke.fill = serializeFill(properties.strokeFills);

  return stroke;
}

export function serializeEffects(
  effects: NodeProperties["effects"],
  omitDefault: boolean = true,
): Schema.Effects | undefined {
  const result: Schema.Effect[] = [];

  for (const effect of effects ?? []) {
    switch (effect.type) {
      case EffectType.LayerBlur: {
        const item: Schema.Effect = {
          type: "blur",
          radius: serializeValue(effect.radius),
        };

        if (effect.enabled !== true) {
          item.enabled = serializeValue(effect.enabled);
        }

        result.push(item);
        break;
      }

      case EffectType.DropShadow: {
        const item: Schema.Effect = {
          type: "shadow",
          shadowType: "outer",
        };

        if (effect.enabled !== true) {
          item.enabled = serializeValue(effect.enabled);
        }

        item.color = serializeValue(effect.color);

        if (effect.offsetX !== 0 || effect.offsetY !== 0) {
          item.offset = {
            x: serializeValue(effect.offsetX),
            y: serializeValue(effect.offsetY),
          };
        }

        if (effect.radius !== 0) {
          item.blur = serializeValue(effect.radius);
        }

        if (effect.spread !== 0) {
          item.spread = serializeValue(effect.spread);
        }

        if (effect.blendMode && effect.blendMode !== "normal") {
          item.blendMode = effect.blendMode;
        }

        result.push(item);
        break;
      }

      case EffectType.BackgroundBlur: {
        const item: Schema.Effect = {
          type: "background_blur",
          radius: serializeValue(effect.radius),
        };

        if (effect.enabled !== true) {
          item.enabled = serializeValue(effect.enabled);
        }

        result.push(item);

        break;
      }

      default: {
        const missing: never = effect;
        logger.error(`Unsupported effect type: ${missing}`);
        break;
      }
    }
  }

  if (result.length === 1) {
    return result[0];
  } else if (result.length > 0) {
    return result;
  } else {
    return omitDefault ? undefined : [];
  }
}

function serializeGradientType(
  fill: GradientFill,
): NonNullable<Extract<Schema.Fill, { type: "gradient" }>["gradientType"]> {
  const type = fill.type;
  switch (type) {
    case FillType.RadialGradient:
      return "radial";
    case FillType.AngularGradient:
      return "angular";
    case FillType.LinearGradient:
      return "linear";
    default: {
      const missing: never = type;
      throw new Error(`Unknown gradient type: ${missing}`);
    }
  }
}

export function serializeFill(
  fills: ReadonlyArray<Fill> | undefined,
  omitDefault: boolean = true,
): Schema.Fills | undefined {
  const converted: Schema.Fill[] = [];

  for (const fill of fills ?? []) {
    const type = fill.type;

    const blendMode =
      fill.blendMode && fill.blendMode !== "normal"
        ? fill.blendMode
        : undefined;

    switch (type) {
      case FillType.Color: {
        const item: Extract<Schema.Fill, { type: "color" }> = {
          type: "color",
          color: serializeValue(fill.color),
          enabled: serializeValue(fill.enabled),
          blendMode,
        };

        // NOTE(sedivy): For simple color fills serialize the string directly.
        if (fill.enabled && !item.blendMode) {
          converted.push(item.color);
        } else {
          converted.push(item);
        }
        break;
      }

      case FillType.RadialGradient:
      case FillType.AngularGradient:
      case FillType.LinearGradient: {
        const item: Extract<Schema.Fill, { type: "gradient" }> = {
          type: "gradient",
          gradientType: serializeGradientType(fill),
          enabled: serializeValue(fill.enabled),
          opacity:
            fill.opacityPercent === 100
              ? undefined
              : serializeValue(fill.opacityPercent, (value) => value / 100),
          rotation: serializeValue(fill.rotationDegrees),
          size: {
            width:
              type === FillType.LinearGradient
                ? undefined // NOTE(sedivy): Width is unused for linear gradients.
                : serializeValue(fill.size[0]),

            height: serializeValue(fill.size[1]),
          },
          colors: fill.stops.map((stop) => ({
            color: serializeValue(stop.color),
            position: serializeValue(stop.position),
          })),
          blendMode,
        };

        const hasX = fill.center[0] !== 0.5;
        const hasY = fill.center[1] !== 0.5;

        if (hasX || hasY) {
          item.center = {
            x: hasX ? fill.center[0] : undefined,
            y: hasY ? fill.center[1] : undefined,
          };
        }

        converted.push(item);
        break;
      }

      case FillType.Image: {
        const item: Extract<Schema.Fill, { type: "image" }> = {
          type: "image",
          opacity:
            fill.opacityPercent === 100
              ? undefined
              : serializeValue(fill.opacityPercent, (value) => value / 100),
          enabled: serializeValue(fill.enabled),
          url: serializeValue(fill.url),
          mode: serializeStretchMode(fill.mode),
          blendMode,
        };

        converted.push(item);
        break;
      }

      case FillType.MeshGradient: {
        const tangentScaleX = 0.25 / Math.max(fill.columns - 1, 1);
        const tangentScaleY = 0.25 / Math.max(fill.rows - 1, 1);

        const defaultLeftHandle: [number, number] = [-tangentScaleX, 0];
        const defaultRightHandle: [number, number] = [tangentScaleX, 0];
        const defaultTopHandle: [number, number] = [0, -tangentScaleY];
        const defaultBottomHandle: [number, number] = [0, tangentScaleY];

        const item: Extract<Schema.Fill, { type: "mesh_gradient" }> = {
          type: "mesh_gradient",
          opacity:
            fill.opacityPercent === 100
              ? undefined
              : serializeValue(fill.opacityPercent, (value) => value / 100),
          enabled: serializeValue(fill.enabled),
          columns: fill.columns,
          rows: fill.rows,
          colors: fill.points.map((point) => serializeValue(point.color)),
          points: fill.points.map((point) => {
            const isDefaultLeft = almostEqualsV2(
              point.leftHandle,
              defaultLeftHandle,
              1e-4,
            );
            const isDefaultRight = almostEqualsV2(
              point.rightHandle,
              defaultRightHandle,
              1e-4,
            );
            const isDefaultTop = almostEqualsV2(
              point.topHandle,
              defaultTopHandle,
              1e-4,
            );
            const isDefaultBottom = almostEqualsV2(
              point.bottomHandle,
              defaultBottomHandle,
              1e-4,
            );

            const roundV2 = (v: [number, number]): [number, number] => [
              Math.round(v[0] * 1e4) / 1e4,
              Math.round(v[1] * 1e4) / 1e4,
            ];

            if (
              isDefaultLeft &&
              isDefaultRight &&
              isDefaultTop &&
              isDefaultBottom
            ) {
              return roundV2(point.position);
            }

            return {
              position: roundV2(point.position),
              leftHandle: isDefaultLeft ? undefined : roundV2(point.leftHandle),
              rightHandle: isDefaultRight
                ? undefined
                : roundV2(point.rightHandle),
              topHandle: isDefaultTop ? undefined : roundV2(point.topHandle),
              bottomHandle: isDefaultBottom
                ? undefined
                : roundV2(point.bottomHandle),
            };
          }),
          blendMode,
        };

        converted.push(item);
        break;
      }

      default: {
        const missing: never = type;
        logger.error(`Unsupported fill type: ${missing}`);
        break;
      }
    }
  }

  if (converted.length === 1) {
    return converted[0];
  } else if (converted.length > 1) {
    return converted;
  } else {
    return omitDefault ? undefined : [];
  }
}

export function serializeCommon(
  node: SceneNode,
  resolveVariables: boolean,
): Schema.Entity {
  const properties = resolveVariables
    ? node.properties.resolved
    : node.properties;

  const output: Schema.Entity = {
    id: node.path, // NOTE(zaza): using `path` to produce unique ids even when using `resolveInstances == true` (see `FileManager.serializeNode()`!).
  };

  if (!node.isInLayout()) {
    output.x = properties.x;
    output.y = properties.y;
  }

  if (properties.name) {
    output.name = properties.name;
  }

  if (properties.context && properties.context.length !== 0) {
    output.context = properties.context;
  }

  if (!resolveVariables && node.properties.theme) {
    output.theme = Object.fromEntries(node.properties.theme.entries());
  }

  if (node.reusable) {
    output.reusable = true;
  }

  if (properties.enabled !== true) {
    output.enabled = serializeValue(properties.enabled);
  }

  if (properties.opacity != null && properties.opacity !== 1) {
    output.opacity = serializeValue(properties.opacity);
  }

  if (properties.rotation != null && properties.rotation !== 0) {
    output.rotation = serializeValue(properties.rotation, serializeRotation);
  }

  if (properties.flipX) {
    output.flipX = serializeValue(properties.flipX);
  }

  if (properties.flipY) {
    output.flipY = serializeValue(properties.flipY);
  }

  if (properties.metadata) {
    output.metadata = properties.metadata;
  }

  return output;
}

export function serializeCornerRadius(
  cornerRadius: NodeProperties["cornerRadius"],
  omitDefault: boolean = true,
): Schema.Rectangle["cornerRadius"] {
  if (cornerRadius === undefined) {
    return omitDefault ? undefined : 0;
  }

  const serializedCornerRadii = cornerRadius.map((value) =>
    serializeValue(value),
  );
  if (
    omitDefault &&
    serializedCornerRadii[0] === 0 &&
    serializedCornerRadii[1] === 0 &&
    serializedCornerRadii[2] === 0 &&
    serializedCornerRadii[3] === 0
  ) {
    return undefined;
  }

  const first = serializedCornerRadii[0];
  if (
    serializedCornerRadii[1] === first &&
    serializedCornerRadii[2] === first &&
    serializedCornerRadii[3] === first
  ) {
    return first;
  } else {
    return serializedCornerRadii as Schema.Rectangle["cornerRadius"];
  }
}

export function serializeSize(
  output: Schema.Size,
  node: SceneNode,
  resolveVariables: boolean,
  defaultSizing: SizingBehavior = SizingBehavior.Fixed,
) {
  const properties = resolveVariables
    ? node.properties.resolved
    : node.properties;

  output.width = serializeSingleAxisSize(
    node,
    properties.width,
    properties.horizontalSizing,
    defaultSizing,
  );
  output.height = serializeSingleAxisSize(
    node,
    properties.height,
    properties.verticalSizing,
    defaultSizing,
  );
}

export function serializeLayoutMode(
  layoutMode: LayoutMode,
  nodeType: NodeType,
  omitDefault: boolean = true,
): Schema.Layout["layout"] {
  const defaultLayoutMode =
    nodeType === "frame" ? LayoutMode.Horizontal : LayoutMode.None;
  if (omitDefault && layoutMode === defaultLayoutMode) {
    return undefined;
  } else {
    switch (layoutMode) {
      case LayoutMode.Horizontal:
        return "horizontal";
      case LayoutMode.Vertical:
        return "vertical";
      case LayoutMode.None:
        return "none";
      default: {
        const missing: never = layoutMode;
        logger.error(`Unknown layout mode: ${missing}`);
        return undefined;
      }
    }
  }
}

export function serializePadding(
  layoutPadding: NodeProperties["layoutPadding"],
  omitDefault: boolean = true,
): Schema.Layout["padding"] {
  if (layoutPadding !== undefined) {
    let serializedPadding;
    if (Array.isArray(layoutPadding)) {
      serializedPadding = layoutPadding.map((value) => serializeValue(value));
      if (
        serializedPadding.length === 4 &&
        serializedPadding[0] === serializedPadding[2] &&
        serializedPadding[1] === serializedPadding[3]
      ) {
        serializedPadding = [serializedPadding[0], serializedPadding[1]];
      }
      if (
        serializedPadding.length === 2 &&
        serializedPadding[0] === serializedPadding[1]
      ) {
        serializedPadding = serializedPadding[0];
      }
    } else {
      serializedPadding = serializeValue(layoutPadding);
    }
    if (!omitDefault || serializedPadding !== 0) {
      return serializedPadding as Schema.Layout["padding"];
    }
  }
  return undefined;
}

export function serializeJustifyContent(
  layoutJustifyContent: NodeProperties["layoutJustifyContent"],
  omitDefault: boolean = true,
): Schema.Layout["justifyContent"] {
  switch (layoutJustifyContent) {
    case JustifyContent.Start:
      // NOTE(sedivy): Start is the default value.
      return omitDefault ? undefined : "start";
    case JustifyContent.Center:
      return "center";
    case JustifyContent.End:
      return "end";
    case JustifyContent.SpaceBetween:
      return "space_between";
    case JustifyContent.SpaceAround:
      return "space_around";
    default: {
      const missing: never = layoutJustifyContent;
      logger.error(`Unknown justify content: ${missing}`);
      return undefined;
    }
  }
}

export function serializeAlignItems(
  layoutAlignItems: NodeProperties["layoutAlignItems"],
  omitDefault: boolean = true,
): Schema.Layout["alignItems"] {
  switch (layoutAlignItems) {
    case AlignItems.Start:
      // NOTE(sedivy): Start is the default value.
      return omitDefault ? undefined : "start";
    case AlignItems.Center:
      return "center";
    case AlignItems.End:
      return "end";
    default: {
      const missing: never = layoutAlignItems;
      logger.error(`Unknown align items: ${missing}`);
      return undefined;
    }
  }
}

export function serializeLayout(
  output: Schema.Layout,
  properties: Readonly<NodeProperties>,
  nodeType: NodeType,
) {
  output.layout = serializeLayoutMode(properties.layoutMode, nodeType);

  if (properties.layoutMode === LayoutMode.None) {
    return;
  }

  if (
    properties.layoutChildSpacing != null &&
    properties.layoutChildSpacing !== 0
  ) {
    output.gap = serializeValue(properties.layoutChildSpacing);
  }

  output.padding = serializePadding(properties.layoutPadding);
  output.justifyContent = serializeJustifyContent(
    properties.layoutJustifyContent,
  );
  output.alignItems = serializeAlignItems(properties.layoutAlignItems);

  if (properties.layoutIncludeStroke) {
    output.layoutIncludeStroke = true;
  }
}

function serializeSizing(
  sizing: SizingBehavior.FillContainer | SizingBehavior.FitContent,
  defaultSizing: SizingBehavior,
  fallback: number,
  includeFallback: boolean,
): number | string | undefined {
  if (!includeFallback && sizing === defaultSizing) {
    return undefined;
  }

  switch (sizing) {
    case SizingBehavior.FitContent:
      return `fit_content${includeFallback ? `(${fallback})` : ""}`;
    case SizingBehavior.FillContainer:
      return `fill_container${includeFallback ? `(${fallback})` : ""}`;
    default: {
      const missing: never = sizing;
      logger.error(`Unknown sizing sizing: ${missing}`);
      return undefined;
    }
  }
}

export function serializeSingleAxisSize(
  node: SceneNode,
  number: number,
  sizing: SizingBehavior,
  defaultSizing: SizingBehavior = SizingBehavior.Fixed,
): number | Schema.SizingBehavior | undefined {
  switch (sizing) {
    case SizingBehavior.FitContent: {
      const isValid = node.hasLayout() && node.children.length;
      return serializeSizing(sizing, defaultSizing, number, !isValid);
    }

    case SizingBehavior.FillContainer: {
      const isValid = node.isInLayout();
      return serializeSizing(sizing, defaultSizing, number, !isValid);
    }

    case SizingBehavior.Fixed: {
      return number;
    }

    default: {
      const missing: never = sizing;
      logger.error(`Unknown sizing sizing: ${missing}`);
      return number;
    }
  }
}

export function serializeRotation(rotation: number): number {
  return -radToDeg(rotation);
}

export function serializeValue<T extends Single<VariableType>>(
  value: Value<T>,
  map?: (value: VariableValueType<T>) => VariableValueType<T>,
): string | VariableValueType<T> {
  return value instanceof Variable
    ? `$${value.name}`
    : map
      ? map(value)
      : value;
}

export function serializeOptionalValue<T extends Single<VariableType>>(
  value?: Value<T>,
  map?: (value: VariableValueType<T>) => VariableValueType<T>,
): string | VariableValueType<T> | undefined {
  return value === undefined ? undefined : serializeValue(value, map);
}

export function serializeVariables(
  variables: Variable<any>[],
): Schema.Document["variables"] {
  return variables.length === 0
    ? undefined
    : (Object.fromEntries(
        variables.map((variable) => [
          variable.name,
          {
            type: variable.type,
            value:
              variable.values.length === 1 && !variable.values[0].theme
                ? variable.values[0].value
                : variable.values.map((themedValue) => ({
                    value: themedValue.value,
                    theme:
                      themedValue.theme &&
                      Object.fromEntries(themedValue.theme.entries()),
                  })),
          },
        ]),
      ) as any); // NOTE(zaza): complicated, due to different variable types.
}

export function serializeThemes(
  themes: VariableManager["themes"],
): Schema.Document["themes"] {
  return themes.size !== 0
    ? Object.fromEntries(
        themes.entries().map(([axis, values]) => [axis, [...values]]),
      )
    : undefined;
}

export function serializeStretchMode(
  mode: StretchMode | undefined,
): Extract<Schema.Fill, { type: "image" }>["mode"] {
  if (mode === undefined) {
    return undefined;
  }

  switch (mode) {
    case StretchMode.Fill:
      return "fill";
    case StretchMode.Fit:
      return "fit";
    case StretchMode.Stretch:
      return "stretch";
    default: {
      const missing: never = mode;
      throw new Error(`Unknown stretch mode: ${missing}`);
    }
  }
}
