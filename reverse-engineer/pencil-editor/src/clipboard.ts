import type { SceneNode } from "./canvas/scene-node";
import type { Variable } from "./managers/variable-manager";
import type { FileManager } from "./managers/file-manager";
import type { VariableManager } from "./managers/variable-manager";
import type { ObjectUpdateBlock } from "./canvas/object-update-block";
import { serializeThemes, serializeVariables } from "./canvas/serializer";
import { deserializeVariableValues } from "./managers/file-manager";
import { deepEqual } from "fast-equals";
import { firstAvailableName, trimNameSuffix } from "./util";
import type * as Schema from "@ha/schema";
import { SceneGraph } from "./canvas";

export type ClipboardData = {
  source: string;
  localData: string[];
  remoteData: {
    themes: Schema.Document["themes"];
    variables: Schema.Document["variables"];
    nodes: Schema.Document["children"][0][];
  };
};

export function createClipboardDataFromNodes(
  nodes: Iterable<SceneNode>,
  fileManager: FileManager,
  variableManager: VariableManager,
  clipboardSourceId: string,
): ClipboardData {
  const nodesArray = Array.from(nodes);

  const variables = new Set<Variable<any>>();
  const collectVariables = (node: SceneNode) => {
    node.properties.getUsedVariables(variables);
    node.children.forEach(collectVariables);
  };
  nodesArray.forEach(collectVariables);

  const themeAxes = new Set<string>();
  for (const variable of variables) {
    for (const value of variable.values) {
      for (const themeAxis of value.theme?.keys() ?? []) {
        themeAxes.add(themeAxis);
      }
    }
  }

  const themes = new Map(
    themeAxes
      .values()
      .map((themeAxis) => [themeAxis, variableManager.themes.get(themeAxis)!]),
  );

  return {
    source: clipboardSourceId,
    localData: nodesArray.map((node) => node.path),
    remoteData: {
      themes: serializeThemes(themes),
      variables: serializeVariables([...variables]),
      nodes: nodesArray.map((node) =>
        fileManager.serializeNode(node, {
          resolveInstances: true,
        }),
      ),
    },
  };
}

export function validateClipboardData(data: unknown): data is ClipboardData {
  if (!data || typeof data !== "object") {
    return false;
  }

  const candidate = data as any;

  return (
    typeof candidate.source === "string" &&
    Array.isArray(candidate.localData) &&
    candidate.remoteData &&
    typeof candidate.remoteData === "object" &&
    Array.isArray(candidate.remoteData.nodes)
  );
}

export function pasteClipboardData(
  clipboardData: ClipboardData,
  sceneGraph: SceneGraph,
  variableManager: VariableManager,
  targetParent: SceneNode,
  updateBlock: ObjectUpdateBlock,
  clipboardSourceId: string,
): SceneNode[] {
  const createdNodes: SceneNode[] = [];
  const localData = clipboardData.localData;

  if (
    clipboardData.source === clipboardSourceId &&
    localData &&
    localData.length > 0 &&
    !localData.find((path) => !sceneGraph.getNodeByPath(path))
  ) {
    const root = sceneGraph.getViewportNode();
    for (const path of localData) {
      const node = root.getNodeByPath(path);
      if (!node) {
        console.error(`Pasted local node doesn't exist: ${path}`);
        continue;
      }
      const createdNode = node.createInstancesFromSubtree();
      createdNode.id = SceneGraph.createUniqueID();
      createdNode.ensurePrototypeReusability(updateBlock.rollback);
      updateBlock.addNode(createdNode, targetParent);
      createdNodes.push(createdNode);
    }
  } else {
    const themes = new Map(
      variableManager.themes
        .entries()
        .map(([axis, values]) => [axis, [...values]]),
    );
    const themeMapping = new Map<string, string>();
    for (const [axis, values] of Object.entries(
      clipboardData.remoteData.themes ?? {},
    )) {
      const existing = themes.get(axis);
      if (!existing) {
        themes.set(axis, values);
      } else if (!deepEqual(existing, values)) {
        const newName = firstAvailableName(trimNameSuffix(axis), (name) =>
          themes.has(name),
        );
        themeMapping.set(axis, newName);
        themes.set(newName, values);
      }
    }
    updateBlock.setThemes(themes);

    const variableMapping = new Map<string, string>();
    for (const [variableName, variableData] of Object.entries(
      clipboardData.remoteData.variables ?? {},
    )) {
      const existing = variableManager.variables.get(variableName);
      let newName;
      if (!existing) {
        newName = variableName;
      } else if (existing.type !== variableData.type) {
        newName = firstAvailableName(trimNameSuffix(variableName), (name) =>
          variableManager.variables.has(name),
        );
        variableMapping.set(variableName, newName);
      } else {
        continue;
      }
      const variable = updateBlock.addVariable(newName, variableData.type);
      updateBlock.setVariable(
        variable,
        deserializeVariableValues(
          variable.type,
          variableData.value,
          ([themeAxis, themeValues]) => [
            themeMapping.get(themeAxis) ?? themeAxis,
            themeValues,
          ],
        ),
      );
    }

    for (const nodeData of clipboardData.remoteData.nodes) {
      const node = sceneGraph.deserializePastedNode(
        (name, type) =>
          variableManager.getVariable(variableMapping.get(name) ?? name, type),
        ([themeAxis, themeValues]) => [
          themeMapping.get(themeAxis) ?? themeAxis,
          themeValues,
        ],
        updateBlock,
        nodeData,
        targetParent,
      );
      if (node) {
        createdNodes.push(node);
      }
    }
  }

  return createdNodes;
}
