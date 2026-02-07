import {
  AlignItems,
  Axis,
  createNodeProperties,
  FillType,
  JustifyContent,
  LayoutMode,
  NodeUtils,
  type SceneManager,
  type SceneNode,
  SizingBehavior,
  type Value,
} from "@ha/pencil-editor";
import {
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceAround,
  AlignJustify,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceAround,
  ArrowDownFromLine,
  ArrowRightFromLine,
  LayoutDashboard,
  ScanText,
  SeparatorVertical,
  Settings,
  Square,
} from "lucide-react";
import React from "react";
import { Checkbox } from "@/src/components/checkbox";
import { Label } from "@/src/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/popover";
import { useSceneManager } from "@/src/pages/Editor";
import { AlignmentGrid } from "../../components/alignment-grid";
import { AutoLayoutButton } from "../../components/auto-layout-button";
import { Button } from "../../components/button";
import { InputIcon } from "../../components/input-icon";
import {
  type AlignmentPosition,
  alignmentToLayoutProperties,
  layoutPropertiesToAlignment,
} from "../../utils/alignment-utils";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import type { ValueWithResolved } from "./properties-compute";
import {
  blockUpdate,
  useNumericInputHandlers,
  useToggleHandler,
} from "./shared-handlers";

interface LayoutSectionProps {
  width: number | "Mixed";
  height: number | "Mixed";

  layoutMode?: LayoutMode | "Mixed";
  layoutModeInitialized: boolean;
  layoutChildSpacing: ValueWithResolved<Value<"number">> | "Mixed";
  layoutPadding: ValueWithResolved<
    | Value<"number">
    | [Value<"number">, Value<"number">]
    | [Value<"number">, Value<"number">, Value<"number">, Value<"number">]
  >;
  layoutJustifyContent?: JustifyContent | "Mixed";
  layoutAlignItems?: AlignItems | "Mixed";

  horizontalSizing: SizingBehavior | "Mixed";
  verticalSizing: SizingBehavior | "Mixed";
  textGrowth?: "auto" | "fixed-width" | "fixed-width-height" | "Mixed" | null;
  textGrowthInitialized?: boolean;
  selectedNodesArray: SceneNode[];
  clipInitialized: boolean;
  clip: boolean | "Mixed";
}

const textGrowthOptions = [
  { value: "auto", icon: ArrowRightFromLine, label: "Auto width" },
  { value: "fixed-width", icon: AlignJustify, label: "Auto height" },
  { value: "fixed-width-height", icon: ScanText, label: "Fixed size" },
] as const;

