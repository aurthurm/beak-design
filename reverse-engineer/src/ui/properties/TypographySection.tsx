import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDownIcon,
  DiamondIcon,
  DiamondMinusIcon,
} from "lucide-react";
import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  TextLineHorizontal,
  TextLineVertical,
  TextVerticalAlignCenter,
} from "@/src/components/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/popover";
import { Button } from "../../components/button";
import { InputIcon } from "../../components/input-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../components/select";
import { useSceneManager } from "@/src/pages/Editor";
import { Section } from "../section";
import { SectionSubtitle, SectionTitle } from "../section-title";
import { FontList } from "./FontList";
import { blockUpdate, useNumericInputHandlers } from "./shared-handlers";
import type { ValueWithResolved } from "./properties-compute";
import {
  useAvailableVariableTypes,
  VariablePicker,
} from "@/src/components/variable-picker";
import { cn } from "@/src/lib/utils";
import { commitProperty } from "./properties-actions";
import {
  Variable,
  type Value,
  safeRatio0,
  type ObjectUpdateBlock,
  type NodeProperties,
  type SceneNode,
} from "@ha/pencil-editor";

const textAlignOptions = [
  { value: "left", icon: AlignLeft, label: "Align Left" },
  { value: "center", icon: AlignCenter, label: "Align Center" },
  { value: "right", icon: AlignRight, label: "Align Right" },
] as const;

const verticalTextAlignOptions = [
  { value: "top", icon: ArrowUpToLine, label: "Align Top" },
  { value: "middle", icon: TextVerticalAlignCenter, label: "Align Middle" },
  { value: "bottom", icon: ArrowDownToLine, label: "Align Bottom" },
] as const;

const fontWeightLabels: Record<string, Record<string, string>> = {
  normal: {
    "100": "Thin",
    "200": "Extra Light",
    "300": "Light",
    "400": "Regular",
    "500": "Medium",
    "600": "Semi Bold",
    "700": "Bold",
    "800": "Extra Bold",
    "900": "Black",
  },

  italic: {
    "100": "Thin Italic",
    "200": "Extra Light Italic",
    "300": "Light Italic",
    "400": "Italic",
    "500": "Medium Italic",
    "600": "Semi Bold Italic",
    "700": "Bold Italic",
    "800": "Extra Bold Italic",
    "900": "Black Italic",
  },
};

function fontWeightToLabel(weight: string | number, style: string): string {
  return fontWeightLabels[style]?.[weight] ?? weight;
}

