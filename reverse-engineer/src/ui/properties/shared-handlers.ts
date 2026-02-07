import { useCallback } from "react";
import {
  commitProperty,
  type ExtendedProperties,
  type ExtendedPropertyType,
  type ExtendedProperty,
} from "./properties-actions";
import {
  type Single,
  type Variable,
  clamp,
  type ObjectUpdateBlock,
  type SceneNode,
  type SceneManager,
} from "@ha/pencil-editor";

/**
 * Creates a toggle handler for boolean properties
 */
export function useToggleHandler(
  sceneManager: SceneManager,
  property: ExtendedProperty,
) {
  return useCallback(
    (enabled: boolean | "indeterminate") => {
      const boolValue = Boolean(enabled);
      commitProperty(sceneManager, property, boolValue);
    },
    [sceneManager, property],
  );
}

/**
 * Creates a numeric input handler with validation
 */
export function useNumericInputHandlers<P extends keyof ExtendedProperties>(
  sceneManager: SceneManager,
  property: P,
  min: number = -Infinity,
  max: number = Infinity,
  map?: (value: number) => number,
) {
  return useCallback(
    (
      value:
        | string
        | (Variable<"number"> extends ExtendedProperties[P]
            ? Variable<"number"> | undefined
            : never),
    ) => {
      if (typeof value === "string") {
        let num = parseFloat(value);
        num = Number.isNaN(num) ? 0 : num;
        num = clamp(min, num, max);
        commitProperty(
          sceneManager,
          property,
          (map?.(num) ?? num) as ExtendedProperties[P],
        );
      } else {
        commitProperty(sceneManager, property, value as ExtendedProperties[P]);
      }
    },
    [min, max, property, map, sceneManager],
  );
}

/**
 * Creates a select/dropdown handler
 */
export function useSelectHandler<T extends Single<ExtendedProperty>>(
  sceneManager: SceneManager,
  property: T,
  transform?: (value: string) => ExtendedPropertyType<T>,
) {
  return useCallback(
    (value: string) => {
      if (value !== "Mixed") {
        const finalValue = transform ? transform(value) : value;
        commitProperty(
          sceneManager,
          property,
          finalValue as ExtendedPropertyType<T>,
        );
      }
    },
    [sceneManager, property, transform],
  );
}

/**
 * Creates handlers for button group selections (like alignment, text alignment, etc.)
 */
export function useButtonGroupHandler<T extends string>(
  sceneManager: SceneManager,
  property: ExtendedProperty,
) {
  return useCallback(
    (value: T) => {
      commitProperty(sceneManager, property, value);
    },
    [sceneManager, property],
  );
}

/**
 * Transform functions for common use cases
 */
export const transforms = {
  parseFloat: (value: string) => parseFloat(value),
  parseInt: (value: string) => parseInt(value, 10),
  boolean: (value: unknown) => Boolean(value),
  string: (value: unknown) => String(value),
  clamp: (min: number, max: number) => (value: string) => {
    const num = parseFloat(value);
    return Math.min(max, Math.max(min, Number.isNaN(num) ? min : num));
  },
} as const;

export function blockUpdate(
  manager: SceneManager,
  fn: (block: ObjectUpdateBlock, node: SceneNode) => void,
) {
  const block = manager.scenegraph.beginUpdate();

  for (const node of manager.selectionManager.selectedNodes) {
    fn(block, node);
  }

  manager.scenegraph.commitBlock(block, { undo: true });
}
