import {
  type ColorFill,
  canonicalizeHexColor,
  clamp,
  colorToHex,
  type Fill,
  FillType,
  type GradientFill,
  hexToColor,
  type MeshGradientFill,
  type ObjectUpdateBlock,
  type Resolved,
  type SceneNode,
  Variable,
} from "@ha/pencil-editor";
import { logger } from "@ha/shared";
import { Eye, EyeOff, Minus, Plus } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { InputIcon } from "@/src/components/input-icon";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/src/components/popover";
import { useSceneManager } from "@/src/pages/Editor";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import { FillEditor } from "./FillEditor";
import { IconButton } from "./icon-button";
import type { ValueWithResolved } from "./properties-compute";
import { blockUpdate } from "./shared-handlers";

function convertGradientToCssStyle(fill: Resolved<GradientFill>): string {
  const stops = fill.stops
    .toSorted((a, b) => a.position - b.position)
    .map((stop) => {
      return `${stop.color} ${clamp(0, stop.position * 100, 100).toFixed(1)}%`;
    })
    .join(", ");

  const centerX = fill.center[0] * 100;
  const centerY = fill.center[1] * 100;

  const rotation = fill.rotationDegrees * -1;

  switch (fill.type) {
    case FillType.LinearGradient:
      return `linear-gradient(${rotation}deg, ${stops})`;
    case FillType.RadialGradient:
      return `radial-gradient(circle at ${centerX}% ${centerY}%, ${stops})`;
    case FillType.AngularGradient:
      return `conic-gradient(from ${rotation}deg at ${centerX}% ${centerY}%, ${stops})`;
    default: {
      const missing: never = fill.type;
      logger.error(`Unknown gradient type: "${missing}"`);
      return "";
    }
  }
}

// TODO(sedivy): This is just a simple estimation of a mesh gradient as a linear gradient.
function convertMeshGradientToCssStyle(
  fill: Resolved<MeshGradientFill>,
): string {
  if (fill.points.length === 0) {
    return "";
  }

  if (fill.points.length === 1) {
    return fill.points[0].color;
  }

  const uniqueColors = [...new Set(fill.points.map((p) => p.color))];

  const stops = uniqueColors
    .map((color, i) => {
      const position = (i / (uniqueColors.length - 1)) * 100;
      return `${color} ${position.toFixed(1)}%`;
    })
    .join(", ");

  return `linear-gradient(90deg, ${stops})`;
}

export function FillPreview({
  fill,
  className,
  onMouseDown,
}: {
  fill: Resolved<Fill>;
  className?: string;
  onMouseDown?: () => void;
}) {
  const type = fill.type;
  let style = {};

  // TODO(sedivy): Instead of converting the Fill to CSS, we should render a
  // small preview bitmap with our renderer. Otherwise we won't be able to
  // correctly preview more complex fills.

  switch (type) {
    case FillType.Color:
      style = { backgroundColor: fill.color };
      break;
    case FillType.LinearGradient:
    case FillType.RadialGradient:
    case FillType.AngularGradient:
      style = { background: convertGradientToCssStyle(fill) };
      break;
    case FillType.MeshGradient:
      style = { background: convertMeshGradientToCssStyle(fill) };
      break;
    case FillType.Image:
      break;
  }

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();

        onMouseDown?.();
      }}
      className={className || "w-4 h-4 border border-input rounded-[4px]"}
      style={style}
    />
  );
}

export function getFillDisplayValue(fill: Resolved<Fill>): string {
  const type = fill.type;
  switch (type) {
    case FillType.Color:
      return fill.color;
    case FillType.LinearGradient:
      return "Linear";
    case FillType.RadialGradient:
      return "Radial";
    case FillType.AngularGradient:
      return "Angular";
    case FillType.Image:
      return "Image";
    case FillType.MeshGradient:
      return "Mesh";
    default: {
      const missing: never = type;
      logger.error(`Unknown fill type: "${missing}"`);
      return "Unknown";
    }
  }
}

function fillAlpha(fill: Resolved<Fill>): number {
  const type = fill.type;
  switch (type) {
    case FillType.Color:
      return Math.round(hexToColor(fill.color)[3] * 100);

    case FillType.LinearGradient:
    case FillType.RadialGradient:
    case FillType.AngularGradient:
    case FillType.Image:
    case FillType.MeshGradient:
      return fill.opacityPercent;

    default: {
      const missing: never = type;
      logger.error(`Unknown fill type: "${missing}"`);
      return 100;
    }
  }
}

