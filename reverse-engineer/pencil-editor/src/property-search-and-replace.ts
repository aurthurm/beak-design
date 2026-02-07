import { logger } from "@ha/shared";
import { FillType } from "./canvas/fill";
import type { ObjectUpdateBlock } from "./canvas/object-update-block";
import type { NodeProperties } from "./canvas/scene-graph";
import type { SceneNode } from "./canvas/scene-node";
import { canonicalizeHexColor, hexColorEquals } from "./skia";

export type UniqueProperties = {
  fillColor?: string[];
  textColor?: string[];
  strokeColor?: string[];
  strokeThickness?: (readonly [number, number, number, number])[];
  cornerRadius?: (readonly [number, number, number, number])[];
  padding?: (readonly [number, number, number, number])[];
  gap?: number[];
  fontSize?: number[];
  fontFamily?: string[];
  fontWeight?: string[];
};

export type UniquePropertyKeys = keyof UniqueProperties;

export type ReplacePropertyMap = {
  [K in keyof UniqueProperties]?: UniqueProperties[K] extends
    | (infer U)[]
    | undefined
    ? { from: U; to: U }[]
    : never;
};

function propertyEquals<T = string | number | Array<string | number>>(
  a: T,
  b: T,
) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!propertyEquals(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  return a === b;
}

function collectProperty<K extends keyof UniqueProperties>(
  result: UniqueProperties,
  key: K,
  value: NonNullable<UniqueProperties[K]>[number] | null | undefined,
) {
  if (value == null) {
    return;
  }

  if (result[key] == null) {
    (result as any)[key] = [value];
  } else {
    const list = result[key];

    for (const existing of list) {
      if (propertyEquals(value, existing)) {
        return;
      }
    }

    (list as any).push(value);
  }
}

function shouldReplacePropertyOnNode(
  node: SceneNode,
  property: keyof NodeProperties,
  nodesInvolved: Set<SceneNode>,
): boolean {
  return (
    !node.prototype ||
    !nodesInvolved.has(node.prototype.node) ||
    (node.prototype.overriddenProperties?.has(property) ?? false)
  );
}

function replaceFills<K extends keyof ReplacePropertyMap>(
  node: SceneNode,
  key: "fills" | "strokeFills",
  from: NonNullable<UniqueProperties[K]>[number],
  to: NonNullable<UniqueProperties[K]>[number],
  changes: Partial<NodeProperties>,
  nodesInvolved: Set<SceneNode>,
) {
  if (!shouldReplacePropertyOnNode(node, key, nodesInvolved)) {
    return;
  }

  const existing = node.properties.resolved[key];
  if (!existing) {
    return;
  }

  for (let i = 0; i < existing.length; i++) {
    const fill = existing[i];

    if (fill.type === FillType.Color) {
      if (
        from != null &&
        fill.color != null &&
        hexColorEquals(from as string, fill.color)
      ) {
        const cloned = [...(changes[key] ?? existing)];
        cloned[i] = { ...fill, color: to as string };

        changes[key] = cloned;
      }
    }
  }
}

function getFills(node: SceneNode, key: "fills" | "strokeFills") {
  const result = [];

  const existing = node.properties.resolved[key];
  if (existing) {
    for (const fill of existing) {
      if (fill.type === FillType.Color) {
        result.push(canonicalizeHexColor(fill.color));
      }
    }
  }

  return result;
}

