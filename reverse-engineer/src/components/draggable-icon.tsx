import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import ResizeHandleIcon from "../ui/icons/resize-handle.svg?inline";
import { createPortal } from "react-dom";

export type DraggableIconProps = {
  value: string;
  onCommit?: (value: string) => void;
  onCommitDelta?: (delta: number, round: boolean) => void;
  step?: number;
  stepMultiplier?: number;
  stepDistance?: number;
  draggable?: boolean;
  children: React.ReactNode;
  className?: string;
  suffix?: string;
};

export function DraggableIcon(props: DraggableIconProps) {
  const {
    value,
    onCommit,
    onCommitDelta,
    step = 1,
    stepMultiplier = 10,
    stepDistance = 2,
    draggable = true,
    children,
    className,
    suffix,
  } = props;
  const isDragging = useRef(false);
  const dragStartValue = useRef<number | null>(null);
  const lastDeltaValue = useRef(0);
  const totalDistanceX = useRef(0);
  const fakeCursorX = useRef(0);
  const fakeCursorY = useRef(0);

  const [showFakeCursor, setShowFakeCursor] = useState(false);
  const [fakeCursorPos, setFakeCursorPos] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!draggable) return;

    e.preventDefault();
    isDragging.current = true;
    totalDistanceX.current = 0;
    fakeCursorX.current = e.clientX;
    fakeCursorY.current = e.clientY;
    const parsedValue = parseFloat(String(value));
    dragStartValue.current = Number.isNaN(parsedValue) ? null : parsedValue;
    lastDeltaValue.current = 0;

    document.body.style.cursor = "none";
    document.body.requestPointerLock();
    setShowFakeCursor(true);
    setFakeCursorPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!draggable) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      totalDistanceX.current += e.movementX;
      fakeCursorX.current += e.movementX;
      fakeCursorY.current += e.movementY;

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      // NOTE(sedivy): Wrap the total distance values so it appears on the screen
      // Use `((x % width) + width) % width` to handle negative values as well.
      fakeCursorX.current =
        ((fakeCursorX.current % screenWidth) + screenWidth) % screenWidth;
      fakeCursorY.current =
        ((fakeCursorY.current % screenHeight) + screenHeight) % screenHeight;

      setFakeCursorPos({ x: fakeCursorX.current, y: fakeCursorY.current });

      const effectiveStep = e.shiftKey ? step * stepMultiplier : step;
      const deltaValue =
        Math.round(totalDistanceX.current / (e.shiftKey ? stepDistance : 2)) *
        effectiveStep;

      if (onCommitDelta) {
        onCommitDelta(deltaValue - lastDeltaValue.current, e.shiftKey);

        lastDeltaValue.current = deltaValue;
      }

      // NOTE(sedivy): If we don't have onCommitDelta for incremental changes
      // then use the fallback onCommit that sets the full value.
      if (onCommitDelta == null && dragStartValue.current != null) {
        onCommit?.(
          String(dragStartValue.current + deltaValue) + (suffix ?? ""),
        );
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.exitPointerLock();
      setShowFakeCursor(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    draggable,
    step,
    onCommit,
    onCommitDelta,
    stepMultiplier,
    stepDistance,
    suffix,
  ]);

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={handleMouseDown}
        className={cn(
          "select-none",
          draggable ? "cursor-ew-resize" : "pointer-events-none",
          className,
        )}
        data-slot="visual-adornment"
      >
        {children}
      </button>

      {showFakeCursor &&
        createPortal(
          <div
            className="fixed pointer-events-none z-[9999]"
            style={{
              left: fakeCursorPos.x + 1,
              top: fakeCursorPos.y + 1,
              transform: "translate(-50%, -50%)",
            }}
          >
            <img
              className="select-none"
              src={ResizeHandleIcon}
              alt=""
              width={24}
              height={24}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
