import { AlignItems, JustifyContent, LayoutMode } from "@ha/pencil-editor";

export type AlignmentPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * Converts layout properties to alignment position
 */
export const layoutPropertiesToAlignment = (
  justifyContent: JustifyContent,
  alignItems: AlignItems,
  mode: LayoutMode | undefined,
): AlignmentPosition => {
  let vertical: "top" | "middle" | "bottom";
  let horizontal: "left" | "center" | "right";

  if (mode === LayoutMode.Vertical) {
    // Vertical layout: justifyContent controls vertical, alignItems controls horizontal
    switch (justifyContent) {
      case JustifyContent.Start:
        vertical = "top";
        break;
      case JustifyContent.Center:
        vertical = "middle";
        break;
      case JustifyContent.End:
        vertical = "bottom";
        break;
      default:
        vertical = "top";
    }

    switch (alignItems) {
      case AlignItems.Start:
        horizontal = "left";
        break;
      case AlignItems.Center:
        horizontal = "center";
        break;
      case AlignItems.End:
        horizontal = "right";
        break;
      default:
        horizontal = "left";
    }
  } else {
    // Freform and Horizontal layout: justifyContent controls horizontal, alignItems controls vertical
    switch (justifyContent) {
      case JustifyContent.Start:
        horizontal = "left";
        break;
      case JustifyContent.Center:
        horizontal = "center";
        break;
      case JustifyContent.End:
        horizontal = "right";
        break;
      default:
        horizontal = "left";
    }

    switch (alignItems) {
      case AlignItems.Start:
        vertical = "top";
        break;
      case AlignItems.Center:
        vertical = "middle";
        break;
      case AlignItems.End:
        vertical = "bottom";
        break;
      default:
        vertical = "top";
    }
  }

  return `${vertical}-${horizontal}` as AlignmentPosition;
};

/**
 * Converts alignment position to layout properties
 */
export const alignmentToLayoutProperties = (
  position: AlignmentPosition,
  mode: LayoutMode,
): { justifyContent: JustifyContent; alignItems: AlignItems } => {
  // Extract vertical and horizontal alignment from position
  const [vertical, horizontal] = position.split("-") as [
    "top" | "middle" | "bottom",
    "left" | "center" | "right",
  ];

  let justifyContent: JustifyContent;
  let alignItems: AlignItems;

  if (mode === LayoutMode.Horizontal) {
    // Horizontal layout: justifyContent controls horizontal, alignItems controls vertical
    switch (horizontal) {
      case "left":
        justifyContent = JustifyContent.Start;
        break;
      case "center":
        justifyContent = JustifyContent.Center;
        break;
      case "right":
        justifyContent = JustifyContent.End;
        break;
    }

    switch (vertical) {
      case "top":
        alignItems = AlignItems.Start;
        break;
      case "middle":
        alignItems = AlignItems.Center;
        break;
      case "bottom":
        alignItems = AlignItems.End;
        break;
    }
  } else if (mode === LayoutMode.Vertical) {
    // Vertical layout: justifyContent controls vertical, alignItems controls horizontal
    switch (vertical) {
      case "top":
        justifyContent = JustifyContent.Start;
        break;
      case "middle":
        justifyContent = JustifyContent.Center;
        break;
      case "bottom":
        justifyContent = JustifyContent.End;
        break;
    }

    switch (horizontal) {
      case "left":
        alignItems = AlignItems.Start;
        break;
      case "center":
        alignItems = AlignItems.Center;
        break;
      case "right":
        alignItems = AlignItems.End;
        break;
    }
  } else {
    // Freeform layout: default to horizontal behavior
    switch (horizontal) {
      case "left":
        justifyContent = JustifyContent.Start;
        break;
      case "center":
        justifyContent = JustifyContent.Center;
        break;
      case "right":
        justifyContent = JustifyContent.End;
        break;
    }

    switch (vertical) {
      case "top":
        alignItems = AlignItems.Start;
        break;
      case "middle":
        alignItems = AlignItems.Center;
        break;
      case "bottom":
        alignItems = AlignItems.End;
        break;
    }
  }

  return { justifyContent, alignItems };
};