export function getValuesForProperty<K extends keyof UniqueProperties>(
  node: SceneNode,
  property: K,
): (NonNullable<UniqueProperties[K]>[number] | null | undefined)[] {
  switch (property) {
    case "fillColor": {
      if (
        node.type === "frame" ||
        node.type === "rectangle" ||
        node.type === "path" ||
        node.type === "ellipse" ||
        node.type === "polygon" ||
        node.type === "icon_font" ||
        node.type === "line"
      ) {
        return getFills(node, "fills");
      }
      break;
    }

    case "textColor": {
      if (node.type === "text") {
        return getFills(node, "fills");
      }
      break;
    }

    case "strokeColor": {
      if (
        node.type === "frame" ||
        node.type === "rectangle" ||
        node.type === "path" ||
        node.type === "ellipse" ||
        node.type === "polygon" ||
        node.type === "line"
      ) {
        return getFills(node, "strokeFills");
      }
      break;
    }

    case "strokeThickness": {
      if (
        node.type === "frame" ||
        node.type === "rectangle" ||
        node.type === "path" ||
        node.type === "ellipse" ||
        node.type === "polygon" ||
        node.type === "line"
      ) {
        return [node.properties.resolved.strokeWidth];
      }
      break;
    }

    case "cornerRadius": {
      if (
        node.type === "frame" ||
        node.type === "rectangle" ||
        node.type === "polygon"
      ) {
        return [node.properties.resolved.cornerRadius ?? [0, 0, 0, 0]];
      }
      break;
    }

    case "padding": {
      if (node.type === "frame" || node.type === "group") {
        if (node.hasLayout()) {
          const padding: [number, number, number, number] = [0, 0, 0, 0];
          if (node.properties.resolved.layoutPadding != null) {
            if (typeof node.properties.resolved.layoutPadding === "number") {
              padding[0] = node.properties.resolved.layoutPadding;
              padding[1] = node.properties.resolved.layoutPadding;
              padding[2] = node.properties.resolved.layoutPadding;
              padding[3] = node.properties.resolved.layoutPadding;
            } else if (node.properties.resolved.layoutPadding.length === 2) {
              padding[0] = node.properties.resolved.layoutPadding[1];
              padding[1] = node.properties.resolved.layoutPadding[0];
              padding[2] = node.properties.resolved.layoutPadding[1];
              padding[3] = node.properties.resolved.layoutPadding[0];
            } else if (node.properties.resolved.layoutPadding.length === 4) {
              padding[0] = node.properties.resolved.layoutPadding[0];
              padding[1] = node.properties.resolved.layoutPadding[1];
              padding[2] = node.properties.resolved.layoutPadding[2];
              padding[3] = node.properties.resolved.layoutPadding[3];
            }
          }

          return [padding];
        }
      }
      break;
    }

    case "gap": {
      if (node.type === "frame" || node.type === "group") {
        if (node.hasLayout()) {
          return [node.properties.resolved.layoutChildSpacing];
        }
      }
      break;
    }

    case "fontFamily": {
      if (node.type === "text") {
        return [node.properties.resolved.fontFamily];
      }
      break;
    }

    case "fontSize": {
      if (node.type === "text") {
        return [node.properties.resolved.fontSize];
      }
      break;
    }

    case "fontWeight": {
      if (node.type === "text") {
        return [node.properties.resolved.fontWeight];
      }
      break;
    }

    default: {
      const missing: never = property;
      logger.error(`Unknown property during search: "${missing}"`);
      break;
    }
  }

  return [];
}

