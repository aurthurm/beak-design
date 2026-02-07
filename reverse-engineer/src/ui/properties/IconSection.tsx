import type { NodeProperties } from "@ha/pencil-editor";
import {
  lookupIconEntry,
  lookupIconSet,
} from "@ha/pencil-editor/src/managers/icon-manager";
import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useMemo } from "react";
import { useSceneManager } from "@/src/pages/Editor";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/select";
import { Slider } from "../../components/slider";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import { IconList } from "./IconList";
import { blockUpdate } from "./shared-handlers";

const DEFAULT_WEIGHT = 200;

const SECTIONS = [
  "Material Symbols Outlined",
  "Material Symbols Rounded",
  "Material Symbols Sharp",
  "feather",
  "lucide",
];

interface IconSectionProps {
  iconFontName: string | "Mixed" | undefined;
  iconFontFamily: string | "Mixed" | undefined;
  iconFontWeight: number | "Mixed" | undefined;
}

export function IconSection({
  iconFontName,
  iconFontFamily,
  iconFontWeight,
}: IconSectionProps): React.ReactElement {
  const manager = useSceneManager();

  const iconSet = useMemo(() => {
    if (!iconFontFamily || iconFontFamily === "Mixed") {
      return;
    }

    return lookupIconSet(iconFontFamily);
  }, [iconFontFamily]);

  const onChangeName = useCallback(
    (name: string) => {
      blockUpdate(manager, (block, node) => {
        if (node.type === "icon_font") {
          block.update(node, {
            // NOTE(sedivy): The selected icons can all have different font
            // family, so to avoid invalid combinations we always set the family
            // when changing the name. The user clicked on a specific icon from
            // a list so we can assume they want this icon to apply everywhere.
            iconFontFamily: iconFontFamily,
            iconFontName: name,
          });
        }
      });
    },
    [manager, iconFontFamily],
  );

  const onChangeFamily = useCallback(
    (family: string) => {
      const iconSet = lookupIconSet(family);
      if (!iconSet) {
        return;
      }

      // TODO(sedivy): Only update font family if the current icon exists in that family.
      blockUpdate(manager, (block, node) => {
        if (node.type === "icon_font") {
          const update: Pick<
            NodeProperties,
            "iconFontFamily" | "iconFontName"
          > = {
            iconFontFamily: family,
          };

          // NOTE(sedivy): When switching the font family we need to verify
          // the existing icon is still valid in this new set. If not we need to
          // set a fallback.
          if (
            node.properties.resolved.iconFontName &&
            node.properties.resolved.iconFontName !== family
          ) {
            const iconIsStillValid = lookupIconEntry(
              iconSet,
              node.properties.resolved.iconFontName,
            );

            if (!iconIsStillValid) {
              const fallbackIcon =
                lookupIconEntry(iconSet, "square") ?? iconSet.list[0];

              if (fallbackIcon) {
                update.iconFontName = fallbackIcon.name;
              }
            }
          }

          block.update(node, update);
        }
      });
    },
    [manager],
  );

  const onChangeWeight = useCallback(
    (weight: number) => {
      blockUpdate(manager, (block, node) => {
        if (node.type === "icon_font") {
          const fontFamily = node.properties.resolved.iconFontFamily;
          if (!fontFamily) {
            return;
          }

          const set = lookupIconSet(node.properties.resolved.iconFontFamily);
          if (!set?.variableWeights) {
            return;
          }

          block.update(node, {
            iconFontWeight: weight,
          });
        }
      });
    },
    [manager],
  );

  return (
    <Section>
      <SectionTitle title="Icon" />

      <Popover>
        <PopoverTrigger className="p-1 pl-2 flex w-full rounded-sm transition-colors shadow-xs border data-[state=open]:bg-zinc-200 dark:data-[state=open]:bg-zinc-700 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none">
          <span className="text-xxs flex-1 text-left truncate">
            {iconFontName === "Mixed"
              ? "Mixed"
              : iconFontName || "Select icon..."}
          </span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          side="right"
          align="center"
          collisionPadding={10}
          sideOffset={20}
        >
          {iconFontFamily && iconFontFamily !== "Mixed" && (
            <IconList
              manager={manager}
              family={iconFontFamily}
              onClick={onChangeName}
              selectedIconName={
                iconFontName === "Mixed" ? undefined : iconFontName
              }
            />
          )}
        </PopoverContent>
      </Popover>

      <div>
        <Select
          value={iconFontFamily}
          onValueChange={(family) => {
            if (family !== "Mixed") {
              onChangeFamily(family);
            }
          }}
        >
          <SelectTrigger className="h-6 text-xxs" size="sm">
            <SelectValue placeholder="Font">{iconFontFamily}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SECTIONS.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {iconSet?.variableWeights && (
        <div className="flex items-center gap-2">
          <span className="text-xxs text-muted-foreground w-8">
            {iconFontWeight === "Mixed"
              ? "—"
              : (iconFontWeight ?? DEFAULT_WEIGHT)}
          </span>

          <Slider
            min={100}
            max={700}
            step={100}
            value={
              iconFontWeight === "Mixed"
                ? []
                : [iconFontWeight ?? DEFAULT_WEIGHT]
            }
            onValueChange={([value]) => {
              onChangeWeight(value);
            }}
            disabled={iconFontWeight === "Mixed"}
            className="flex-1"
          />
        </div>
      )}
    </Section>
  );
}

export default IconSection;
