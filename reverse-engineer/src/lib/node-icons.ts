import { logger } from "@ha/shared";
import {
  AlignStartHorizontal,
  AlignStartVertical,
  Circle,
  Diamond,
  Frame,
  Image,
  Square,
  SquareDashed,
  Type,
  type LucideIcon,
} from "lucide-react";
import { IconVariables } from "../components/icons";
import { FillType, LayoutMode, type SceneNode } from "@ha/pencil-editor";

export function nodeHasImageFill(node: SceneNode): boolean {
  if (!node.supportsImageFill()) {
    return false;
  }

  if (node.properties.resolved.fills) {
    for (const fill of node.properties.resolved.fills) {
      if (fill.type === FillType.Image) {
        return true;
      }
    }
  }

  return false;
}

export function getNodeIcon(
  node: SceneNode,
): LucideIcon | typeof IconVariables {
  if (node.reusable) {
    return IconVariables;
  }

  if (node.prototype && node.id !== node.prototype.node.id) {
    return Diamond;
  }

  const direction = node.properties.resolved.layoutMode;
  if (direction === LayoutMode.Horizontal) {
    return AlignStartHorizontal;
  } else if (direction === LayoutMode.Vertical) {
    return AlignStartVertical;
  }

  if (nodeHasImageFill(node)) {
    return Image;
  }

  const type = node.type;
  switch (type) {
    case "frame":
      return Frame;
    case "group":
      return SquareDashed;
    case "rectangle":
      return Square;
    case "ellipse":
      return Circle;
    case "text":
      return Type;

    case "icon_font":
    case "context":
    case "path":
    case "line":
    case "polygon":
    case "note":
    case "prompt":
      return Square; // TODO(sedivy): Replace with a proper icon.

    default: {
      const missing: never = type;
      logger.warn("Unknown layer type for icon:", missing);
      return Square;
    }
  }
}