export function replaceMatchingProperty<K extends keyof ReplacePropertyMap>(
  node: SceneNode,
  property: K,
  from: NonNullable<UniqueProperties[K]>[number],
  to: NonNullable<UniqueProperties[K]>[number],
  changes: Partial<NodeProperties>,
  nodesInvolved: Set<SceneNode>,
) {
  switch (property) {
    case "fillColor": {
      if (
        node.type === "frame" ||
        node.type === "rectangle" ||
        node.type === "path" ||
        node.type === "ellipse" ||
        node.type === "polygon" ||
        node.type === "icon_font" ||
        node.type === "line"
      ) {
        replaceFills(node, "fills", from, to, changes, nodesInvolved);
      }
      break;
    }

    case "textColor": {
      if (node.type === "text") {
        replaceFills(node, "fills", from, to, changes, nodesInvolved);
      }
      break;
    }

    case "strokeColor": {
      if (
        node.type === "frame" ||
        node.type === "rectangle" ||
        node.type === "path" ||
        node.type === "ellipse" ||
        node.type === "polygon" ||
        node.type === "line"
      ) {
        replaceFills(node, "strokeFills", from, to, changes, nodesInvolved);
      }
      break;
    }

    case "strokeThickness": {
      if (!shouldReplacePropertyOnNode(node, "strokeWidth", nodesInvolved)) {
        break;
      }
      const value = to as NonNullable<
        UniqueProperties["strokeThickness"]
      >[number];

      const stored = getValuesForProperty(node, property)?.[0];
      if (propertyEquals(from, stored)) {
        changes.strokeWidth = value;
      }
      break;
    }

    case "cornerRadius": {
      if (!shouldReplacePropertyOnNode(node, "cornerRadius", nodesInvolved)) {
        break;
      }
      const value = to as NonNullable<UniqueProperties["cornerRadius"]>[number];

      const stored = getValuesForProperty(node, property)?.[0];
      if (propertyEquals(from, stored)) {
        changes.cornerRadius = value;
      }
      break;
    }

    case "padding": {
      if (!shouldReplacePropertyOnNode(node, "layoutPadding", nodesInvolved)) {
        break;
      }
      const value = to as NonNullable<UniqueProperties["padding"]>[number];

      if (node.hasLayout()) {
        const stored = getValuesForProperty(node, property)?.[0];
        if (propertyEquals(from, stored)) {
          changes.layoutPadding = value as [number, number, number, number];
        }
      }
      break;
    }

    case "gap": {
      if (
        !shouldReplacePropertyOnNode(node, "layoutChildSpacing", nodesInvolved)
      ) {
        break;
      }
      const value = to as NonNullable<UniqueProperties["gap"]>[number];

      if (node.hasLayout()) {
        const stored = getValuesForProperty(node, property)?.[0];
        if (propertyEquals(from, stored)) {
          changes.layoutChildSpacing = value;
        }
      }
      break;
    }

    case "fontFamily": {
      if (!shouldReplacePropertyOnNode(node, "fontFamily", nodesInvolved)) {
        break;
      }
      const value = to as NonNullable<UniqueProperties["fontFamily"]>[number];

      if (node.type === "text") {
        const stored = getValuesForProperty(node, property)?.[0];
        if (propertyEquals(from, stored)) {
          changes.fontFamily = value;
        }
      }
      break;
    }

    case "fontSize": {
      if (!shouldReplacePropertyOnNode(node, "fontSize", nodesInvolved)) {
        break;
      }
      const value = to as NonNullable<UniqueProperties["fontSize"]>[number];

      if (node.type === "text") {
        const stored = getValuesForProperty(node, property)?.[0];
        if (propertyEquals(from, stored)) {
          changes.fontSize = value;
        }
      }
      break;
    }

    case "fontWeight": {
      if (!shouldReplacePropertyOnNode(node, "fontWeight", nodesInvolved)) {
        break;
      }
      const value = to as NonNullable<UniqueProperties["fontWeight"]>[number];

      if (node.type === "text") {
        const stored = getValuesForProperty(node, property)?.[0];
        if (propertyEquals(from, stored)) {
          changes.fontWeight = value;
        }
      }
      break;
    }

    default: {
      const missing: never = property;
      logger.error(`Unknown property during replacement: ${missing}`);
      break;
    }
  }
}

export function searchUniqueProperties(
  result: UniqueProperties,
  node: SceneNode,
  propertiesToFind: (keyof UniqueProperties)[],
) {
  for (const property of propertiesToFind) {
    for (const stored of getValuesForProperty(node, property)) {
      collectProperty(result, property, stored);
    }
  }

  for (const child of node.children) {
    searchUniqueProperties(result, child, propertiesToFind);
  }
}

function collectAllChanges(
  node: SceneNode,
  map: ReplacePropertyMap,
  changes: Map<SceneNode, Partial<NodeProperties>>,
  nodesInvolved: Set<SceneNode>,
) {
  const modifiedProperties = {};

  for (const [key, replace] of Object.entries(map)) {
    const property = key as UniquePropertyKeys;

    for (const item of replace) {
      replaceMatchingProperty(
        node,
        property,
        item.from,
        item.to,
        modifiedProperties,
        nodesInvolved,
      );
    }
  }

  if (Object.keys(modifiedProperties).length > 0) {
    const existing = changes.get(node);
    if (existing) {
      Object.assign(existing, modifiedProperties);
    } else {
      changes.set(node, modifiedProperties);
    }
  }

  for (const child of node.children) {
    collectAllChanges(child, map, changes, nodesInvolved);
  }
}

export function replaceProperties(
  block: ObjectUpdateBlock,
  roots: SceneNode[],
  map: ReplacePropertyMap,
) {
  const nodesInvolved = new Set<SceneNode>();
  const collectNodesInvolved = (node: SceneNode) => {
    nodesInvolved.add(node);
    node.children.forEach(collectNodesInvolved);
  };
  roots.forEach(collectNodesInvolved);

  const changes = new Map<SceneNode, Partial<NodeProperties>>();

  for (const node of roots) {
    collectAllChanges(node, map, changes, nodesInvolved);
  }

  for (const [node, properties] of changes) {
    block.update<any>(node, properties);
  }
}