function toggleAutoLayout(sceneManager: SceneManager): void {
  const selectedNodes = sceneManager.selectionManager.selectedNodes;
  const selectedNodesArray = Array.from(selectedNodes.values());

  // NOTE(sedivy): Disable auto layout for single node that already has it.
  if (selectedNodes.size === 1 && selectedNodesArray[0].hasLayout()) {
    blockUpdate(sceneManager, (block, node) => {
      block.update(node, {
        width: node.properties.width,
        height: node.properties.height,
        layoutMode: LayoutMode.None,
      });
    });
    return;
  }

  // NOTE(sedivy): Enable auto layout for single frame/group node.
  if (
    selectedNodes.size === 1 &&
    (selectedNodesArray[0].type === "frame" ||
      selectedNodesArray[0].type === "group")
  ) {
    blockUpdate(sceneManager, (block, node) => {
      // TODO(sedivy): Try to guess padding, sizing, direction, and other fields
      // based on the contents of the frame/group.
      block.update(node, {
        horizontalSizing: SizingBehavior.Fixed,
        verticalSizing: SizingBehavior.Fixed,
        layoutMode: LayoutMode.Vertical,
      });
    });

    return;
  }

  // NOTE(sedivy): Special case: Create button auto layout from rectangle + text
  if (selectedNodes.size === 2) {
    const rectangle = selectedNodesArray.find(
      (node) => node.type === "rectangle",
    );
    const text = selectedNodesArray.find((node) => node.type === "text");

    if (rectangle && text) {
      if (rectangle.includesNode(text)) {
        const block = sceneManager.scenegraph.beginUpdate();

        const newFrame = sceneManager.scenegraph.createAndInsertNode(
          block,
          undefined,
          "frame",
          createNodeProperties("frame", {
            name: `Frame ${sceneManager.scenegraph.getNextFrameNumber()}`,

            x: rectangle.properties.x,
            y: rectangle.properties.y,
            width: rectangle.properties.width,
            height: rectangle.properties.height,

            rotation: rectangle.properties.rotation,
            flipX: rectangle.properties.flipX,
            flipY: rectangle.properties.flipY,

            strokeAlignment: rectangle.properties.strokeAlignment,
            strokeFills: rectangle.properties.strokeFills,
            strokeWidth: rectangle.properties.strokeWidth,

            fills: rectangle.properties.fills,
            cornerRadius: rectangle.properties.cornerRadius,
            opacity: rectangle.properties.opacity,

            clip: true,

            layoutMode: LayoutMode.Horizontal,
            layoutChildSpacing: 0,
            layoutPadding: [12, 20],
            layoutJustifyContent: JustifyContent.Center,
            layoutAlignItems: AlignItems.Center,
            horizontalSizing: SizingBehavior.FitContent,
            verticalSizing: SizingBehavior.FitContent,
          }),
          rectangle.parent ?? sceneManager.scenegraph.getViewportNode(),
        );

        // NOTE(sedivy): Remove the rectangle after copying its properties to the frame.
        block.deleteNode(rectangle);

        // NOTE(sedivy): Move the text into the new auto layout frame.
        block.snapshotProperties(text, ["x", "y"]);
        block.changeParent(text, newFrame);

        sceneManager.scenegraph.commitBlock(block, { undo: true });

        sceneManager.selectionManager.setSelection(new Set([newFrame]));
        return;
      }
    }
  }

  // NOTE(sedivy): Wrap multiple selected nodes in a new auto layout frame.
  if (selectedNodesArray.length > 1) {
    const block = sceneManager.scenegraph.beginUpdate();

    const combinedBounds =
      NodeUtils.calculateCombinedBoundsFromArray(selectedNodesArray);
    if (combinedBounds) {
      const parent =
        selectedNodesArray[0].parent ??
        sceneManager.scenegraph.getViewportNode();

      const localPoint = parent.toLocal(combinedBounds.x, combinedBounds.y);

      // TODO(sedivy): Try to guess padding, sizing, direction, and other fields
      // based on the contents of the selection.

      const newFrame = sceneManager.scenegraph.createAndInsertNode(
        block,
        undefined,
        "frame",
        createNodeProperties("frame", {
          name: `Frame ${sceneManager.scenegraph.getNextFrameNumber()}`,

          x: localPoint.x,
          y: localPoint.y,

          fills: parent.root
            ? [{ type: FillType.Color, enabled: true, color: "#ffffff" }]
            : undefined,

          layoutMode: LayoutMode.Horizontal,
          horizontalSizing: SizingBehavior.FitContent,
          verticalSizing: SizingBehavior.FitContent,

          cornerRadius: [0, 0, 0, 0],
          rotation: 0,
          opacity: 1,
          clip: false,
        }),
        parent,
      );

      selectedNodesArray.sort((a, b) => {
        return a.getWorldBounds().x - b.getWorldBounds().x;
      });

      for (const node of selectedNodesArray) {
        block.snapshotProperties(node, ["x", "y"]);
        block.changeParent(node, newFrame);
      }

      sceneManager.scenegraph.commitBlock(block, { undo: true });

      sceneManager.selectionManager.setSelection(new Set([newFrame]));
      return;
    }
  }
}

