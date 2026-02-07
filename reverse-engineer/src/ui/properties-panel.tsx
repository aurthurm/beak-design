import type { SceneManager } from "@ha/pencil-editor";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { platform } from "../platform";
import { Card, CardContent } from "../components/card";
import { useSceneManager } from "../pages/Editor";
import AlignmentControls from "./properties/AlignmentSection";
import AppearanceSection from "./properties/AppearanceSection";
import EffectsSection from "./properties/EffectsSection";
import FillSection from "./properties/FillSection";
import IconSection from "./properties/IconSection";
import LayoutSection from "./properties/LayoutSection";
import MetadataSection from "./properties/MetadataSection";
import PositionSection from "./properties/PositionSection";
import { computeAllProperties } from "./properties/properties-compute";
import StrokeSection from "./properties/StrokeSection";
import { ThemeSection } from "./properties/ThemeSection";
import TopSection from "./properties/TopSection";
import TypographySection from "./properties/TypographySection";

// Properties panel width in pixels (w-53 in Tailwind = 53 * 4 = 212px)
export const PROPERTIES_PANEL_WIDTH = 212;

interface PropertiesPanelProps {
  toggleTheme: () => void;
  isDarkMode: boolean;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
}

// Simplified computed state - directly use the compute functions
function computePropertiesFromSelection(sceneManager: SceneManager) {
  const selectedNodes = sceneManager.selectionManager.selectedNodes;
  const selectedNodesLength = selectedNodes.size;

  // Compute all values using the efficient single-iteration function
  const computedProperties = computeAllProperties(selectedNodes.values());
  const {
    position,
    sizing,
    opacity,
    cornerRadii,
    stroke,
    text,
    iconFont,
    layerName,
    context,
    clipInitialized,
    clip,
    theme,
    metadata,
  } = computedProperties;

  // Determine if corner radius should be shown (only for rectangle and frame types)
  const shouldShowCornerRadius =
    selectedNodesLength > 0 &&
    Array.from(selectedNodes.values()).some(
      (node) => node.type === "rectangle" || node.type === "frame",
    );

  return {
    position,

    layoutMode: computedProperties.layoutMode,
    layoutModeInitialized: computedProperties.layoutModeInitialized,
    layoutChildSpacing: computedProperties.layoutChildSpacing,
    layoutPadding: computedProperties.layoutPadding,
    layoutJustifyContent: computedProperties.layoutJustifyContent,
    layoutAlignItems: computedProperties.layoutAlignItems,

    width: computedProperties.width,
    height: computedProperties.height,
    sizing,
    opacity: opacity,
    cornerRadii: cornerRadii,
    shouldShowCornerRadius,
    fills: computedProperties.fills,
    effects: computedProperties.effects,
    stroke,
    text,
    iconFont,
    layerName,
    context,
    clipInitialized,
    clip,
    selectedNodesLength,
    alignmentDisabled: selectedNodesLength < 2,
    theme,
    metadata,
  };
}

