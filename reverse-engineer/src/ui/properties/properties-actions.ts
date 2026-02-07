import {
  LayoutMode,
  type NodeProperties,
  type ObjectUpdateBlock,
  type Resolved,
  type SceneManager,
  type SceneNode,
  type Single,
  SizingBehavior,
  type Value,
  type Variable,
} from "@ha/pencil-editor";
import { logger } from "@ha/shared";
import { assertUnreachable } from "@/src/lib/utils";

export type ExtendedProperty = keyof ExtendedProperties;

export type ExtendedProperties = NodeProperties & {
  childSpacing: Value<"number">;
  padding: Value<"number">;
  paddingHorizontal: Value<"number">;
  paddingVertical: Value<"number">;
  paddingTop: Value<"number">;
  paddingRight: Value<"number">;
  paddingBottom: Value<"number">;
  paddingLeft: Value<"number">;
  hugWidth: boolean;
  hugHeight: boolean;
  fillContainerWidth: boolean;
  fillContainerHeight: boolean;
  cornerRadii: Value<"number">;
  cornerRadius0: Value<"number">;
  cornerRadius1: Value<"number">;
  cornerRadius2: Value<"number">;
  cornerRadius3: Value<"number">;
  strokeWidths: Value<"number">;
  strokeWidthTop: Value<"number">;
  strokeWidthRight: Value<"number">;
  strokeWidthBottom: Value<"number">;
  strokeWidthLeft: Value<"number">;
};

export type ExtendedPropertyType<T extends Single<ExtendedProperty>> =
  ExtendedProperties[T];

export function setTextGrowthBasedOnResize(
  block: ObjectUpdateBlock,
  node: SceneNode,
  modifiedX: boolean,
  modifiedY: boolean,
) {
  if (node.type === "text" && (modifiedX || modifiedY)) {
    const bounds = node.localBounds();

    if (
      node.properties.textGrowth == null ||
      node.properties.textGrowth === "auto"
    ) {
      const value = modifiedY ? "fixed-width-height" : "fixed-width";

      block.update(node, {
        textGrowth: value,
        width: bounds.width,
        height: bounds.height,
      });
    } else if (node.properties.textGrowth === "fixed-width") {
      if (modifiedY) {
        block.update(node, {
          textGrowth: "fixed-width-height",
          width: bounds.width,
          height: bounds.height,
        });
      }
    }
  }
}

type CommitPropertyValue<P extends keyof ExtendedProperties> =
  | ExtendedProperties[P]
  | (Variable<any> extends ExtendedProperties[P] ? undefined : never);
