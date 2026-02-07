import * as Schema from "@ha/schema";
import { Eye, EyeOff, Minus, Pencil, Plus } from "lucide-react";
import React from "react";
import { InputIcon } from "@/src/components/input-icon";
import { Label } from "@/src/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/popover";
import { logger } from "@ha/shared";
import { cn } from "@/src/lib/utils";
import { useSceneManager } from "@/src/pages/Editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/select";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import { IconButton } from "./icon-button";
import type { ValueWithResolved } from "./properties-compute";
import { blockUpdate } from "./shared-handlers";
import {
  type BackgroundBlurEffect,
  type DropShadowEffect,
  type Effect,
  type LayerBlurEffect,
  EffectType,
  colorToHex,
  hexToColor,
  Variable,
  type Resolved,
  type NodeProperties,
  type SceneManager,
  type SceneNode,
  type ObjectUpdateBlock,
} from "@ha/pencil-editor";

function commitEffects(
  manager: SceneManager,
  effects: NodeProperties["effects"],
) {
  blockUpdate(manager, (block: ObjectUpdateBlock, node: SceneNode) => {
    block.update(node, {
      effects: effects,
    });
  });
}

function nameForEffect(type: EffectType): string {
  switch (type) {
    case EffectType.DropShadow:
      return "Drop Shadow";
    case EffectType.LayerBlur:
      return "Layer Blur";
    case EffectType.BackgroundBlur:
      return "Background Blur";
    default: {
      const missing: never = type;
      logger.error(`Unknown effect type: "${missing}"`);
      return "Unknown";
    }
  }
}

function EffectDropdownItem({
  type,
  disabled,
}: {
  type: EffectType;
  disabled?: boolean;
}) {
  return (
    <SelectItem
      key={type}
      value={String(type)}
      className="text-xs"
      disabled={disabled}
    >
      {nameForEffect(type)}
    </SelectItem>
  );
}

function isEffectDisabled(
  effects: ReadonlyArray<Effect>,
  currentType: EffectType,
  checkType: EffectType,
): boolean {
  if (currentType === checkType) {
    return false;
  }

  switch (checkType) {
    case EffectType.DropShadow: {
      return false;
    }
    case EffectType.LayerBlur: {
      // NOTE: Only one layer blur allowed.
      return effects.some((e) => e.type === EffectType.LayerBlur);
    }
    case EffectType.BackgroundBlur: {
      // NOTE: Only one background blur allowed.
      return effects.some((e) => e.type === EffectType.BackgroundBlur);
    }
    default: {
      const missing: never = checkType;
      logger.error(`Unknown effect type: "${missing}"`);
      return true;
    }
  }
}

