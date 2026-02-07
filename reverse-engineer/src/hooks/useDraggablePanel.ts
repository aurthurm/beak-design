import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { platform } from "../platform";

export type Corner = "bottom-left" | "bottom-right" | "top-left" | "top-right";

const TITLEBAR_OFFSET = platform.isElectronMac ? 40 : 0;
const EDGE_OFFSET = 6;
const DRAG_VELOCITY_THRESHOLD = 400; // px/s - minimum velocity to trigger "throw"
const DRAG_VELOCITY_MULTIPLIER = 0.8; // seconds - how far to project at terminal velocity

export interface UseDraggablePanelOptions {
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  defaultCorner?: Corner;
  /** Offset from the right edge (e.g., for properties panel) */
  rightOffset?: number;
  /** Offset from the left edge (e.g., for layers panel) */
  leftOffset?: number;
  /** Additional offset for toolbar on top-left corner */
  toolbarWidth?: number;
  /** If true, the hook manages panel dimensions. If false, consumer manages dimensions. */
  manageDimensions?: boolean;
  /**
   * Optional function to get the active panel element.
   * Useful when a component has multiple panel states (e.g., expanded/collapsed).
   * If not provided, panelRef.current is used.
   */
  getActivePanel?: () => HTMLDivElement | null;
  /**
   * Optional localStorage key to persist corner position.
   * If provided, corner will be saved/restored from localStorage.
   */
  storageKey?: string;
}

export interface UseDraggablePanelReturn {
  panelRef: React.RefObject<HTMLDivElement | null>;
  panelWidth: number;
  setPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  panelHeight: number;
  setPanelHeight: React.Dispatch<React.SetStateAction<number>>;
  hasManuallyResizedHeight: boolean;
  corner: Corner;
  isDragging: boolean;
  isAnimatingToCorner: boolean;
  /** Full panel style including dimensions and positioning */
  panelStyle: React.CSSProperties;
  /** Just the positioning style (for consumers managing their own dimensions) */
  positionStyle: React.CSSProperties;
  /** Helper to get corner-based positioning */
  getCornerStyles: (corner: Corner) => React.CSSProperties;
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
  };
  resizeHandleProps: {
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
  };
}

