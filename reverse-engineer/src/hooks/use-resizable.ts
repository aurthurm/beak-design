import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { clamp } from "@ha/pencil-editor";

export function useResizable(
  width: number,
  {
    min: minWidth,
    max: maxWidth,
    default: defaultWidth,
  }: {
    min: number;
    max: number;
    default: number;
  },
  onChange?: (width: number) => void,
) {
  const [isResizing, setIsResizing] = useState(false);

  const mouseDownPosition = useRef(0);
  const mouseDownWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      document.body.style.cursor = "ew-resize";
      mouseDownPosition.current = e.clientX;
      mouseDownWidth.current = width;
      setIsResizing(true);
    },
    [width],
  );

  const onMouseMove = useEffectEvent((e: MouseEvent) => {
    const delta = e.clientX - mouseDownPosition.current;
    const newWidth = clamp(minWidth, mouseDownWidth.current + delta, maxWidth);
    onChange?.(newWidth);
  });

  const onDoubleClick = useCallback(() => {
    onChange?.(defaultWidth);
  }, [defaultWidth, onChange]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const onMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.body.style.cursor = "default";

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing]);

  return () => {
    return {
      onMouseDown,
      onDoubleClick,
    };
  };
}