export function LayoutSection({
  layoutMode,
  layoutModeInitialized,
  layoutChildSpacing,
  layoutPadding,
  layoutJustifyContent,
  layoutAlignItems,
  width,
  height,
  horizontalSizing,
  verticalSizing,
  textGrowth,
  textGrowthInitialized = false,
  selectedNodesArray,
  clipInitialized,
  clip,
}: LayoutSectionProps): React.ReactElement {
  const sceneManager = useSceneManager();

  const autoLayoutCurrentlyActive =
    selectedNodesArray.length === 1 &&
    (selectedNodesArray[0].type === "frame" ||
      selectedNodesArray[0].type === "group") &&
    selectedNodesArray[0].hasLayout();

  const autoLayoutShouldShow =
    selectedNodesArray.length > 1 ||
    (selectedNodesArray.length === 1 &&
      (selectedNodesArray[0].type === "frame" ||
        selectedNodesArray[0].type === "group"));

  let selectedAlignment: AlignmentPosition | undefined;
  if (
    layoutJustifyContent !== "Mixed" &&
    layoutAlignItems !== "Mixed" &&
    layoutMode !== "Mixed"
  ) {
    selectedAlignment = layoutPropertiesToAlignment(
      layoutJustifyContent || JustifyContent.Start,
      layoutAlignItems || AlignItems.Start,
      layoutMode,
    );
  }

  const paddingMode = Array.isArray(layoutPadding.value)
    ? layoutPadding.value.length === 2
      ? "dual"
      : "quad"
    : "single";

  const pixelChildSpacing =
    layoutJustifyContent !== JustifyContent.SpaceBetween &&
    layoutJustifyContent !== JustifyContent.SpaceAround;

  const handleAlignmentChange = React.useCallback(
    (position: AlignmentPosition) => {
      blockUpdate(sceneManager, (block, node) => {
        if (node.type === "frame" || node.type === "group") {
          const { justifyContent, alignItems } = alignmentToLayoutProperties(
            position,
            node.properties.layoutMode,
          );

          block.update(node, {
            layoutJustifyContent:
              node.properties.layoutJustifyContent ===
                JustifyContent.SpaceBetween ||
              node.properties.layoutJustifyContent ===
                JustifyContent.SpaceAround
                ? node.properties.layoutJustifyContent
                : justifyContent,
            layoutAlignItems: alignItems,
          });
        }
      });
    },
    [sceneManager],
  );

  const handleChildSpacingModeChange = React.useCallback(
    (justifyContent: JustifyContent) => {
      blockUpdate(sceneManager, (block, node) => {
        if (node.type === "frame" || node.type === "group") {
          block.update(node, {
            layoutJustifyContent: justifyContent,
          });
        }
      });
    },
    [sceneManager],
  );

  // Handler for padding mode changes
  const handlePaddingModeChange = (newMode: "single" | "dual" | "quad") => {
    // Convert current padding to new format
    let newPadding: typeof layoutPadding.value;

    if (newMode === "single") {
      // Convert to single value (use first value)
      if (Array.isArray(layoutPadding.value)) {
        newPadding = layoutPadding.value[0];
      } else {
        newPadding = layoutPadding.value;
      }
    } else if (newMode === "dual") {
      // Convert to horizontal/vertical format
      if (Array.isArray(layoutPadding.value)) {
        newPadding =
          layoutPadding.value.length === 2
            ? [layoutPadding.value[0], layoutPadding.value[1]]
            : [layoutPadding.value[1], layoutPadding.value[0]];
      } else {
        newPadding = [layoutPadding.value ?? 0, layoutPadding.value ?? 0];
      }
    } else {
      if (Array.isArray(layoutPadding.value)) {
        newPadding =
          layoutPadding.value.length === 2
            ? [
                layoutPadding.value[1],
                layoutPadding.value[0],
                layoutPadding.value[1],
                layoutPadding.value[0],
              ]
            : [
                layoutPadding.value[0],
                layoutPadding.value[1],
                layoutPadding.value[2],
                layoutPadding.value[3],
              ];
      } else {
        newPadding = [
          layoutPadding.value ?? 0,
          layoutPadding.value ?? 0,
          layoutPadding.value ?? 0,
          layoutPadding.value ?? 0,
        ];
      }
    }

    blockUpdate(sceneManager, (block, node) => {
      if (
        (node.type === "frame" || node.type === "group") &&
        node.hasLayout()
      ) {
        block.update(node, {
          layoutPadding: newPadding,
        });
      }
    });
  };

  // Fill container handlers using shared toggle handler
  const fillContainerWidthHandler = useToggleHandler(
    sceneManager,
    "fillContainerWidth",
  );
  const fillContainerHeightHandler = useToggleHandler(
    sceneManager,
    "fillContainerHeight",
  );

  // Shared handlers
  const widthHandlers = useNumericInputHandlers(
    sceneManager,
    "width",
    0,
    undefined,
  );
  const heightHandlers = useNumericInputHandlers(
    sceneManager,
    "height",
    0,
    undefined,
  );

  const setLayoutMode = (mode: LayoutMode) => {
    blockUpdate(sceneManager, (block, node) => {
      if (node.type === "frame" || node.type === "group") {
        block.update(node, {
          layoutMode: mode,
        });
      }
    });
  };

  // Child spacing and padding handlers
  const childSpacingHandlers = useNumericInputHandlers(
    sceneManager,
    "childSpacing",
    0,
  );
  // Padding handlers - will be implemented with custom logic for different formats
  const paddingHandler = useNumericInputHandlers(sceneManager, "padding", 0);
  const paddingHorizontalHandler = useNumericInputHandlers(
    sceneManager,
    "paddingHorizontal",
    0,
  );
  const paddingVerticalHandler = useNumericInputHandlers(
    sceneManager,
    "paddingVertical",
    0,
  );
  const paddingTopHandler = useNumericInputHandlers(
    sceneManager,
    "paddingTop",
    0,
  );
  const paddingRightHandler = useNumericInputHandlers(
    sceneManager,
    "paddingRight",
    0,
  );
  const paddingBottomHandler = useNumericInputHandlers(
    sceneManager,
    "paddingBottom",
    0,
  );
  const paddingLeftHandler = useNumericInputHandlers(
    sceneManager,
    "paddingLeft",
    0,
  );

  // Hug content handlers
  const hugWidthHandler = useToggleHandler(sceneManager, "hugWidth");
  const hugHeightHandler = useToggleHandler(sceneManager, "hugHeight");

  // Padding rendering is now controlled by paddingMode state

  // Helper function to render padding inputs based on current mode and padding data
  const renderPaddingInputs = () => {
    switch (paddingMode) {
      case "single":
        return (
          <InputIcon
            icon={<Square strokeWidth={1} className="h-3 w-3" />}
            iconPosition="left"
            variables={"number"}
            value={layoutPadding}
            onCommit={paddingHandler}
            className="h-6 text-xxs"
            allowArrowKeysChange
            step={1}
          />
        );

      case "dual": {
        return (
          <div className="grid grid-cols-2 gap-1.5">
            <InputIcon
              icon={
                <AlignVerticalSpaceAround strokeWidth={1} className="h-3 w-3" />
              }
              iconPosition="left"
              variables={"number"}
              value={{
                value: (layoutPadding.value as Value<"number">[])[0],
                resolved: (layoutPadding.resolved as number[])[0],
              }}
              onCommit={paddingHorizontalHandler}
              className="h-6 text-xxs"
              allowArrowKeysChange
              step={1}
            />
            <InputIcon
              icon={
                <AlignHorizontalSpaceAround
                  strokeWidth={1}
                  className="h-3 w-3"
                />
              }
              variables={"number"}
              value={{
                value: (layoutPadding.value as Value<"number">[])[1],
                resolved: (layoutPadding.resolved as number[])[1],
              }}
              onCommit={paddingVerticalHandler}
              className="h-6 text-xxs"
              allowArrowKeysChange
              step={1}
            />
          </div>
        );
      }

      case "quad": {
        return (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="grid grid-cols-2 gap-1">
              <InputIcon
                icon={
                  <AlignHorizontalJustifyStart
                    strokeWidth={1}
                    className="h-3 w-3"
                  />
                }
                iconPosition="left"
                variables={"number"}
                value={{
                  value: (layoutPadding.value as Value<"number">[])[3],
                  resolved: (layoutPadding.resolved as number[])[3],
                }}
                onCommit={paddingLeftHandler}
                className="h-6 text-xxs"
                allowArrowKeysChange
                step={1}
              />
              <InputIcon
                icon={
                  <AlignVerticalJustifyStart
                    strokeWidth={1}
                    className="h-3 w-3"
                  />
                }
                value={{
                  value: (layoutPadding.value as Value<"number">[])[0],
                  resolved: (layoutPadding.resolved as number[])[0],
                }}
                onCommit={paddingTopHandler}
                className="h-6 text-xxs"
                allowArrowKeysChange
                step={1}
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <InputIcon
                icon={
                  <AlignHorizontalJustifyEnd
                    strokeWidth={1}
                    className="h-3 w-3"
                  />
                }
                variables={"number"}
                value={{
                  value: (layoutPadding.value as Value<"number">[])[1],
                  resolved: (layoutPadding.resolved as number[])[1],
                }}
                onCommit={paddingRightHandler}
                className="h-6 text-xxs"
                allowArrowKeysChange
                step={1}
              />
              <InputIcon
                icon={
                  <AlignVerticalJustifyEnd
                    strokeWidth={1}
                    className="h-3 w-3"
                  />
                }
                variables={"number"}
                value={{
                  value: (layoutPadding.value as Value<"number">[])[2],
                  resolved: (layoutPadding.resolved as number[])[2],
                }}
                onCommit={paddingBottomHandler}
                className="h-6 text-xxs"
                allowArrowKeysChange
                step={1}
              />
            </div>
          </div>
        );
      }

      default:
        // This should never happen since paddingMode is always set
        return null;
    }
  };

  return (
    <Section>
      <div className="flex items-center justify-between text-secondary-foreground">
        <SectionTitle
          title={
            layoutMode === LayoutMode.Horizontal ||
            layoutMode === LayoutMode.Vertical
              ? "Flex Layout"
              : "Layout"
          }
        />
        {autoLayoutShouldShow && (
          <AutoLayoutButton
            active={autoLayoutCurrentlyActive}
            className="h-4 w-4"
            onClick={() => {
              toggleAutoLayout(sceneManager);
            }}
          />
        )}
      </div>
      <div className="grid items-left">
        {layoutModeInitialized && (
          <>
            <div className="flex gap-1 mb-2 rounded-sm p-[1px] bg-muted">
              <Button
                variant="ghost"
                size="icon"
                className={`h-5 w-5 flex-1 ${layoutMode === LayoutMode.None ? "bg-white dark:bg-zinc-600" : ""}`}
                onClick={() => setLayoutMode(LayoutMode.None)}
                title="Freeform"
              >
                <LayoutDashboard strokeWidth={1} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-5 w-5 flex-1 ${layoutMode === LayoutMode.Vertical ? "bg-white dark:bg-zinc-600" : ""}`}
                onClick={() => setLayoutMode(LayoutMode.Vertical)}
                title="Vertical"
              >
                <ArrowDownFromLine strokeWidth={1} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-5 w-5 flex-1 ${layoutMode === LayoutMode.Horizontal ? "bg-white dark:bg-zinc-600" : ""}`}
                onClick={() => setLayoutMode(LayoutMode.Horizontal)}
                title="Horizontal"
              >
                <ArrowRightFromLine strokeWidth={1} />
              </Button>
            </div>

            <div>
              {layoutMode !== LayoutMode.None && (
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <div>
                    <div className="text-[9px] mb-1 opacity-70">Alignment</div>
                    <AlignmentGrid
                      selected={selectedAlignment}
                      onSelect={handleAlignmentChange}
                      className="bg-zinc-100 dark:bg-zinc-700 rounded"
                      spaceBetweenOrAround={
                        layoutJustifyContent === JustifyContent.SpaceAround ||
                        layoutJustifyContent === JustifyContent.SpaceBetween
                      }
                      direction={
                        layoutMode === LayoutMode.Horizontal
                          ? Axis.Horizontal
                          : Axis.Vertical
                      }
                    />
                  </div>
                  <div>
                    <div className="text-[9px] mb-1 opacity-70">Gap</div>
                    <div>
                      <div>
                        <label className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="radio"
                            name="childSpacingMode"
                            value="childSpacing"
                            checked={pixelChildSpacing}
                            onChange={() =>
                              handleChildSpacingModeChange(JustifyContent.Start)
                            }
                          />
                          <InputIcon
                            icon={
                              <SeparatorVertical
                                strokeWidth={1}
                                className="h-3 w-3"
                              />
                            }
                            variables={"number"}
                            value={layoutChildSpacing}
                            onCommit={childSpacingHandlers}
                            className="h-6 text-xxs flex-1"
                            disabled={!pixelChildSpacing}
                            allowArrowKeysChange
                            step={1}
                          />
                        </label>
                      </div>
                      <div className="h-6 flex items-center">
                        <label className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="radio"
                            name="childSpacingMode"
                            value="space-between"
                            checked={
                              layoutJustifyContent ===
                              JustifyContent.SpaceBetween
                            }
                            onChange={() =>
                              handleChildSpacingModeChange(
                                JustifyContent.SpaceBetween,
                              )
                            }
                          />
                          <span className="text-[9px]">Space Between</span>
                        </label>
                      </div>
                      <div className="h-6 flex items-center">
                        <label className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="radio"
                            name="childSpacingMode"
                            value="space-around"
                            checked={
                              layoutJustifyContent ===
                              JustifyContent.SpaceAround
                            }
                            onChange={() =>
                              handleChildSpacingModeChange(
                                JustifyContent.SpaceAround,
                              )
                            }
                          />
                          <span className="text-[9px]">Space Around</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {(layoutMode === LayoutMode.Horizontal ||
                layoutMode === LayoutMode.Vertical) && (
                <div>
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[9px] opacity-70">Padding</div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 opacity-60 hover:opacity-100"
                            title="Padding settings"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="end">
                          <div className="space-y-3">
                            <div className="text-xs font-medium">
                              Padding Values
                            </div>
                            <div className="space-y-2">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="paddingMode"
                                  value="single"
                                  checked={paddingMode === "single"}
                                  onChange={() =>
                                    handlePaddingModeChange("single")
                                  }
                                  className="w-3 h-3 border border-zinc-400 rounded-full appearance-none checked:border-zinc-600 checked:bg-zinc-600 checked:bg-[radial-gradient(circle,white_2px,transparent_2px)]"
                                />
                                <span className="text-xs">
                                  One value for all sides
                                </span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="paddingMode"
                                  value="dual"
                                  checked={paddingMode === "dual"}
                                  onChange={() =>
                                    handlePaddingModeChange("dual")
                                  }
                                  className="w-3 h-3 border border-zinc-400 rounded-full appearance-none checked:border-zinc-600 checked:bg-zinc-600 checked:bg-[radial-gradient(circle,white_2px,transparent_2px)]"
                                />
                                <span className="text-xs">
                                  Horizontal/Vertical
                                </span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="paddingMode"
                                  value="quad"
                                  checked={paddingMode === "quad"}
                                  onChange={() =>
                                    handlePaddingModeChange("quad")
                                  }
                                  className="w-3 h-3 border border-zinc-400 rounded-full appearance-none checked:border-zinc-600 checked:bg-zinc-600 checked:bg-[radial-gradient(circle,white_2px,transparent_2px)]"
                                />
                                <span className="text-xs">
                                  Top/Right/Bottom/Left
                                </span>
                              </label>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {renderPaddingInputs()}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        <div>
          <div className="text-[9px] opacity-70 mb-1">Dimensions</div>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Width */}
            <InputIcon
              letter="W"
              value={width}
              onCommit={widthHandlers}
              className="h-6 text-xxs"
              disabled={textGrowth === "auto"}
              allowArrowKeysChange
              step={1}
            />
            {/* Height */}
            <InputIcon
              letter="H"
              value={height}
              onCommit={heightHandlers}
              className="h-6 text-xxs"
              disabled={textGrowth === "auto" || textGrowth === "fixed-width"}
              allowArrowKeysChange
              step={1}
            />
          </div>
          {/* Fill Container checkboxes - show when parent has auto layout */}
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {/* Fill Container Width */}
            <div className="flex items-center">
              <Checkbox
                id="fill_container_width"
                className="w-4 h-4"
                checked={
                  horizontalSizing === "Mixed"
                    ? "indeterminate"
                    : horizontalSizing === SizingBehavior.FillContainer
                }
                onCheckedChange={fillContainerWidthHandler}
              />
              <Label htmlFor="fill_container_width" className="text-[9px] ml-1">
                Fill Width
              </Label>
            </div>
            {/* Fill Container Height */}
            <div className="flex items-center">
              <Checkbox
                id="fill_container_height"
                className="w-4 h-4"
                checked={
                  verticalSizing === "Mixed"
                    ? "indeterminate"
                    : verticalSizing === SizingBehavior.FillContainer
                }
                onCheckedChange={fillContainerHeightHandler}
              />
              <Label
                htmlFor="fill_container_height"
                className="text-[9px] ml-1"
              >
                Fill Height
              </Label>
            </div>
          </div>
          {layoutModeInitialized && layoutMode !== LayoutMode.None && (
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {/* Hug Width */}
              <div className="flex items-center">
                <Checkbox
                  id="hug_width"
                  className="w-4 h-4"
                  checked={
                    horizontalSizing === "Mixed"
                      ? "indeterminate"
                      : horizontalSizing === SizingBehavior.FitContent
                  }
                  onCheckedChange={hugWidthHandler}
                />
                <Label htmlFor="hug_width" className="text-[9px] ml-1">
                  Hug Width
                </Label>
              </div>
              {/* Hug Height */}
              <div className="flex items-center">
                <Checkbox
                  id="hug_height"
                  className="w-4 h-4"
                  checked={
                    verticalSizing === "Mixed"
                      ? "indeterminate"
                      : verticalSizing === SizingBehavior.FitContent
                  }
                  onCheckedChange={hugHeightHandler}
                />
                <Label htmlFor="hug_height" className="text-[9px] ml-1">
                  Hug Height
                </Label>
              </div>
            </div>
          )}
        </div>
      </div>

      {textGrowthInitialized && (
        <>
          <div className="grid gap-1.5 text-[9px]">Resizing</div>
          <div className="flex gap-1 rounded-sm border-1 bg-zinc-200 dark:bg-zinc-700">
            {textGrowthOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={textGrowth === opt.value ? "secondary" : "ghost"}
                size="icon"
                className="h-5 w-5 flex-1"
                onClick={() => {
                  blockUpdate(sceneManager, (block, node) => {
                    if (node.type === "text") {
                      const bounds = node.localBounds();

                      block.update(node, {
                        width: bounds.width,
                        height: bounds.height,
                        textGrowth: opt.value,
                      });

                      if (opt.value === "auto") {
                        block.update(node, {
                          horizontalSizing: SizingBehavior.FitContent,
                          verticalSizing: SizingBehavior.FitContent,
                        });
                      } else if (opt.value === "fixed-width") {
                        block.update(node, {
                          verticalSizing: SizingBehavior.FitContent,
                        });
                      }
                    }
                  });
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
        </>
      )}

      {clipInitialized && (
        <div className="flex items-center">
          <Checkbox
            id="clip_content"
            className="w-4 h-4"
            checked={clip === "Mixed" ? "indeterminate" : clip}
            onCheckedChange={(checked) => {
              blockUpdate(sceneManager, (block, node) => {
                if (node.type === "frame") {
                  block.update(node, { clip: checked === true });
                }
              });
            }}
          />
          <Label htmlFor="clip_content" className="text-[9px] ml-1">
            Clip Content
          </Label>
        </div>
      )}
    </Section>
  );
}

export default LayoutSection;