export function useDraggablePanel(
  options: UseDraggablePanelOptions = {},
): UseDraggablePanelReturn {
  const {
    defaultWidth = 300,
    defaultHeight = 400,
    minWidth = 200,
    maxWidth = 800,
    minHeight = 150,
    maxHeight = 1200,
    defaultCorner = "bottom-left",
    rightOffset = 0,
    leftOffset = 0,
    toolbarWidth = 0,
    manageDimensions = true,
    getActivePanel: getActivePanelProp,
    storageKey,
  } = options;

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Helper to get the active panel element
  const getActivePanel = useCallback((): HTMLDivElement | null => {
    if (getActivePanelProp) {
      return getActivePanelProp();
    }
    return panelRef.current;
  }, [getActivePanelProp]);

  // Initialize corner from localStorage if storageKey is provided
  const getInitialCorner = (): Corner => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (
          saved === "bottom-left" ||
          saved === "bottom-right" ||
          saved === "top-left" ||
          saved === "top-right"
        ) {
          return saved;
        }
      } catch {
        // localStorage not available
      }
    }
    return defaultCorner;
  };

  const [corner, setCorner] = useState<Corner>(getInitialCorner);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingToCorner, setIsAnimatingToCorner] = useState(false);
  const [dragPosition, setDragPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const dragRef = useRef<{
    offsetX: number;
    offsetY: number;
    velocityHistory: Array<{ x: number; y: number; time: number }>;
  } | null>(null);

  const [panelWidth, setPanelWidth] = useState(defaultWidth);
  const [panelHeight, setPanelHeight] = useState(defaultHeight);
  const [hasManuallyResizedHeight, setHasManuallyResizedHeight] =
    useState(false);

  const resizingRef = useRef<{
    type: "width" | "height" | "corner" | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startCorner: Corner;
  }>({
    type: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startCorner: defaultCorner,
  });

  // Calculate corner styles for positioning
  const getCornerStyles = useCallback(
    (c: Corner): React.CSSProperties => {
      const offset = EDGE_OFFSET;
      const computedRightOffset = offset + rightOffset;
      const computedLeftOffset = offset + leftOffset;

      switch (c) {
        case "top-left":
          return {
            top: offset + TITLEBAR_OFFSET,
            left: computedLeftOffset + toolbarWidth,
            bottom: "auto",
            right: "auto",
          };
        case "top-right":
          return {
            top: offset + TITLEBAR_OFFSET,
            right: computedRightOffset,
            bottom: "auto",
            left: "auto",
          };
        case "bottom-left":
          return {
            bottom: offset,
            left: computedLeftOffset,
            top: "auto",
            right: "auto",
          };
        case "bottom-right":
          return {
            bottom: offset,
            right: computedRightOffset,
            top: "auto",
            left: "auto",
          };
      }
    },
    [rightOffset, leftOffset, toolbarWidth],
  );

  // Detect which edge is being hovered for resize
  const getEdgeType = useCallback(
    (
      e: React.MouseEvent | MouseEvent,
    ): "width" | "height" | "corner" | null => {
      if (!panelRef.current) return null;
      const rect = panelRef.current.getBoundingClientRect();

      const isLeftCorner = corner === "bottom-left" || corner === "top-left";
      const isBottomCorner =
        corner === "bottom-left" || corner === "bottom-right";

      const nearHorizontalEdge = isLeftCorner
        ? e.clientX >= rect.right - EDGE_OFFSET
        : e.clientX <= rect.left + EDGE_OFFSET;
      const nearVerticalEdge = isBottomCorner
        ? e.clientY <= rect.top + EDGE_OFFSET
        : e.clientY >= rect.bottom - EDGE_OFFSET;

      if (nearHorizontalEdge && nearVerticalEdge) return "corner";
      if (nearHorizontalEdge) return "width";
      if (nearVerticalEdge) return "height";
      return null;
    },
    [corner],
  );

  // Get cursor style for edge type
  const getCursorForType = useCallback(
    (type: "width" | "height" | "corner" | null): string => {
      if (type === "corner") {
        return corner === "bottom-left" || corner === "top-right"
          ? "nesw-resize"
          : "nwse-resize";
      }
      if (type === "width") return "ew-resize";
      if (type === "height") return "ns-resize";
      return "";
    },
    [corner],
  );

  // Resize handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (resizingRef.current.type || !panelRef.current) return;
      const type = getEdgeType(e);
      panelRef.current.style.cursor = getCursorForType(type);
    },
    [getEdgeType, getCursorForType],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const type = getEdgeType(e);
      if (!type) return;

      e.preventDefault();
      resizingRef.current = {
        type,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: panelWidth,
        startHeight: panelHeight,
        startCorner: corner,
      };
      document.body.style.cursor = getCursorForType(type);
    },
    [getEdgeType, getCursorForType, panelWidth, panelHeight, corner],
  );

  const handleMouseLeave = useCallback(() => {
    if (!resizingRef.current.type && panelRef.current) {
      panelRef.current.style.cursor = "";
    }
  }, []);

  // Document-level resize event handlers
  useEffect(() => {
    if (!manageDimensions) return;

    const onMouseMove = (e: MouseEvent) => {
      const { type, startX, startY, startWidth, startHeight, startCorner } =
        resizingRef.current;
      if (!type) return;

      const isLeftCorner =
        startCorner === "bottom-left" || startCorner === "top-left";
      const isBottomCorner =
        startCorner === "bottom-left" || startCorner === "bottom-right";

      if (type === "width" || type === "corner") {
        const deltaX = isLeftCorner ? e.clientX - startX : startX - e.clientX;
        setPanelWidth(
          Math.min(maxWidth, Math.max(minWidth, startWidth + deltaX)),
        );
      }

      if (type === "height" || type === "corner") {
        const deltaY = isBottomCorner ? startY - e.clientY : e.clientY - startY;
        const newHeight = Math.min(
          maxHeight,
          Math.max(minHeight, startHeight + deltaY),
        );
        setPanelHeight(newHeight);
      }
    };

    const onMouseUp = () => {
      if (resizingRef.current.type) {
        const wasResizingHeight =
          resizingRef.current.type === "height" ||
          resizingRef.current.type === "corner";
        if (wasResizingHeight) {
          setHasManuallyResizedHeight(true);
        }
        resizingRef.current.type = null;
        document.body.style.cursor = "";
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [manageDimensions, minWidth, maxWidth, minHeight, maxHeight]);

  // Drag start handler
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Allow drag if the element or its ancestors have data-drag-handle
      const hasDragHandle = target.closest("[data-drag-handle]");

      if (
        !hasDragHandle &&
        (target.closest("button") ||
          target.closest("input") ||
          target.closest("textarea") ||
          target.closest("select") ||
          resizingRef.current.type)
      ) {
        return;
      }

      e.preventDefault();
      const panel = getActivePanel();
      if (!panel) return;

      const rect = panel.getBoundingClientRect();

      dragRef.current = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        velocityHistory: [
          { x: e.clientX, y: e.clientY, time: performance.now() },
        ],
      };

      setDragPosition({ left: rect.left, top: rect.top });
      setIsDragging(true);
    },
    [getActivePanel],
  );

  // Document-level drag event handlers
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const newX = e.clientX - drag.offsetX;
      const newY = e.clientY - drag.offsetY;

      setDragPosition({ left: newX, top: newY });

      const now = performance.now();
      drag.velocityHistory.push({ x: e.clientX, y: e.clientY, time: now });
      const cutoff = now - 100;
      while (
        drag.velocityHistory.length > 1 &&
        drag.velocityHistory[0].time < cutoff
      ) {
        drag.velocityHistory.shift();
      }
    };

    const onMouseUp = () => {
      const panel = getActivePanel();
      const drag = dragRef.current;
      if (!panel) {
        setIsDragging(false);
        setDragPosition(null);
        dragRef.current = null;
        return;
      }

      const rect = panel.getBoundingClientRect();

      // Calculate velocity from history
      let velocityX = 0;
      let velocityY = 0;
      if (drag && drag.velocityHistory.length >= 2) {
        const first = drag.velocityHistory[0];
        const last = drag.velocityHistory[drag.velocityHistory.length - 1];
        const dt = (last.time - first.time) / 1000;
        if (dt > 0) {
          velocityX = (last.x - first.x) / dt;
          velocityY = (last.y - first.y) / dt;
        }
      }

      const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      const isThrown = speed > DRAG_VELOCITY_THRESHOLD;

      const projectedCenterX =
        rect.left +
        rect.width / 2 +
        (isThrown ? velocityX * DRAG_VELOCITY_MULTIPLIER : 0);
      const projectedCenterY =
        rect.top +
        rect.height / 2 +
        (isThrown ? velocityY * DRAG_VELOCITY_MULTIPLIER : 0);

      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;
      const isLeft = projectedCenterX < viewportCenterX;
      const isTop = projectedCenterY < viewportCenterY;

      let newCorner: Corner;
      if (isTop && isLeft) newCorner = "top-left";
      else if (isTop && !isLeft) newCorner = "top-right";
      else if (!isTop && isLeft) newCorner = "bottom-left";
      else newCorner = "bottom-right";

      const computedRightOffset = EDGE_OFFSET + rightOffset;
      const computedLeftOffset = EDGE_OFFSET + leftOffset;
      const targetX = newCorner.includes("left")
        ? computedLeftOffset + (newCorner === "top-left" ? toolbarWidth : 0)
        : window.innerWidth - rect.width - computedRightOffset;
      const targetY = newCorner.includes("top")
        ? EDGE_OFFSET + TITLEBAR_OFFSET
        : window.innerHeight - rect.height - EDGE_OFFSET;

      setIsDragging(false);
      setIsAnimatingToCorner(true);
      dragRef.current = null;

      gsap.fromTo(
        panel,
        { left: rect.left, top: rect.top },
        {
          left: targetX,
          top: targetY,
          duration: 0.7,
          ease: "elastic.out(0.5, 0.8)",
          onComplete: () => {
            setDragPosition(null);
            setCorner(newCorner);
            setIsAnimatingToCorner(false);
            // Persist corner to localStorage if storageKey is provided
            if (storageKey) {
              try {
                localStorage.setItem(storageKey, newCorner);
              } catch {
                // localStorage not available
              }
            }
          },
        },
      );
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    isDragging,
    rightOffset,
    leftOffset,
    toolbarWidth,
    getActivePanel,
    storageKey,
  ]);

  // Calculate position style (without dimensions)
  const positionStyle: React.CSSProperties =
    (isDragging || isAnimatingToCorner) && dragPosition
      ? { position: "fixed" as const, ...dragPosition }
      : isAnimatingToCorner
        ? { position: "fixed" as const }
        : getCornerStyles(corner);

  // Calculate full panel style including dimensions
  const panelStyle: React.CSSProperties = {
    width: panelWidth,
    height: panelHeight,
    ...positionStyle,
  };

  return {
    panelRef,
    panelWidth,
    setPanelWidth,
    panelHeight,
    setPanelHeight,
    hasManuallyResizedHeight,
    corner,
    isDragging,
    isAnimatingToCorner,
    panelStyle,
    positionStyle,
    getCornerStyles,
    dragHandleProps: {
      onMouseDown: handleDragStart,
    },
    resizeHandleProps: {
      onMouseMove: manageDimensions ? handleMouseMove : () => {},
      onMouseDown: manageDimensions ? handleMouseDown : () => {},
      onMouseLeave: manageDimensions ? handleMouseLeave : () => {},
    },
  };
}