export function commitProperty<P extends keyof ExtendedProperties>(
  sceneManager: SceneManager,
  property: P,
  value: CommitPropertyValue<P>,
  requestRefresh?: () => void,
): void {
  const selectedNodes = sceneManager.selectionManager.selectedNodes;
  if (!selectedNodes || selectedNodes.size === 0) return;

  const block = sceneManager.scenegraph.beginUpdate();

  // Handle boolean toggles explicitly
  if (
    property === "hugWidth" ||
    property === "hugHeight" ||
    property === "fillContainerWidth" ||
    property === "fillContainerHeight" ||
    property === "clip"
  ) {
    const boolValue = Boolean(value as boolean);
    selectedNodes.forEach((node) => {
      if (property === "hugWidth") {
        // When hugWidth is enabled, set horizontal sizing to FitContent
        const newSizing = boolValue
          ? SizingBehavior.FitContent
          : SizingBehavior.Fixed;

        block.update(node, {
          horizontalSizing: newSizing,
        });

        setTextGrowthBasedOnResize(block, node, true, false);
      } else if (property === "hugHeight") {
        // When hugHeight is enabled, set vertical sizing to FitContent
        const newSizing = boolValue
          ? SizingBehavior.FitContent
          : SizingBehavior.Fixed;

        block.update(node, {
          verticalSizing: newSizing,
        });

        setTextGrowthBasedOnResize(block, node, false, true);
      } else if (property === "fillContainerWidth") {
        // When fillContainerWidth is enabled, set horizontal sizing to FillContainer
        const newSizing = boolValue
          ? SizingBehavior.FillContainer
          : SizingBehavior.Fixed;

        block.update(node, {
          horizontalSizing: newSizing,
        });

        setTextGrowthBasedOnResize(block, node, true, false);
      } else if (property === "fillContainerHeight") {
        // When fillContainerHeight is enabled, set vertical sizing to FillContainer
        const newSizing = boolValue
          ? SizingBehavior.FillContainer
          : SizingBehavior.Fixed;

        block.update(node, {
          verticalSizing: newSizing,
        });

        setTextGrowthBasedOnResize(block, node, false, true);
      } else if (property === "clip") {
        block.update(node, {
          clip: boolValue,
        });
      } else {
        assertUnreachable(property);
      }
    });

    sceneManager.scenegraph.commitBlock(block, { undo: true });

    requestRefresh?.();
    return;
  }

  if (property === "fontFamily") {
    const properValue = value as CommitPropertyValue<"fontFamily">;
    selectedNodes.forEach((node) => {
      if (node.type === "text") {
        block.update(node, {
          fontFamily:
            properValue === undefined
              ? node.properties.resolved.fontFamily
              : properValue,
        });
      }
    });
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (property === "childSpacing") {
    const properValue = value as CommitPropertyValue<"childSpacing">;
    for (const node of selectedNodes) {
      if (node.type === "frame" || node.type === "group") {
        block.update(node, {
          layoutChildSpacing: properValue,
        });
      }
    }
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (property === "padding") {
    const properValue = value as CommitPropertyValue<"padding">;
    selectedNodes.forEach((node) => {
      if (node.type === "frame" || node.type === "group") {
        let currentValue = node.properties.layoutPadding;
        let currentResolved = node.properties.resolved.layoutPadding;

        if (Array.isArray(currentValue)) {
          currentResolved = (
            currentResolved as Resolved<typeof currentValue>
          )[0];
          currentValue = currentValue[0];
        }

        currentValue =
          properValue === undefined ? currentResolved : properValue;

        block.update(node, {
          layoutPadding: currentValue,
        });
      }
    });
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (
    property === "paddingHorizontal" ||
    property === "paddingVertical"
  ) {
    const properValue = value as CommitPropertyValue<
      "paddingHorizontal" | "paddingVertical"
    >;
    for (const node of selectedNodes) {
      if (node.type === "frame" || node.type === "group") {
        let currentValue = node.properties.layoutPadding ?? [0, 0];
        let currentResolved = node.properties.resolved.layoutPadding ?? [0, 0];

        if (Array.isArray(currentValue)) {
          if (currentValue.length === 2) {
            currentResolved = [
              (currentResolved as Resolved<typeof currentValue>)[0],
              (currentResolved as Resolved<typeof currentValue>)[1],
            ];
            currentValue = [currentValue[0], currentValue[1]];
          } else {
            currentResolved = [
              (currentResolved as Resolved<typeof currentValue>)[1],
              (currentResolved as Resolved<typeof currentValue>)[0],
            ];
            currentValue = [currentValue[1], currentValue[0]];
          }
        } else {
          currentResolved = [
            currentResolved as Resolved<typeof currentValue>,
            currentResolved as Resolved<typeof currentValue>,
          ];
          currentValue = [currentValue, currentValue];
        }

        const updatedIndex = property === "paddingHorizontal" ? 0 : 1;
        currentValue[updatedIndex] =
          properValue === undefined
            ? currentResolved[updatedIndex]
            : properValue;

        block.update(node, {
          layoutPadding: currentValue,
        });
      }
    }
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (property === "cornerRadii") {
    const properValue = value as CommitPropertyValue<"cornerRadii">;
    selectedNodes.forEach((node) => {
      const currentValue = node.properties.cornerRadius ?? [0, 0, 0, 0];
      const currentResolved =
        node.properties.resolved.cornerRadius ??
        ([0, 0, 0, 0] as Resolved<typeof currentValue>);

      if (node.type === "frame" || node.type === "rectangle") {
        block.update(node, {
          cornerRadius:
            properValue === undefined
              ? [
                  currentResolved[0],
                  currentResolved[1],
                  currentResolved[2],
                  currentResolved[3],
                ]
              : [properValue, properValue, properValue, properValue],
        });
      }
    });
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (
    property === "cornerRadius0" ||
    property === "cornerRadius1" ||
    property === "cornerRadius2" ||
    property === "cornerRadius3"
  ) {
    const properValue = value as CommitPropertyValue<
      "cornerRadius0" | "cornerRadius1" | "cornerRadius2" | "cornerRadius3"
    >;
    selectedNodes.forEach((node) => {
      const currentValue = node.properties.cornerRadius ?? [0, 0, 0, 0];
      const currentResolved =
        node.properties.resolved.cornerRadius ??
        ([0, 0, 0, 0] as Resolved<typeof currentValue>);

      if (node.type === "frame" || node.type === "rectangle") {
        block.update(node, {
          cornerRadius: [
            property === "cornerRadius0"
              ? properValue === undefined
                ? currentResolved[0]
                : properValue
              : currentValue[0],
            property === "cornerRadius1"
              ? properValue === undefined
                ? currentResolved[1]
                : properValue
              : currentValue[1],
            property === "cornerRadius2"
              ? properValue === undefined
                ? currentResolved[2]
                : properValue
              : currentValue[2],
            property === "cornerRadius3"
              ? properValue === undefined
                ? currentResolved[3]
                : properValue
              : currentValue[3],
          ],
        });
      }
    });
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (property === "textGrowth") {
    for (const node of selectedNodes) {
      const bounds = node.localBounds();

      block.update(node, {
        textGrowth: value as "auto" | "fixed-width" | "fixed-width-height",
        width: bounds.width,
        height: bounds.height,
      });
    }

    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (
    property === "paddingTop" ||
    property === "paddingRight" ||
    property === "paddingBottom" ||
    property === "paddingLeft"
  ) {
    const properValue = value as CommitPropertyValue<
      "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
    >;
    selectedNodes.forEach((node) => {
      if (node.type === "frame" || node.type === "group") {
        let currentValue = node.properties.layoutPadding ?? [0, 0];
        let currentResolved = node.properties.resolved.layoutPadding ?? [0, 0];

        if (Array.isArray(currentValue)) {
          if (currentValue.length === 2) {
            currentResolved = [
              (currentResolved as Resolved<typeof currentValue>)[1],
              (currentResolved as Resolved<typeof currentValue>)[0],
              (currentResolved as Resolved<typeof currentValue>)[1],
              (currentResolved as Resolved<typeof currentValue>)[0],
            ];
            currentValue = [
              currentValue[1],
              currentValue[0],
              currentValue[1],
              currentValue[0],
            ];
          } else {
            currentResolved = [
              (currentResolved as Resolved<typeof currentValue>)[0],
              (currentResolved as Resolved<typeof currentValue>)[1],
              (currentResolved as Resolved<typeof currentValue>)[2],
              (currentResolved as Resolved<typeof currentValue>)[3],
            ];
            currentValue = [
              currentValue[0],
              currentValue[1],
              currentValue[2],
              currentValue[3],
            ];
          }
        } else {
          currentResolved = [
            currentResolved as Resolved<typeof currentValue>,
            currentResolved as Resolved<typeof currentValue>,
            currentResolved as Resolved<typeof currentValue>,
            currentResolved as Resolved<typeof currentValue>,
          ];
          currentValue = [
            currentValue,
            currentValue,
            currentValue,
            currentValue,
          ];
        }

        let updatedIndex = 0;
        switch (property) {
          case "paddingTop":
            updatedIndex = 0;
            break;
          case "paddingRight":
            updatedIndex = 1;
            break;
          case "paddingBottom":
            updatedIndex = 2;
            break;
          case "paddingLeft":
            updatedIndex = 3;
            break;
        }

        currentValue[updatedIndex] =
          properValue === undefined
            ? currentResolved[updatedIndex]
            : properValue;

        block.update(node, {
          layoutPadding: currentValue,
        });
      }
    });
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (property === "opacity") {
    const properValue = value as CommitPropertyValue<"opacity">;
    selectedNodes.forEach((node) => {
      const currentValue = node.properties.opacity;
      const currentResolved = node.properties.resolved.opacity as Resolved<
        typeof currentValue
      >;

      block.update(node, {
        opacity: properValue ?? currentResolved,
      });
    });
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (property === "strokeWidths") {
    const properValue = value as CommitPropertyValue<"strokeWidths">;
    selectedNodes.forEach((node) => {
      const currentValue = node.properties.strokeWidth ?? [0, 0, 0, 0];
      const currentResolved =
        node.properties.resolved.strokeWidth ??
        ([0, 0, 0, 0] as Resolved<typeof currentValue>);

      if (
        node.type === "frame" ||
        node.type === "rectangle" ||
        node.type === "path" ||
        node.type === "ellipse" ||
        node.type === "line" ||
        node.type === "polygon"
      ) {
        block.update(node, {
          strokeWidth:
            properValue === undefined
              ? [
                  currentResolved[0],
                  currentResolved[1],
                  currentResolved[2],
                  currentResolved[3],
                ]
              : [properValue, properValue, properValue, properValue],
        });
      }
    });
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (
    property === "strokeWidthTop" ||
    property === "strokeWidthRight" ||
    property === "strokeWidthBottom" ||
    property === "strokeWidthLeft"
  ) {
    const properValue = value as CommitPropertyValue<
      | "strokeWidthTop"
      | "strokeWidthRight"
      | "strokeWidthBottom"
      | "strokeWidthLeft"
    >;
    selectedNodes.forEach((node) => {
      const currentValue = node.properties.strokeWidth ?? [0, 0, 0, 0];
      const currentResolved =
        node.properties.resolved.strokeWidth ??
        ([0, 0, 0, 0] as Resolved<typeof currentValue>);

      if (
        node.type === "frame" ||
        node.type === "rectangle" ||
        node.type === "path" ||
        node.type === "ellipse" ||
        node.type === "line" ||
        node.type === "polygon"
      ) {
        block.update(node, {
          strokeWidth: [
            property === "strokeWidthTop"
              ? properValue === undefined
                ? currentResolved[0]
                : properValue
              : currentValue[0],
            property === "strokeWidthRight"
              ? properValue === undefined
                ? currentResolved[1]
                : properValue
              : currentValue[1],
            property === "strokeWidthBottom"
              ? properValue === undefined
                ? currentResolved[2]
                : properValue
              : currentValue[2],
            property === "strokeWidthLeft"
              ? properValue === undefined
                ? currentResolved[3]
                : properValue
              : currentValue[3],
          ],
        });
      }
    });
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  } else if (property === "fontSize") {
    const properValue = value as CommitPropertyValue<"fontSize">;
    selectedNodes.forEach((node) => {
      const currentResolved = node.properties.resolved.fontSize;

      if (
        node.type === "text" ||
        node.type === "note" ||
        node.type === "prompt" ||
        node.type === "context"
      ) {
        block.update(node, {
          fontSize: properValue === undefined ? currentResolved : properValue,
        });
      }
    });
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  }

  if (value === "Mixed") {
    sceneManager.scenegraph.commitBlock(block, { undo: true });
    requestRefresh?.();
    return;
  }

  let numValue: number | undefined;
  const nonNumericProperties: Array<ExtendedProperty> = [
    "fontFamily",
    "textAlign",
    "textGrowth",
    "fontWeight",
    "iconFontName",
    "iconFontFamily",
    "iconFontWeight",
    "strokeWidth",
    "cornerRadius",
    // booleans
    "strokeAlignment",
    "hugWidth",
    "hugHeight",
    "clip",
  ];

  if (!nonNumericProperties.includes(property) && typeof value === "string") {
    numValue = parseFloat(value);
    if (Number.isNaN(numValue)) {
      logger.warn(`Invalid number string for property ${property}: ${value}`);
      requestRefresh?.();
      return;
    }
  } else if (nonNumericProperties.includes(property)) {
    // leave numValue undefined
  } else if (typeof value === "number") {
    numValue = value;
  } else if (value === null) {
    // leave as null
  } else {
    logger.warn(
      `Invalid value type for property ${property}: ${typeof value}, value:`,
      value,
    );
    requestRefresh?.();
    return;
  }

  // Convert degrees to radians for rotation
  if (property === "rotation" && numValue != null) {
    numValue = numValue * (Math.PI / 180.0);
  }

  if (property !== "textAlign") {
    selectedNodes.forEach((node: SceneNode) => {
      const valueToUpdate = numValue !== undefined ? numValue : value;

      block.update<any>(node, {
        [property]: valueToUpdate,
      });
    });
  } else if (property === "textAlign") {
    logger.warn(
      "commitProperty called with textAlign, should use specific text handlers",
    );
  }

  sceneManager.scenegraph.commitBlock(block, { undo: true });
  requestRefresh?.();
}