function EffectTypeSelect({
  effects,
  effect,
  onValueChange,
}: {
  effects: ValueWithResolved<NodeProperties["effects"]>;
  effect: Effect;
  onValueChange: (type: EffectType) => void;
}) {
  return (
    <Select
      value={String(effect.type)}
      onValueChange={(value) => {
        onValueChange(parseInt(value, 10) as EffectType);
      }}
    >
      <SelectTrigger noChevron className="h-6 text-xxs" size="sm">
        <SelectValue>{nameForEffect(effect.type)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <EffectDropdownItem
          disabled={isEffectDisabled(
            effects.resolved!,
            effect.type,
            EffectType.DropShadow,
          )}
          type={EffectType.DropShadow}
        />
        <EffectDropdownItem
          disabled={isEffectDisabled(
            effects.resolved!,
            effect.type,
            EffectType.LayerBlur,
          )}
          type={EffectType.LayerBlur}
        />
        <EffectDropdownItem
          disabled={isEffectDisabled(
            effects.resolved!,
            effect.type,
            EffectType.BackgroundBlur,
          )}
          type={EffectType.BackgroundBlur}
        />
      </SelectContent>
    </Select>
  );
}

function defaultEffectForType(type: EffectType): Resolved<Effect> {
  switch (type) {
    case EffectType.DropShadow:
      return {
        type: EffectType.DropShadow,
        enabled: true,
        color: colorToHex([0, 0, 0, 0.25]),
        radius: 4,
        offsetX: 0,
        offsetY: 4,
        spread: 0,
        blendMode: "normal",
      };
    case EffectType.LayerBlur:
      return {
        type: EffectType.LayerBlur,
        enabled: true,
        radius: 4,
      };
    case EffectType.BackgroundBlur:
      return {
        type: EffectType.BackgroundBlur,
        enabled: true,
        radius: 4,
      };

    default: {
      const missing: never = type;
      throw new Error(`Unknown effect type: "${missing}"`);
    }
  }
}

function DropShadowDetail({
  effect,
  onCommit,
}: {
  effect: ValueWithResolved<DropShadowEffect>;
  onCommit: (effect: DropShadowEffect) => void;
}) {
  const parsedColor = hexToColor(effect.resolved.color);

  return (
    <div className="grid gap-2 grid-cols-[min-content_1fr] text-xxs">
      <Label className="text-xxs">Color</Label>
      <div className="flex gap-1">
        <InputIcon
          letter=""
          isSwatch={true}
          variables={"color"}
          value={{ value: effect.value.color, resolved: effect.resolved.color }}
          onCommit={(value) => {
            onCommit({
              ...effect.value,
              color: value ?? effect.resolved.color,
            });
          }}
          className="h-6 text-xxs flex-1"
        />

        <InputIcon
          allowArrowKeysChange
          letter="%"
          iconPosition="right"
          value={Math.round(parsedColor[3] * 100)}
          onCommit={(value) => {
            const float = parseFloat(value);
            if (!Number.isNaN(float)) {
              const clamped = Math.min(100, Math.max(0, float));
              onCommit({
                ...effect.value,
                color: colorToHex([
                  parsedColor[0],
                  parsedColor[1],
                  parsedColor[2],
                  clamped / 100,
                ]),
              });
            }
          }}
          className="h-6 text-xxs w-12"
        />
      </div>
      <Label className="text-xxs">Blur</Label>
      <InputIcon
        allowArrowKeysChange
        letter="B"
        variables={"number"}
        value={{ value: effect.value.radius, resolved: effect.resolved.radius }}
        step={0.1}
        stepDistance={40}
        onCommit={(value) => {
          let radius;
          if (value instanceof Variable) {
            radius = value;
          } else if (value === undefined || value === "") {
            radius = Math.max(0, effect.resolved.radius);
          } else {
            const float = parseFloat(value);
            if (!Number.isNaN(float)) {
              radius = Math.max(0, float);
            }
          }
          if (radius !== undefined) {
            onCommit({ ...effect.value, radius });
          }
        }}
        className="col-span-2 h-6 text-xxs"
      />

      {/*
      <Label className="text-xxs">Spread</Label>
      <InputIcon
        allowArrowKeysChange
        letter="S"
        value={effect.spread}
        onCommit={(value) => {
          const int = parseFloat(value);
          if (!Number.isNaN(int)) {
            onCommit({
              ...effect,
              spread: int,
            });
          }
        }}
        className="col-span-2 h-6 text-xxs"
      />
      */}

      <Label className="text-xxs">Offset</Label>
      <div className="flex gap-1">
        <InputIcon
          allowArrowKeysChange
          letter="X"
          variables={"number"}
          value={{
            value: effect.value.offsetX,
            resolved: effect.resolved.offsetX,
          }}
          onCommit={(value) => {
            let offsetX;
            if (value instanceof Variable) {
              offsetX = value;
            } else if (value === undefined || value === "") {
              offsetX = effect.resolved.radius;
            } else {
              const float = parseFloat(value);
              if (!Number.isNaN(float)) {
                offsetX = float;
              }
            }
            if (offsetX !== undefined) {
              onCommit({ ...effect.value, offsetX });
            }
          }}
          className="h-6 text-xxs"
        />
        <InputIcon
          allowArrowKeysChange
          letter="Y"
          variables={"number"}
          value={{
            value: effect.value.offsetY,
            resolved: effect.resolved.offsetY,
          }}
          onCommit={(value) => {
            let offsetY;
            if (value instanceof Variable) {
              offsetY = value;
            } else if (value === undefined || value === "") {
              offsetY = effect.resolved.radius;
            } else {
              const float = parseFloat(value);
              if (!Number.isNaN(float)) {
                offsetY = float;
              }
            }
            if (offsetY !== undefined) {
              onCommit({ ...effect.value, offsetY });
            }
          }}
          className="h-6 text-xxs"
        />
      </div>
    </div>
  );
}

function LayerBlurDetail({
  effect,
  onCommit,
}: {
  effect: ValueWithResolved<LayerBlurEffect | BackgroundBlurEffect>;
  onCommit: (effect: LayerBlurEffect | BackgroundBlurEffect) => void;
}) {
  return (
    <div className="grid gap-2 grid-cols-[min-content_1fr] text-xxs">
      <Label className="text-xxs">Blur</Label>
      <InputIcon
        allowArrowKeysChange
        letter="R"
        variables={"number"}
        value={{ value: effect.value.radius, resolved: effect.resolved.radius }}
        step={0.1}
        stepDistance={40}
        onCommit={(value) => {
          let radius;
          if (value instanceof Variable) {
            radius = value;
          } else if (value === undefined || value === "") {
            radius = Math.max(0, effect.resolved.radius);
          } else {
            const float = parseFloat(value);
            if (!Number.isNaN(float)) {
              radius = Math.max(0, float);
            }
          }
          if (radius !== undefined) {
            onCommit({ ...effect.value, radius });
          }
        }}
        className="col-span-2 h-6 text-xxs"
      />
    </div>
  );
}

function EffectDetail({
  effect,
  onCommit,
}: {
  effect: ValueWithResolved<Effect>;
  onCommit: (effect: Effect) => void;
}) {
  const type = effect.resolved.type;
  switch (type) {
    case EffectType.DropShadow:
      return (
        <DropShadowDetail
          effect={effect as ValueWithResolved<DropShadowEffect>}
          onCommit={onCommit}
        />
      );
    case EffectType.LayerBlur:
      return (
        <LayerBlurDetail
          effect={effect as ValueWithResolved<LayerBlurEffect>}
          onCommit={onCommit}
        />
      );
    case EffectType.BackgroundBlur:
      return (
        <LayerBlurDetail
          effect={effect as ValueWithResolved<BackgroundBlurEffect>}
          onCommit={onCommit}
        />
      );
    default: {
      const missing: never = type;
      logger.error(`Unknown effect type: "${missing}"`);
      return <div>Unknown</div>;
    }
  }
}

function EffectTrigger({
  effects,
  effect,
  onCommit,
}: {
  effects: ValueWithResolved<NodeProperties["effects"]>;
  effect: ValueWithResolved<Effect>;
  onCommit: (effect: Effect) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-sm transition-colors">
        <Pencil size={14} className="opacity-70" />
      </PopoverTrigger>
      <PopoverContent className="w-47 p-0" side="right" align="start">
        <div className="border-b p-2">
          <EffectTypeSelect
            effects={effects}
            effect={effect.resolved}
            onValueChange={(value: EffectType) => {
              if (value !== effect.resolved.type) {
                onCommit(defaultEffectForType(value));
              }
            }}
          />
        </div>

        <div className="p-2">
          <EffectDetail
            effect={{ value: effect.value, resolved: effect.resolved }}
            onCommit={onCommit}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EffectList({
  effects,
  onCommit,
}: {
  effects: ValueWithResolved<NodeProperties["effects"]> | undefined | "Mixed";
  onCommit: (effects: NodeProperties["effects"]) => void;
}) {
  let result;

  if (effects === "Mixed") {
    result = <div className="text-center opacity-60">Mixed effects</div>;
  } else if (effects?.value === undefined) {
    result = undefined;
  } else if (effects.value.length > 0) {
    result = [];

    for (let i = effects.value.length - 1; i >= 0; i--) {
      const effect = {
        value: effects.value[i],
        resolved: effects.resolved![i],
      };

      result.push(
        <div key={i} className={cn("flex gap-1")}>
          <div
            className={cn(
              !effect.resolved.enabled ? "opacity-50" : undefined,
              !effect.resolved.enabled ? "pointer-events-none" : undefined,
              "flex flex-1 gap-1",
            )}
          >
            <EffectTrigger
              effects={effects}
              effect={{ value: effect.value, resolved: effect.resolved }}
              onCommit={(change) => {
                const cloned = [...effects.value!];
                cloned[i] = change;
                onCommit(cloned);
              }}
            />

            <EffectTypeSelect
              effects={effects}
              effect={effect.resolved}
              onValueChange={(value: EffectType) => {
                if (value !== effect.resolved.type) {
                  const cloned = [...effects.value!];
                  cloned[i] = defaultEffectForType(value);
                  onCommit(cloned);
                }
              }}
            />
          </div>

          <div className="flex">
            <IconButton
              icon={effect.resolved.enabled ? Eye : EyeOff}
              onClick={() => {
                const cloned = [...effects.value!];
                cloned[i] = {
                  ...effect.value,
                  enabled: !effect.resolved.enabled,
                };
                onCommit(cloned);
              }}
            />
            <IconButton
              icon={Minus}
              onClick={() => {
                const cloned = [...effects.value!];
                cloned.splice(i, 1);
                onCommit(cloned);
              }}
            />
          </div>
        </div>,
      );
    }
  }

  if (result) {
    return <div className="flex flex-col gap-1">{result}</div>;
  }
}

export const EffectsSection = React.memo(function EffectsSection({
  effects,
}: {
  effects: ValueWithResolved<NodeProperties["effects"]> | undefined | "Mixed";
}): React.ReactElement {
  const manager = useSceneManager();
  return (
    <Section>
      <div className="flex items-center justify-between text-secondary-foreground">
        <SectionTitle title="Effects" />
        <IconButton
          icon={Plus}
          onClick={() => {
            const cloned: Effect[] =
              effects === "Mixed" || effects?.value === undefined
                ? []
                : [...effects.value];

            cloned.push({
              type: EffectType.DropShadow,
              enabled: true,
              color: colorToHex([0, 0, 0, 0.25]),
              radius: 4,
              offsetX: 0,
              offsetY: 4,
              spread: 0,
              blendMode: "normal",
            });

            commitEffects(manager, cloned);
          }}
        />
      </div>
      <EffectList
        effects={effects}
        onCommit={(effects) => {
          commitEffects(manager, effects);
        }}
      />
    </Section>
  );
});

export default EffectsSection;
