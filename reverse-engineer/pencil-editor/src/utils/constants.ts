import { hexToColor } from "../skia";

export const COLORS = {
  LIGHT_BLUE: hexToColor("#3D99FF"),
  GRAY: hexToColor("#CCCCCC"),
  MAGENTA: hexToColor("#D480FF"),
  PURPLE: hexToColor("#9580FF"),
} as const;

export const UI_FONT_FAMILY =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