export default function PropertiesPanel({
  toggleTheme,
  isDarkMode,
  isCollapsed = false,
  setIsCollapsed,
}: PropertiesPanelProps): React.ReactElement | null {
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const sceneManager = useSceneManager();

  // Memoize computed state to prevent unnecessary recalculations
  // This is a significant performance optimization as computePropertiesFromSelection
  // involves iterating through all selected nodes and computing multiple properties
  // We intentionally use updateTrigger to manually control when recomputation happens
  // biome-ignore lint/correctness/useExhaustiveDependencies: updateTrigger is needed to force recomputation
  const computedState = useMemo(() => {
    return computePropertiesFromSelection(sceneManager);
  }, [updateTrigger, sceneManager]);

  useEffect(() => {
    const callback = () => {
      // NOTE(sedivy): We need the requestIdleCallback to break the chain of
      // callbacks. Without it, React will think it's stuck in an infinite loop
      // and will throw an error.
      const requestIdleCallbackPolyfill =
        window.requestIdleCallback || ((cb) => setTimeout(cb, 0));

      requestIdleCallbackPolyfill(() => {
        setUpdateTrigger((prev) => prev + 1);
      });
    };

    sceneManager.eventEmitter.on("selectionChangeDebounced", callback);
    sceneManager.eventEmitter.on(
      "selectedNodePropertyChangeDebounced",
      callback,
    );

    callback();

    return () => {
      sceneManager.eventEmitter.off("selectionChangeDebounced", callback);
      sceneManager.eventEmitter.off(
        "selectedNodePropertyChangeDebounced",
        callback,
      );
    };
  }, [sceneManager]);

  // Memoize selectedNodesArray to ensure it updates when triggerUpdate is called
  // biome-ignore lint/correctness/useExhaustiveDependencies: updateTrigger is needed to refresh when selection changes
  const selectedNodesArray = useMemo(() => {
    const nodes = Array.from(
      sceneManager.selectionManager.selectedNodes.values(),
    );
    return nodes;
  }, [sceneManager, updateTrigger]);

  const handleAlignClick = useCallback(
    (alignType: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
      sceneManager.nodeManager.alignSelectedNodes(alignType);
    },
    [sceneManager],
  );

  return (
    <>
      {computedState.selectedNodesLength > 0 && (
        <Card
          className={`select-none shadow-none z-10 pt-0 pb-0 ${
            isCollapsed
              ? "absolute right-1.5 top-1.5 w-51"
              : `w-53 h-full mt-0 overflow-y-auto rounded-none border-l border-l-[1px] border-t-0 border-r-0 border-b-0 flex-shrink-0`
          } ${platform.isElectronMac && (isCollapsed ? "top-11.5" : "mt-10")}`}
        >
          <CardContent className="px-0">
            <TopSection
              isDarkMode={isDarkMode}
              isCollapsed={isCollapsed}
              metaSelectedNodesLength={computedState.selectedNodesLength}
              metaLayerName={computedState.layerName}
              context={computedState.context}
              toggleTheme={toggleTheme}
              setIsCollapsed={setIsCollapsed}
            />
            {!isCollapsed && (
              <div className="text-xxs border-b">
                <AlignmentControls
                  disabled={computedState.alignmentDisabled}
                  onAlignClick={handleAlignClick}
                />

                {/* Position */}
                <PositionSection
                  x={computedState.position.x}
                  y={computedState.position.y}
                  rotation={computedState.position.rotation}
                />

                {/* Layout */}
                <LayoutSection
                  width={computedState.width}
                  height={computedState.height}
                  layoutMode={computedState.layoutMode}
                  layoutModeInitialized={computedState.layoutModeInitialized}
                  layoutChildSpacing={computedState.layoutChildSpacing}
                  layoutPadding={computedState.layoutPadding}
                  layoutJustifyContent={computedState.layoutJustifyContent}
                  layoutAlignItems={computedState.layoutAlignItems}
                  horizontalSizing={computedState.sizing.horizontalSizing}
                  verticalSizing={computedState.sizing.verticalSizing}
                  textGrowth={computedState.text?.textGrowth}
                  textGrowthInitialized={computedState.text !== undefined}
                  clipInitialized={computedState.clipInitialized}
                  clip={computedState.clip}
                  selectedNodesArray={selectedNodesArray}
                />

                {/* Appearance */}
                <AppearanceSection
                  opacity={computedState.opacity}
                  cornerRadii={computedState.cornerRadii ?? null}
                  shouldShowCornerRadius={
                    computedState.shouldShowCornerRadius ?? false
                  }
                />

                {/* Fill */}
                <FillSection fills={computedState.fills} />

                {/* Stroke */}
                <StrokeSection
                  fills={computedState.stroke.fills}
                  width={computedState.stroke.strokeWidth}
                  alignment={computedState.stroke.strokeAlignment}
                />

                {/* Text */}
                {computedState.text && (
                  <TypographySection
                    fontFamily={computedState.text.fontFamily}
                    fontSize={computedState.text.fontSize}
                    fontWeight={computedState.text.fontWeight}
                    fontStyle={computedState.text.fontStyle}
                    textAlign={computedState.text.textAlign}
                    textAlignVertical={computedState.text.textAlignVertical}
                    lineHeight={computedState.text.lineHeight}
                    letterSpacing={computedState.text.letterSpacing}
                    textGrowth={computedState.text.textGrowth}
                  />
                )}

                {/* Icon Font */}
                {computedState.iconFont.isVisible && (
                  <IconSection
                    iconFontName={computedState.iconFont.iconFontName}
                    iconFontFamily={computedState.iconFont.iconFontFamily}
                    iconFontWeight={computedState.iconFont.iconFontWeight}
                  />
                )}

                {/* Effects */}
                <EffectsSection effects={computedState.effects} />

                {/* Theme */}
                <ThemeSection theme={computedState.theme} />

                {/* Metadata */}
                {computedState.metadata && (
                  <MetadataSection metadata={computedState.metadata} />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