export function FillListItem({
  fills,
  index,
  onCommit,
  openFillEditor,
  isEditing,
}: {
  fills: ValueWithResolved<ReadonlyArray<Fill>>;
  index: number;
  onCommit: (fills: ReadonlyArray<Fill>) => void;
  openFillEditor: (index: number) => void;
  isEditing: boolean;
}) {
  const fill = useMemo(() => {
    return { value: fills.value[index], resolved: fills.resolved[index] };
  }, [fills, index]);

  const onFillCommit = useCallback(
    (newFill: Fill) => {
      const cloned = [...fills.value];
      cloned[index] = newFill;
      onCommit(cloned);
    },
    [fills, index, onCommit],
  );

  const toggleEnabled = useCallback(() => {
    const cloned = [...fills.value];
    cloned[index] = { ...fill.value, enabled: !fill.resolved.enabled };
    onCommit(cloned);
  }, [fills, index, fill, onCommit]);

  const removeFill = useCallback(() => {
    const cloned = [...fills.value];
    cloned.splice(index, 1);
    onCommit(cloned);
  }, [fills, index, onCommit]);

  const preview = useMemo(() => {
    return (
      <FillPreview
        fill={fill.resolved}
        onMouseDown={() => {
          openFillEditor(index);
        }}
      />
    );
  }, [fill, openFillEditor, index]);

  const isVariable =
    fill.value.type === FillType.Color && fill.value.color instanceof Variable;

  return (
    <div key={index} className="flex gap-0.5 relative">
      {isEditing && (
        <div className="absolute bg-accent left-[-10px] top-[-2px] bottom-[-2px] right-[-10px]"></div>
      )}

      <div className="w-36 flex">
        {fill.value.type === FillType.Color ? (
          <InputIcon
            draggable={false}
            wrapperClassName="w-full"
            className={`h-6 text-xxs border border-input ${isVariable ? "rounded-sm" : "rounded$-l-sm rounded-r-none"}`}
            readOnly={fill.resolved.type !== FillType.Color}
            icon={preview}
            displayVariableName
            value={{
              value: fill.value.color,
              resolved: (fill.resolved as Resolved<ColorFill>).color,
            }}
            variables="color"
            onCommit={(value) => {
              // NOTE(sedivy): Normalize the hex color.
              if (typeof value === "string") {
                value = canonicalizeHexColor(value);
              }

              // NOTE(sedivy): When unlinking the variable, use the current resolved color.
              if (value == null) {
                value = (fill.resolved as Resolved<ColorFill>).color;
              }

              onFillCommit({
                ...fill.value,
                color: value,
              } as ColorFill);
            }}
          />
        ) : (
          <InputIcon
            draggable={false}
            wrapperClassName="w-full"
            className={`h-6 text-xxs border border-input ${isVariable ? "rounded-sm" : "rounded$-l-sm rounded-r-none"}`}
            onMouseDown={() => {
              openFillEditor(index);
            }}
            readOnly={true}
            icon={preview}
            value={getFillDisplayValue(fill.resolved)}
          />
        )}

        {!isVariable && (
          <InputIcon
            className="h-6 text-xxs w-13 border border-l-0 border-input rounded-r-sm rounded-l-none"
            allowArrowKeysChange
            letter="%"
            iconPosition="right"
            value={fillAlpha(fill.resolved)}
            onCommit={(value) => {
              const float = parseFloat(value);
              if (!Number.isNaN(float)) {
                const type = fill.value.type;
                switch (type) {
                  case FillType.LinearGradient:
                  case FillType.RadialGradient:
                  case FillType.AngularGradient:
                  case FillType.Image:
                  case FillType.MeshGradient: {
                    const cloned = {
                      ...fill.value,
                    };
                    cloned.opacityPercent = clamp(0, float, 100);
                    onFillCommit(cloned);
                    break;
                  }

                  case FillType.Color: {
                    const color = hexToColor(
                      (fill.resolved as Resolved<ColorFill>).color,
                    );
                    color[3] = clamp(0, float / 100, 1);

                    onFillCommit({
                      ...fill.value,
                      color: colorToHex(color),
                    } as ColorFill);
                    break;
                  }

                  default: {
                    const missing: never = type;
                    logger.error(`Unknown fill type: "${missing}"`);
                    break;
                  }
                }
              }
            }}
          />
        )}
      </div>

      <div className="flex">
        <IconButton
          icon={fill.resolved.enabled ? Eye : EyeOff}
          onClick={toggleEnabled}
        />

        <IconButton icon={Minus} onClick={removeFill} />
      </div>
    </div>
  );
}