export const TypographySection = React.memo(function TextSection({
  fontFamily,
  fontSize,
  fontWeight,
  fontStyle,
  textAlign,
  textAlignVertical,
  lineHeight,
  letterSpacing,
}: {
  fontFamily: ValueWithResolved<NodeProperties["fontFamily"]> | "Mixed";
  fontSize: ValueWithResolved<NodeProperties["fontSize"]> | "Mixed";
  fontStyle: ValueWithResolved<NodeProperties["fontStyle"]> | "Mixed";
  fontWeight: ValueWithResolved<NodeProperties["fontWeight"]> | "Mixed";
  textAlign: NodeProperties["textAlign"] | "Mixed";
  textAlignVertical: NodeProperties["textAlignVertical"] | "Mixed";
  lineHeight: ValueWithResolved<NodeProperties["lineHeight"]> | "Mixed";
  letterSpacing: ValueWithResolved<NodeProperties["letterSpacing"]> | "Mixed";
  textGrowth: NodeProperties["textGrowth"] | "Mixed";
}): React.ReactElement | null {
  const manager = useSceneManager();
  const availableVariableTypes = useAvailableVariableTypes();

  // Handlers
  const handleChangeFontFamily = useCallback(
    (font: Value<"string"> | undefined) => {
      commitProperty(manager, "fontFamily", font);
    },
    [manager],
  );

  const handleChangeFontSize = useNumericInputHandlers(manager, "fontSize", 0);

  const isMixedFont = fontFamily === "Mixed";
  const fontVariable =
    !isMixedFont && fontFamily.value instanceof Variable
      ? fontFamily.value
      : undefined;
  const isMixedTextAlign = textAlign === "Mixed";

  const availableWeights = useMemo(
    () =>
      fontFamily != null && fontFamily !== "Mixed"
        ? manager.skiaRenderer.fontManager.getSupportedWeights(
            fontFamily.resolved,
          )
        : null,
    [fontFamily, manager],
  );

  const [isHovered, setIsHovered] = useState(false);
  const handleOnMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleOnMouseLeave = useCallback(() => setIsHovered(false), []);
  const [isVariablePickerOpen, setIsVariablePickerOpen] = useState(false);
  const showVariablePicker =
    (isHovered || isVariablePickerOpen || fontVariable) &&
    availableVariableTypes.has("string");
  const variablePickerAnchorRef = useRef<HTMLDivElement>(null!);
  const VariableIcon = fontVariable ? DiamondMinusIcon : DiamondIcon;

  return (
    <Section>
      <SectionTitle title="Typography" />
      <div
        className="relative"
        onMouseEnter={handleOnMouseEnter}
        onMouseLeave={handleOnMouseLeave}
        ref={variablePickerAnchorRef}
      >
        <Popover>
          <PopoverTrigger
            className={cn(
              "p-1 pl-2 flex w-full rounded-sm transition-colors shadow-xs border data-[state=open]:bg-zinc-200 dark:data-[state=open]:bg-zinc-700 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
              showVariablePicker ? "pr-5" : undefined,
            )}
          >
            <span className="text-xxs flex-1 text-left">
              {isMixedFont ? "Mixed" : fontFamily.resolved}
            </span>
            <ChevronDownIcon className="size-4 opacity-50" />
          </PopoverTrigger>
          <PopoverContent
            className="w-60 p-0"
            side="right"
            align="center"
            sideOffset={20}
          >
            <FontList
              manager={manager}
              onClick={handleChangeFontFamily}
              selectedFontName={isMixedFont ? undefined : fontFamily.resolved}
            />
          </PopoverContent>
          {showVariablePicker && variablePickerAnchorRef && (
            <VariablePicker
              variables={"string"}
              selectedVariable={fontVariable}
              onCommit={handleChangeFontFamily}
              onOpenChange={setIsVariablePickerOpen}
              className="absolute size-4 flex items-center justify-center right-0.5 top-1.5"
              anchorRef={variablePickerAnchorRef}
            >
              <VariableIcon
                className={cn(
                  "w-4 h-4 p-0.5 rounded-[4px]",
                  fontVariable
                    ? `${isHovered || isVariablePickerOpen ? "text-[#D480FF]" : "text-[#674578]"} hover:bg-[#674578] hover:text-[#D480FF]`
                    : "text-secondary-foreground hover:bg-input hover:text-sidebar-accent-foreground",
                )}
              />
            </VariablePicker>
          )}
        </Popover>
      </div>

      {/* TODO(zaza): how to handle variable bindings for this combined fontWeight + fontStyle selector? */}
      <div className="grid grid-cols-2 gap-1">
        <Select
          value={
            fontWeight === "Mixed" ? "Mixed" : `${fontStyle}-${fontWeight}`
          }
          disabled={availableWeights == null}
          onValueChange={(value) => {
            const parts = value.split("-");
            if (parts.length !== 2) return;

            const fontStyle = parts[0];
            const fontWeight = parts[1];

            blockUpdate(
              manager,
              (block: ObjectUpdateBlock, node: SceneNode) => {
                if (node.type === "text") {
                  block.update(node, {
                    fontStyle: fontStyle,
                    fontWeight: fontWeight,
                  });
                }
              },
            );
          }}
        >
          <SelectTrigger data-size="sm">
            <SelectValue placeholder="Weight">
              {fontWeight === "Mixed" || fontStyle === "Mixed"
                ? "Mixed"
                : fontWeightToLabel(fontWeight.resolved, fontStyle.resolved)}
            </SelectValue>
          </SelectTrigger>
          {availableWeights != null && (
            <SelectContent position="item-aligned">
              {availableWeights.normal.map((weight) => (
                <SelectItem key={`normal-${weight}`} value={`normal-${weight}`}>
                  {fontWeightToLabel(weight, "normal")}
                </SelectItem>
              ))}
              {availableWeights.italic.length > 0 && <SelectSeparator />}
              {availableWeights.italic.map((weight) => (
                <SelectItem key={`italic-${weight}`} value={`italic-${weight}`}>
                  {fontWeightToLabel(weight, "italic")}
                </SelectItem>
              ))}
            </SelectContent>
          )}
        </Select>
        <InputIcon
          className="h-6 text-xxs"
          allowArrowKeysChange
          letter="S"
          variables={"number"}
          value={fontSize}
          onCommit={handleChangeFontSize}
        />
      </div>

      <div className="grid grid-cols-2 gap-1">
        <div>
          <SectionSubtitle text="Line height" />
          <InputIcon<"number", "Auto" | Value<"number">>
            className="h-6 text-xxs"
            allowArrowKeysChange
            icon={<TextLineVertical className="w-3 h-3 opacity-70" />}
            suffix={
              lineHeight !== "Mixed" && lineHeight.resolved !== 0 ? "%" : ""
            }
            variables={"number"}
            value={
              lineHeight === "Mixed"
                ? "Mixed"
                : {
                    value:
                      typeof lineHeight.value === "number"
                        ? lineHeight.value * 100
                        : lineHeight.value,
                    resolved:
                      lineHeight.resolved === 0
                        ? "Auto"
                        : lineHeight.resolved * 100,
                  }
            }
            onCommit={(value) => {
              let type: "percent" | "pixels" | undefined;
              let lineHeight: NodeProperties["lineHeight"] | undefined;

              if (value instanceof Variable) {
                lineHeight = value;
              } else if (
                value === undefined ||
                value.toLowerCase() === "auto" ||
                value === ""
              ) {
                lineHeight = 0;
              } else {
                const float = parseFloat(value);
                if (!Number.isNaN(float)) {
                  if (value.endsWith("%")) {
                    lineHeight = float / 100;
                    type = "percent";
                  } else {
                    lineHeight = float;
                    type = "pixels";
                  }
                } else {
                  lineHeight = float;
                }
              }

              if (lineHeight !== undefined) {
                blockUpdate(
                  manager,
                  (block: ObjectUpdateBlock, node: SceneNode) => {
                    if (node.type === "text") {
                      // NOTE(sedivy): Convert from pixels to percentage line height.
                      block.update(node, {
                        lineHeight:
                          typeof lineHeight === "number" && type === "pixels"
                            ? safeRatio0(
                                lineHeight,
                                node.properties.resolved.fontSize,
                              )
                            : lineHeight,
                      });
                    }
                  },
                );
              }
            }}
          />
        </div>

        <div>
          <SectionSubtitle text="Letter spacing" />
          <InputIcon
            className="h-6 text-xxs"
            allowArrowKeysChange
            icon={<TextLineHorizontal className="w-3 h-3 opacity-70" />}
            suffix={
              letterSpacing !== "Mixed" && letterSpacing.resolved !== 0
                ? "px"
                : ""
            }
            variables={"number"}
            value={letterSpacing}
            onCommit={(value) => {
              let type: "percent" | "pixels" | undefined;
              let letterSpacing: NodeProperties["letterSpacing"] | undefined;

              if (value instanceof Variable) {
                letterSpacing = value;
              } else if (value === undefined || value === "") {
                letterSpacing = 0;
              } else {
                const float = parseFloat(value);
                if (!Number.isNaN(float)) {
                  if (value.endsWith("%")) {
                    letterSpacing = float / 100;
                    type = "percent";
                  } else {
                    letterSpacing = float;
                    type = "pixels";
                  }
                } else {
                  letterSpacing = 0;
                }
              }

              if (letterSpacing != null) {
                blockUpdate(
                  manager,
                  (block: ObjectUpdateBlock, node: SceneNode) => {
                    if (node.type === "text") {
                      // NOTE(sedivy): Convert from percent to pixel letter
                      // spacing.
                      block.update(node, {
                        letterSpacing:
                          typeof letterSpacing === "number" &&
                          type === "percent"
                            ? letterSpacing * node.properties.resolved.fontSize
                            : letterSpacing,
                      });
                    }
                  },
                );
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <div>
          <SectionSubtitle text="Horizontal" />
          <div className="flex gap-1 rounded-sm border-1 bg-zinc-200 dark:bg-zinc-700 w-full">
            {textAlignOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={
                  !isMixedTextAlign && textAlign === opt.value
                    ? "secondary"
                    : "ghost"
                }
                size="icon"
                className="h-5 w-5 flex-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  blockUpdate(
                    manager,
                    (block: ObjectUpdateBlock, node: SceneNode) => {
                      if (node.type === "text") {
                        block.update(node, { textAlign: opt.value });
                      }
                    },
                  );
                }}
                title={opt.label}
              >
                {React.createElement(opt.icon, {
                  className: "h-4 w-4",
                  strokeWidth: 1,
                })}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <SectionSubtitle text="Vertical" />
          <div className="flex gap-1 rounded-sm border-1 bg-zinc-200 dark:bg-zinc-700 w-full">
            {verticalTextAlignOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={
                  !isMixedTextAlign && textAlignVertical === opt.value
                    ? "secondary"
                    : "ghost"
                }
                size="icon"
                className="h-5 w-5 flex-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  blockUpdate(
                    manager,
                    (block: ObjectUpdateBlock, node: SceneNode) => {
                      if (node.type === "text") {
                        block.update(node, { textAlignVertical: opt.value });
                      }
                    },
                  );
                }}
                title={opt.label}
              >
                {React.createElement(opt.icon, {
                  className: "h-4 w-4",
                  strokeWidth: 1,
                })}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
});

export default TypographySection;
