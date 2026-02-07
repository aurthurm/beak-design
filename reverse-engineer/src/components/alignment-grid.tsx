import { Axis } from "@ha/pencil-editor";
import React from "react";
import { cn } from "../lib/utils";
import type { AlignmentPosition } from "../utils/alignment-utils";
import { Button } from "./button";

interface AlignmentGridProps {
  selected?: AlignmentPosition;
  onSelect?: (position: AlignmentPosition) => void;
  className?: string;
  spaceBetweenOrAround?: boolean;
  direction?: Axis;
}

const alignmentPositions: AlignmentPosition[][] = [
  ["top-left", "top-center", "top-right"],
  ["middle-left", "middle-center", "middle-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

export const AlignmentGrid = React.memo(function AlignmentGrid({
  selected,
  onSelect,
  className,
  spaceBetweenOrAround: _spaceBetweenOrAround,
  direction,
}: AlignmentGridProps): React.ReactElement {
  const positionsToShow = alignmentPositions.flat();

  // Constants for repeated CSS classes
  const INDICATOR_CLASSES = {
    unselected: "w-0.5 h-0.5",
    exactMatch: "w-2 h-2 rounded-[2px]",
    horizontalEdge: "w-0.5 h-2.5 rounded-[2px]",
    horizontalCenter: "w-0.5 h-1.5 rounded-[2px]",
    verticalEdge: "w-2.5 h-0.5 rounded-[2px]",
    verticalCenter: "w-1.5 h-0.5 rounded-[2px]",
  } as const;

  // Helper function to determine if a position should be highlighted based on axis selection
  const getAxisPositions = (
    pos: AlignmentPosition,
  ): { row: string; column: string } => {
    const [vertical, horizontal] = pos.split("-");
    return { row: vertical, column: horizontal };
  };

  const getIndicatorClasses = (visualPosition: AlignmentPosition): string => {
    const isExactMatch = selected === visualPosition;

    // Simple case: no direction or spaceBetweenOrAround
    if (!_spaceBetweenOrAround) {
      return isExactMatch
        ? INDICATOR_CLASSES.exactMatch
        : INDICATOR_CLASSES.unselected;
    }

    // If no selection, return unselected
    if (!selected) {
      return INDICATOR_CLASSES.unselected;
    }

    const selectedAxis = getAxisPositions(selected);
    const currentAxis = getAxisPositions(visualPosition);

    // Check if current position is in the selected axis
    const isInSelectedAxis =
      direction === Axis.Horizontal
        ? selectedAxis.row === currentAxis.row
        : direction === Axis.Vertical
          ? selectedAxis.column === currentAxis.column
          : false;

    if (!isInSelectedAxis) {
      return INDICATOR_CLASSES.unselected;
    }

    // Position is in selected axis - determine indicator style
    if (direction === Axis.Horizontal) {
      const isLeftOrRight =
        visualPosition.includes("left") || visualPosition.includes("right");
      return isLeftOrRight
        ? INDICATOR_CLASSES.horizontalEdge
        : INDICATOR_CLASSES.horizontalCenter;
    } else if (direction === Axis.Vertical) {
      const isTopOrBottom =
        visualPosition.includes("top") || visualPosition.includes("bottom");
      return isTopOrBottom
        ? INDICATOR_CLASSES.verticalEdge
        : INDICATOR_CLASSES.verticalCenter;
    }

    return INDICATOR_CLASSES.unselected;
  };

  return (
    <div
      className={cn(
        "grid gap-1",
        "grid-cols-3 grid-rows-3", // Full 3x3 grid when spaceBetweenOrAround is false
        className,
      )}
    >
      {positionsToShow.map((visualPosition) => {
        const indicatorClasses = getIndicatorClasses(visualPosition);
        return (
          <Button
            key={visualPosition}
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-[1px] hover:bg-zinc-200 dark:hover:bg-accent/50",
              "w-6.5 h-5", // Standard size when spaceBetweenOrAround is false
            )}
            onClick={() => onSelect?.(visualPosition)}
            title={visualPosition
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}
          >
            <div className="flex items-center justify-center w-full h-full">
              <div
                className={cn(
                  "transition-all",
                  indicatorClasses,
                  indicatorClasses === INDICATOR_CLASSES.unselected
                    ? "bg-current"
                    : "bg-[#3D99FF]",
                )}
              />
            </div>
          </Button>
        );
      })}
    </div>
  );
});

export default AlignmentGrid;