export function FillList({
  fills,
  onCommit,
}: {
  fills: ValueWithResolved<ReadonlyArray<Fill>> | undefined | "Mixed";
  onCommit: (fills: ReadonlyArray<Fill>) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const openFillEditor = useCallback(
    (index: number) => {
      if (fills == null || fills === "Mixed") {
        return;
      }

      setEditingIndex(index);
    },
    [fills],
  );

  const handleFillCommit = useCallback(
    (fill: Fill) => {
      if (fills == null || fills === "Mixed" || editingIndex == null) {
        return;
      }

      const cloned = [...fills.value];
      cloned[editingIndex] = fill;
      onCommit(cloned);
    },
    [fills, editingIndex, onCommit],
  );

  let result;

  if (fills === "Mixed") {
    result = <div className="text-center opacity-60">Mixed fills</div>;
  } else if (fills == null) {
    result = null;
  } else if (fills.value.length > 0) {
    result = [];

    for (let i = fills.value.length - 1; i >= 0; i--) {
      result.push(
        <FillListItem
          key={i}
          isEditing={editingIndex === i}
          fills={fills}
          index={i}
          onCommit={onCommit}
          openFillEditor={openFillEditor}
        />,
      );
    }
  }

  if (!result) {
    return null;
  }

  const editingFill =
    fills != null &&
    fills !== "Mixed" &&
    editingIndex != null &&
    editingIndex < fills.value.length
      ? {
          value: fills.value[editingIndex],
          resolved: fills.resolved[editingIndex],
        }
      : null;

  return (
    <Popover
      open={editingIndex != null}
      onOpenChange={(open) => !open && setEditingIndex(null)}
      modal={false}
    >
      <PopoverAnchor asChild>
        <div className="flex flex-col gap-1">{result}</div>
      </PopoverAnchor>

      <PopoverContent
        className="w-[250px] p-0 !animate-none"
        side="left"
        align="center"
        sideOffset={20}
        collisionPadding={10}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // NOTE(sedivy): Allow clicking on the canvas without closing the popover.
          if (
            e.currentTarget instanceof Element &&
            e.currentTarget.closest("[data-pencil-canvas-container]")
          ) {
            e.preventDefault();
          }
        }}
      >
        {editingFill && editingIndex != null && (
          <FillEditor fill={editingFill} onCommit={handleFillCommit} />
        )}
      </PopoverContent>
    </Popover>
  );
}

export const FillSection = React.memo(function FillSection({
  fills,
}: {
  fills: ValueWithResolved<ReadonlyArray<Fill>> | undefined | "Mixed";
}): React.ReactElement {
  const manager = useSceneManager();

  const commitFills = useCallback(
    (fills: ReadonlyArray<Fill>) => {
      blockUpdate(manager, (block: ObjectUpdateBlock, node: SceneNode) => {
        block.update(node, {
          fills: fills,
        });
      });
    },
    [manager],
  );

  const addFill = useCallback(() => {
    const cloned: Fill[] =
      fills === "Mixed" || fills == null ? [] : [...fills.value];

    cloned.push({
      type: FillType.Color,
      enabled: true,
      color:
        // TODO(sedivy): When changing fills for "Mixed" we should probably
        // use the first selected node for the common fill.
        fills === "Mixed" || cloned.length === 0 ? "#d9d9d9ff" : "#00000033",
    });

    commitFills(cloned);
  }, [fills, commitFills]);

  return (
    <Section>
      <div className="flex items-center justify-between text-secondary-foreground">
        <SectionTitle title="Fill" />
        <IconButton icon={Plus} onClick={addFill} />
      </div>

      <FillList fills={fills} onCommit={commitFills} />
    </Section>
  );
});

export default FillSection;
