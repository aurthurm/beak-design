import type * as Schema from "@ha/schema";
// import schema from "@ha/schema/pen.schema.json";
import { logger } from "@ha/shared";
// import Ajv, { type JSONSchemaType } from "ajv/dist/2020";
import path from "path-browserify";
import { toast } from "sonner";
import stripJsonComments from "strip-json-comments";
import { type FrameNode, SceneGraph } from "../canvas";
import { type Effect, EffectType } from "../canvas/effect";
import {
  type ColorStop,
  type Fill,
  FillType,
  type MeshGradientPoint,
  StretchMode,
} from "../canvas/fill";
import {
  AlignItems,
  JustifyContent,
  LayoutMode,
  SizingBehavior,
} from "../canvas/layout";
import type { ObjectUpdateBlock } from "../canvas/object-update-block";
import {
  type NodeProperties,
  type NodeType,
  StrokeAlignment,
} from "../canvas/scene-graph";
import type { SceneNode } from "../canvas/scene-node";
import {
  serializeAlignItems,
  serializeCornerRadius,
  serializeEffects,
  serializeFill,
  serializeJustifyContent,
  serializeLayoutMode,
  serializeOptionalValue,
  serializePadding,
  serializeRotation,
  serializeSingleAxisSize,
  serializeStroke,
  serializeThemes,
  serializeValue,
  serializeVariables,
} from "../canvas/serializer";
import { convertLegacySchema } from "../converters/legacy-schema-converter";
import { reportError } from "../error-reporter";
import { isHeadlessMode } from "../platform";
import type { Connection } from "../types/connections";
import { degToRad } from "../utils/math";
import type { SceneManager } from "./scene-manager";
import type {
  Single,
  ThemedValue,
  Value,
  Variable,
  VariableRuntimeType,
  VariableType,
  VariableValueType,
} from "./variable-manager";

// const ajv = new Ajv();
// const validateSchema = ajv.compile(
//   schema as unknown as JSONSchemaType<Schema.Document>,
// );

const currentSchemaVersion = "2.6";

const EMPTY_DOCUMENT: Readonly<Schema.Document> = {
  version: currentSchemaVersion,
  children: [],
};

// TODO(sedivy): Remove SerializedNode. Use the proper schema serialization.
export interface SerializedNode {
  id: string;
  type: NodeType;
  reusable: boolean;
  properties: NodeProperties;
  children: SerializedNode[];
}

// TODO(sedivy): Remove DesignFile
export interface DesignFile {
  version: string;
  children?: SerializedNode[];
  connections?: Connection[];
}

export class FileManager {
  private manager: SceneManager;

  constructor(manager: SceneManager) {
    this.manager = manager;

    if (!isHeadlessMode) {
      (window as any).__FILE_MANAGER = this;
    }
  }

  public open(
    fileContent: string | { version: string; [key: string]: any },
    filePath: string | null,
    zoomToFit = false,
  ): boolean {
    this.manager.scenegraph.isOpeningDocument = true;

    this.manager.undoManager.clear();
    this.manager.variableManager.clear();

    // NOTE(sedivy): Technically we don't need a block api here, but the inner functions
    // require it so that's why we call beginUpdate()
    const block = this.manager.scenegraph.beginUpdate();

    try {
      let input: unknown;
      if (typeof fileContent === "string") {
        input =
          fileContent === ""
            ? structuredClone(EMPTY_DOCUMENT)
            : JSON.parse(stripJsonComments(fileContent));
      } else {
        input = fileContent;
      }

      let parsedData = input as Schema.Document;

      // Resolve relative font URLs
      const dirPath = filePath && path.dirname(filePath);
      const fonts: { name: string; url: string }[] = [];
      for (const { name, url } of parsedData.fonts ?? []) {
        if (
          url.startsWith("http://") ||
          url.startsWith("https://") ||
          url.startsWith("file://")
        ) {
          fonts.push({ name, url });
        } else if (dirPath) {
          fonts.push({ name, url: `file://${path.join(dirPath, url)}` });
        }
      }

      // NOTE(sedivy): Convert legacy documents into the new schema
      if (parsedData.version !== currentSchemaVersion) {
        parsedData = convertLegacySchema(parsedData);
      }

      if (parsedData.version !== currentSchemaVersion) {
        logger.error(`Unsupported file format: ${parsedData.version}`);
        return false;
      }

      // TODO(sedivy): Temporary disable schema validation because it takes over 6 seconds on our large test document.
      // const valid = validateSchema(parsedData);
      // if (!valid) {
      //   logger.error(
      //     `Invalid file. Error: ${JSON.stringify(validateSchema.errors)}`,
      //   );
      //   return false;
      // }

      this.manager.scenegraph.destroy();
      this.manager.scenegraph.setFilePath(filePath);

      if (parsedData.themes) {
        this.manager.variableManager.unsafeSetThemes(
          new Map(Object.entries(parsedData.themes)),
          null,
        );
      }

      this.manager.scenegraph.getViewportNode().properties.theme =
        this.manager.variableManager.getDefaultTheme();

      if (parsedData.variables) {
        const readVariable = <T extends Single<VariableType>>(
          variable: Variable<T>,
          value:
            | VariableValueType<T>
            | { value: VariableValueType<T>; theme?: Schema.Theme }[],
        ) => {
          if (Array.isArray(value)) {
            variable.unsafeSetValues(
              value.map(({ value, theme }) => ({
                value,
                theme:
                  theme !== undefined
                    ? new Map(Object.entries(theme))
                    : undefined,
              })),
              null,
            );
          } else {
            variable.unsafeSetValues([{ value }], null);
          }
        };
        for (const [name, { type, value }] of Object.entries(
          parsedData.variables,
        )) {
          readVariable(
            this.manager.variableManager.unsafeAddVariable(name, type, null),
            value,
          );
        }
      }

      if (parsedData.children) {
        // NOTE(zaza): fix files that were saved with duplicate node IDs due to https://github.com/highagency/ha/pull/436
        const fixDuplicateNodeIDs = (
          node: Partial<Schema.Document["children"][0]>,
        ) => {
          if ("children" in node) {
            const children = node.children as (typeof node)[];
            if (
              children.length !== 0 &&
              children[0].type === "ref" &&
              children[0].id === children[0].ref
            ) {
              delete node.children;
            } else {
              children.forEach(fixDuplicateNodeIDs);
            }
          }
          if (node.type === "ref" && node.descendants) {
            Object.values(node.descendants).forEach(fixDuplicateNodeIDs);
          }
        };
        parsedData.children.forEach(fixDuplicateNodeIDs);

        this.insertNodes(
          block,
          undefined,
          undefined,
          parsedData.children,
          false,
        );
      }

      this.manager.scenegraph.invalidateLayout(
        this.manager.scenegraph.getViewportNode(),
      );
      this.manager.scenegraph.updateLayout();

      this.manager.connectionManager.redrawAllConnections();

      // Zoom to fit all content when intentionally loading a file
      if (zoomToFit) {
        const bounds = this.manager.scenegraph.getDocumentBoundingBox();
        if (bounds) {
          this.manager.camera.zoomToBounds(bounds, 40);
          if (this.manager.camera.zoom > 1) {
            this.manager.camera.setZoom(1, true);
          }
        }
      }

      logger.debug("Scene loaded successfully.");
      return true;
    } catch (error: any) {
      reportError(error);
      logger.error("Error loading scene graph:", error.toString());

      // TODO(sedivy): Add a way better way to handle and notify the user about a corrupted file.
      toast.error("Failed to open the file.");

      return false;
    } finally {
      this.manager.scenegraph.commitBlock(block, { undo: false });
      this.manager.scenegraph.invalidateLayout(
        this.manager.scenegraph.getViewportNode(),
      );
      this.manager.scenegraph.isOpeningDocument = false;
      this.manager.requestFrame();
    }
  }

  public export(): string {
    const document = this.serialize();
    return JSON.stringify(document, null, 2);
  }

  serializeNode(
    node: SceneNode,
    options?: {
      maxDepth?: number;
      resolveInstances?: boolean;
      resolveVariables?: boolean;
      includePathGeometry?: boolean;
    },
  ): Schema.Child {
    const maxDepth = options?.maxDepth;
    const resolveInstances = options?.resolveInstances ?? false;
    const resolveVariables = options?.resolveVariables ?? false;
    const includePathGeometry = options?.includePathGeometry ?? true;

    if (!resolveInstances && node.prototype) {
      const checkStructure = (instance: SceneNode): boolean => {
        if (instance.prototype!.childrenOverridden) {
          return true;
        } else if (
          instance.children.length !== instance.prototype!.node.children.length
        ) {
          return false;
        }
        for (let i = 0; i < instance.children.length; i++) {
          const child = instance.children[i];
          if (child.isUnique) {
            continue;
          }
          if (
            child.prototype!.node !== instance.prototype!.node.children[i] ||
            !checkStructure(child)
          ) {
            return false;
          }
        }
        return true;
      };
      if (!checkStructure(node)) {
        // NOTE(zaza): if this happens, it's a bug in the editor logic.
        logger.error(
          `Instance ${node.path} has different structure than its prototype ${node.prototype.node.path}, which is not allowed.`,
        );
      }

      return this.collectOverrides<Schema.Ref>(
        node,
        {
          id: node.id,
          type: "ref",
          reusable: node.reusable ? true : undefined,
          ref: node.prototype.node.path,
        },
        options,
      );
    } else {
      const result = node.serialize({
        resolveVariables: resolveVariables,
        includePathGeometry: includePathGeometry,
      });

      if (
        (result.type === "frame" || result.type === "group") &&
        node.children.length !== 0
      ) {
        if (maxDepth === undefined || maxDepth > 0) {
          result.children = node.children.map((child) =>
            this.serializeNode(child, {
              ...options,
              maxDepth: maxDepth && maxDepth - 1,
            }),
          );
        } else {
          // NOTE(zaza): this is only used for MCP results, so we don't care about not conforming to the schema 100%.
          (result as any).children = "...";
        }
      }

      return result;
    }
  }

  serialize(): Schema.Document {
    const root = this.manager.scenegraph.getViewportNode();

    const children: Schema.Document["children"] = [];

    for (const child of root.children) {
      children.push(this.serializeNode(child));
    }

    const connections = this.manager.connectionManager.getConnections();
    for (const connection of connections) {
      children.push({
        id: connection.id,
        type: "connection",
        x: 0,
        y: 0,
        source: {
          path: connection.sourceNodeId,
          anchor: (connection.sourceAnchor ??
            "center") as Schema.ConnectionAnchor,
        },
        target: {
          path: connection.targetNodeId,
          anchor: (connection.targetAnchor ??
            "center") as Schema.ConnectionAnchor,
        },
      });
    }

    const document: Schema.Document = {
      version: currentSchemaVersion,
      children: children,
      themes: serializeThemes(this.manager.variableManager.themes),
      variables: serializeVariables([
        ...this.manager.variableManager.variables.values(),
      ]),
      // TODO(sedivy): Serialize fonts as well.
    };

    // TODO(sedivy): Temporary disable schema validation because it takes over 6 seconds on our large test document.
    // const valid = validateSchema(document);
    // if (!valid) {
    //   logger.error(
    //     "Serialize returned an invalid schema",
    //     validateSchema.errors,
    //   );
    // }

    return document;
  }

  insertNodes(
    block: ObjectUpdateBlock,
    parentId: string | undefined,
    index: number | undefined,
    nodes: Schema.Document["children"],
    flash: boolean,
  ): SceneNode[] {
    parentId = parentId
      ? (this.manager.scenegraph.canonicalizePath(parentId) ?? parentId)
      : parentId;

    const parent = parentId
      ? this.manager.scenegraph.getNodeByPath(parentId)
      : this.manager.scenegraph.getViewportNode();
    if (!parent) {
      throw new Error(`Can't find parent node with id '${parentId}'!`);
    } else if (
      parent.prototype &&
      parent.children.length !== 0 &&
      !parent.prototype.childrenOverridden
    ) {
      throw new Error(
        `To modify '${parentId}' (a component instance descendant), use U("${parentId}", {...}) to update properties, or R("${parentId}", {...}) to replace it.`,
      );
    } else if (index && (index < 0 || index > parent.children.length)) {
      throw new Error(
        `Invalid insertion index ${index}, parent node '${parentId}' has ${parent.children.length} children!`,
      );
    }

    if (parent.prototype && !parent.prototype.childrenOverridden) {
      parent.setChildrenOverridden(block.rollback, true);
    }

    const dataIndex: ReturnType<typeof indexData> = new Map();
    for (const node of nodes) {
      indexData(node, dataIndex);
    }
    for (const id of dataIndex.keys()) {
      if (this.manager.scenegraph.getNodeByPath(id)) {
        throw new Error(`Another node with id '${id}' already exists!`);
      }
    }

    const instancesToRebuild = collectInstancesToRebuild(parent);

    const createdNodes = new Map<string, SceneNode>();
    try {
      const cloneSubtree = (
        node: SceneNode,
        ref: Schema.Ref,
        refPath?: string,
      ): SceneNode => {
        if (node === instancesToRebuild.get(node.id)) {
          createNodes(node.id);
          node = createdNodes.get(node.id)!;
        }

        const overrides = refPath ? ref.descendants?.[refPath] : ref;
        if (refPath && overrides && isStructuralOverride(overrides)) {
          createNodes(overrides.id);
          return createdNodes.get(overrides.id)!;
        }
        const childrenOverrides = overrides && getChildrenOverrides(overrides);
        const id = refPath ? lastPathComponent(refPath) : ref.id;
        const clonedNode = SceneGraph.createNode(
          id,
          node.type,
          node.properties,
        );
        createdNodes.set(refPath ? `${ref.id}/${refPath}` : ref.id, clonedNode);
        clonedNode.attachToPrototype(
          block.rollback,
          node,
          undefined,
          Boolean(childrenOverrides),
        );
        if (!refPath) {
          clonedNode.setReusable(block.rollback, ref.reusable ?? false);
        }
        applyOverrides(block, clonedNode, overrides ?? {}, (name, type) =>
          this.manager.variableManager.getVariable(name, type),
        );

        if (childrenOverrides) {
          for (const child of childrenOverrides) {
            createNodes(child.id);
            const childNode = createdNodes.get(child.id);
            if (!childNode) {
              logger.error(
                `Node of '${id}' has missing child with id ${child.id}!`,
              );
              continue;
            }
            clonedNode.addChild(childNode);
          }
        } else {
          for (const child of node === parent
            ? node.children.toSpliced(
                index ?? node.children.length,
                0,
                ...nodes.map((node) => {
                  createNodes(node.id);
                  return createdNodes.get(node.id)!;
                }),
              )
            : node.children) {
            clonedNode.addChild(
              cloneSubtree(
                child,
                ref,
                refPath && !child.isUnique
                  ? clonedNode.isInstanceBoundary
                    ? `${refPath}/${child.id}`
                    : replaceLastPathComponent(refPath, child.id)
                  : child.id,
              ),
            );
          }
        }
        return clonedNode;
      };

      const creatingNodes = new Set<string>();
      const createNodes = (id: string) => {
        if (creatingNodes.has(id)) {
          throw new Error(
            `There's a cycle in the reference graph with node '${id}'!`,
          );
        } else if (createdNodes.has(id)) {
          return;
        }

        creatingNodes.add(id);
        try {
          let refData: Schema.Ref | undefined;

          const data = dataIndex.get(id);
          if (data) {
            if (data.type === "connection") {
              return;
            } else if (data.type === "ref") {
              refData = data;
            } else {
              const properties = deserializeToProperties(data, (name, type) =>
                this.manager.variableManager.getVariable(name, type),
              );
              if (!properties) {
                throw new Error(`Invalid data for node with id '${data.id}'!`);
              }
              const node = SceneGraph.createNode(
                data.id,
                properties.type,
                properties.properties,
              );
              node.setReusable(block.rollback, data.reusable ?? false);
              createdNodes.set(data.id, node);

              if (data.type === "frame" && data.slot) {
                (node as FrameNode).setSlot(block.rollback, data.slot);
              }

              if (
                (data.type === "frame" || data.type === "group") &&
                data.children
              ) {
                for (const child of data.children) {
                  createNodes(child.id);
                  const childNode = createdNodes.get(child.id);
                  if (!childNode) {
                    throw new Error(
                      `Node of '${id}' has missing child with id ${child.id}!`,
                    );
                  }
                  node.addChild(childNode);
                }
              }
              return;
            }
          } else {
            const instanceToRebuild = instancesToRebuild.get(id);
            if (instanceToRebuild) {
              if (!instanceToRebuild.prototype) {
                // If this happens, it's a bug.
                throw new Error(`Instance ${id} has no prototype!`);
              }
              refData = this.collectOverrides<
                Exclude<typeof refData, undefined>
              >(instanceToRebuild, {
                id,
                type: "ref",
                ref: instanceToRebuild.prototype.node.path,
                reusable: instanceToRebuild.reusable,
              });
              indexData(refData, dataIndex);
            } else {
              // Node already exists, and is unaffected by the replace operation.
              return;
            }
          }

          createNodes(firstPathComponent(refData.ref));
          const nodeToClone = (createdNodes.get(refData.ref) ??
            this.manager.scenegraph.getNodeByPath(refData.ref))!;
          canonicalizeDescendantPaths(refData, nodeToClone);
          const clonedNode = cloneSubtree(nodeToClone, refData);
          clonedNode.ensurePrototypeReusability(null);
        } finally {
          creatingNodes.delete(id);
        }
      };
      for (const id of [
        ...nodes.map((n) => n.id),
        ...instancesToRebuild.keys(),
      ]) {
        createNodes(id);
      }
      for (let i = 0; i < nodes.length; i++) {
        const createdNode = createdNodes.get(nodes[i].id)!;
        parent.addChild(createdNode);
        if (index) {
          parent.setChildIndex(createdNode, index + i);
        }
      }
      for (const nodeToReplace of instancesToRebuild.values()) {
        replaceNode(block, nodeToReplace, createdNodes.get(nodeToReplace.id)!);
      }

      // TODO(zaza): this is technically unsound, because we shouldn't insert nodes with identical IDs
      // into the scene graph before the old nodes are removed. But currently node removal triggers
      // layout checks, which will cause error when trying to measure the yet-to-be-attached text nodes.
      // The insertion/removal can be swapped when layout is changed to run in a deferred fashion.
      this.insertIntoSceneGraph(block, createdNodes.values());
      for (const node of instancesToRebuild.values()) {
        this.removeRecursivelyFromSceneGraph(block, node);
      }

      this.manager.scenegraph.updateLayout();
      if (flash) {
        for (const [_, node] of createdNodes) {
          this.manager.skiaRenderer.addFlashForNode(node, { strokeWidth: 1 });
        }
      }

      for (const node of nodes) {
        if (node.type === "connection") {
          this.manager.connectionManager.addConnection({
            id: node.id,
            sourceNodeId: node.source.path,
            sourceAnchor: node.source.anchor,
            targetNodeId: node.target.path,

            targetAnchor: node.target.anchor,
          });
        }
      }

      return Array.from(createdNodes.values());
    } catch (error) {
      for (const node of createdNodes.values()) {
        block.deleteNode(node, false);
      }
      throw error;
    }
  }

  moveNodes(
    block: ObjectUpdateBlock,
    nodes: {
      node: SceneNode;
      parentId?: string | null;
      index?: number;
    }[],
  ) {
    for (let { node, parentId, index } of nodes) {
      parentId = parentId
        ? (this.manager.scenegraph.canonicalizePath(parentId) ?? parentId)
        : parentId;

      const parent =
        parentId !== undefined
          ? parentId === null
            ? this.manager.scenegraph.getViewportNode()
            : this.manager.scenegraph.getNodeByPath(parentId)
          : node.parent!;

      if (!parent) {
        throw new Error(`No such parent node with id ${parentId}'!`);
      } else if (
        parent.prototype &&
        parent.children.length !== 0 &&
        !parent.prototype.childrenOverridden
      ) {
        throw new Error(
          `Can't move '${node.id}' under '${parent.id}' because it's an instance of '${parent.prototype.node.id}'!`,
        );
      } else if (parent.type !== "frame" && parent.type !== "group") {
        throw new Error(
          `Can't move '${node.id}' under '${parent.id}' because '${parent.type}' nodes cannot have children!`,
        );
      }

      if (parent.prototype && !parent.prototype.childrenOverridden) {
        parent.setChildrenOverridden(block.rollback, true);
      }

      block.changeParent(node, parent, index);
    }
  }

  replaceNode(
    block: ObjectUpdateBlock,
    replacedNode: SceneNode,
    node: Schema.Child,
  ): SceneNode {
    this.manager.skiaRenderer.addFlashForNode(replacedNode);

    const replacedNodes = new Map<string, SceneNode>();
    const collectReplacedNodes = (node: SceneNode) => {
      replacedNodes.set(node.path, node);
      node.children.forEach(collectReplacedNodes);
    };
    collectReplacedNodes(replacedNode);

    const dataIndex = indexData(node);
    for (const id of dataIndex.keys()) {
      if (!replacedNodes.has(id) && this.manager.scenegraph.getNodeByPath(id)) {
        throw new Error(`Another node with id '${id}' already exists!`);
      }
    }

    for (const replacedNode of replacedNodes.values()) {
      if (!(dataIndex.get(replacedNode.id)?.reusable ?? false)) {
        // NOTE(zaza): this will trigger ensurePrototypeReusability() on replacedNode's instances.
        replacedNode.setReusable(block.rollback, false);
      }
    }

    const instancesToRebuild = new Map<string, SceneNode>();
    {
      const visitedNodes = new Set<SceneNode>();
      for (const replacedNode of replacedNodes.values()) {
        collectInstancesToRebuild(
          replacedNode,
          visitedNodes,
          instancesToRebuild,
        );
      }
    }

    const createdNodes = new Map<string, SceneNode>();
    try {
      const cloneSubtree = (
        node: SceneNode,
        ref: Schema.Ref,
        refPath?: string,
      ): SceneNode => {
        if (node === instancesToRebuild.get(node.id)) {
          createNodes(node.id);
          node = createdNodes.get(node.id)!;
        }

        const overrides = refPath ? ref.descendants?.[refPath] : ref;
        if (refPath && overrides && isStructuralOverride(overrides)) {
          createNodes(overrides.id);
          return createdNodes.get(overrides.id)!;
        }
        const childrenOverrides = overrides && getChildrenOverrides(overrides);
        const id = refPath ? lastPathComponent(refPath) : ref.id;
        const clonedNode = SceneGraph.createNode(
          id,
          node.type,
          node.properties,
        );
        createdNodes.set(refPath ? `${ref.id}/${refPath}` : ref.id, clonedNode);
        clonedNode.attachToPrototype(
          block.rollback,
          node,
          undefined,
          Boolean(childrenOverrides),
        );
        if (!refPath) {
          clonedNode.setReusable(block.rollback, ref.reusable ?? false);
        }
        applyOverrides(block, clonedNode, overrides ?? {}, (name, type) =>
          this.manager.variableManager.getVariable(name, type),
        );

        if (childrenOverrides) {
          for (const child of childrenOverrides) {
            createNodes(child.id);
            const childNode = createdNodes.get(child.id);
            if (!childNode) {
              logger.error(
                `Node of '${id}' has missing child with id ${child.id}!`,
              );
              continue;
            }
            clonedNode.addChild(childNode);
          }
        } else {
          for (const child of node.children) {
            clonedNode.addChild(
              cloneSubtree(
                child,
                ref,
                refPath && !child.isUnique
                  ? clonedNode.isInstanceBoundary
                    ? `${refPath}/${child.id}`
                    : replaceLastPathComponent(refPath, child.id)
                  : child.id,
              ),
            );
          }
        }
        return clonedNode;
      };
      const creatingNodes = new Set<string>();
      const createNodes = (id: string) => {
        if (creatingNodes.has(id)) {
          throw new Error(
            `There's a cycle in the reference graph with node '${id}'!`,
          );
        } else if (createdNodes.has(id)) {
          return;
        }

        creatingNodes.add(id);
        try {
          let refData:
            | { data: Schema.Ref; allowFailingOverrides: boolean }
            | undefined;

          const data = dataIndex.get(id);
          if (data) {
            if (data.type === "connection") {
              return;
            } else if (data.type === "ref") {
              refData = { data, allowFailingOverrides: false };
            } else {
              const properties = deserializeToProperties(data, (name, type) =>
                this.manager.variableManager.getVariable(name, type),
              );
              if (!properties) {
                throw new Error(`Invalid data for node with id '${data.id}'!`);
              }
              const node = SceneGraph.createNode(
                data.id,
                properties.type,
                properties.properties,
              );
              node.setReusable(block.rollback, data.reusable ?? false);
              createdNodes.set(data.id, node);

              if (data.type === "frame" && data.slot) {
                (node as FrameNode).setSlot(block.rollback, data.slot);
              }

              if (
                (data.type === "frame" || data.type === "group") &&
                data.children
              ) {
                for (const child of data.children) {
                  createNodes(child.id);
                  const childNode = createdNodes.get(child.id);
                  if (!childNode) {
                    throw new Error(
                      `Node of '${id}' has missing child with id ${child.id}!`,
                    );
                  }
                  node.addChild(childNode);
                }
              }
              return;
            }
          } else {
            const instanceToRebuild = instancesToRebuild.get(id);
            if (instanceToRebuild) {
              if (!instanceToRebuild.prototype) {
                // If this happens, it's a bug.
                throw new Error(`Instance ${id} has no prototype!`);
              }
              refData = {
                data: this.collectOverrides<Schema.Ref>(instanceToRebuild, {
                  id: instanceToRebuild.id,
                  type: "ref",
                  ref: instanceToRebuild.prototype.node.path,
                  reusable: instanceToRebuild.reusable,
                }),
                // NOTE(zaza): if the prototype's structure has changed (e.g. a node was deleted), some overrides may no longer apply.
                allowFailingOverrides: true,
              };
            } else {
              // Node already exists, and is unaffected by the replace operation.
              return;
            }
          }

          createNodes(firstPathComponent(refData.data.ref));
          const nodeToClone = (createdNodes.get(refData.data.ref) ??
            this.manager.scenegraph.getNodeByPath(refData.data.ref))!;
          canonicalizeDescendantPaths(refData.data, nodeToClone);
          const clonedNode = cloneSubtree(nodeToClone, refData.data);
          const failedOverrides = applyOverrides(
            undefined,
            clonedNode,
            refData,
            (name, type) =>
              this.manager.variableManager.getVariable(name, type),
          );
          clonedNode.ensurePrototypeReusability(null);
          if (!refData.allowFailingOverrides && failedOverrides) {
            throw new Error(
              `Unknown node for override paths ${Object.keys(failedOverrides).map(singleQuote).join(", ")}!`,
            );
          }
        } finally {
          creatingNodes.delete(id);
        }
      };
      for (const id of [node.id, ...instancesToRebuild.keys()]) {
        createNodes(id);
      }

      replaceNode(block, replacedNode, createdNodes.get(node.id)!);
      for (const nodeToReplace of instancesToRebuild.values()) {
        replaceNode(block, nodeToReplace, createdNodes.get(nodeToReplace.id)!);
      }

      // TODO(zaza): see insertNode() above for details.
      this.insertIntoSceneGraph(block, createdNodes.values());
      for (const node of [replacedNode, ...instancesToRebuild.values()]) {
        this.removeRecursivelyFromSceneGraph(block, node);
      }

      return createdNodes.get(node.id)!;
    } catch (error) {
      for (const node of createdNodes.values()) {
        block.deleteNode(node, false);
      }
      throw error;
    }
  }

  private removeRecursivelyFromSceneGraph(
    block: ObjectUpdateBlock,
    node: SceneNode,
  ) {
    block.deleteNode(node);
    for (const child of node.children) {
      this.removeRecursivelyFromSceneGraph(block, child);
    }
  }

  private insertIntoSceneGraph(
    block: ObjectUpdateBlock,
    nodes: Iterable<SceneNode>,
  ) {
    for (const node of nodes) {
      if (!node.parent) {
        // If this happens, it's a bug.
        throw new Error(`Node '${node.id}' is not attached to a parent!`);
      }
      block.addNode(node, node.parent);
    }
  }

  updateNodeProperties(
    block: ObjectUpdateBlock,
    updatedNode: SceneNode,
    updates: Partial<Schema.Child>,
  ) {
    const updateNode = (node: SceneNode, updates: Partial<Schema.Child>) => {
      if (updates.type) {
        this.replaceNode(block, node, updates as any);
      } else {
        if ("descendants" in updates) {
          for (const [path, descendantUpdates] of Object.entries(
            updates.descendants ?? {},
          )) {
            const canonicalPath = node.canonicalizePath(path) ?? path;
            const descendant = node.getNodeByPath(canonicalPath);
            if (!descendant) {
              throw new Error(`Node not found for override path: ${path}`);
            }
            updateNode(descendant, descendantUpdates);
          }
          delete updates.descendants;
        }

        applyOverrides(block, node, updates, (name, type) =>
          this.manager.variableManager.getVariable(name, type),
        );

        if ("children" in updates) {
          block.clearChildren(node);
          this.insertNodes(block, node.path, undefined, updates.children, true);
        }
      }
    };
    updateNode(updatedNode, updates);

    this.manager.scenegraph.updateLayout();
    this.manager.skiaRenderer.addFlashForNode(updatedNode);
    // TODO(zaza): this should happen automatically based on the property changes
    this.manager.requestFrame();
  }

  copyNode(
    block: ObjectUpdateBlock,
    parentId: string | undefined,
    index: number | undefined,
    nodeData: {
      id: string;
      [key: string]: any; // overrides on the copied node
      descendants?: { [path: string]: any }; // overrides in descendants
    },
  ): SceneNode {
    parentId = parentId
      ? (this.manager.scenegraph.canonicalizePath(parentId) ?? parentId)
      : parentId;

    nodeData.id =
      this.manager.scenegraph.canonicalizePath(nodeData.id) ?? nodeData.id;

    const parent = parentId
      ? this.manager.scenegraph.getNodeByPath(parentId)
      : this.manager.scenegraph.getViewportNode();
    if (!parent) {
      throw new Error(`Can't find parent node with id '${parentId}'!`);
    } else if (
      parent.prototype &&
      parent.children.length !== 0 &&
      !parent.prototype.childrenOverridden
    ) {
      throw new Error(
        `To modify '${parentId}' (a component instance descendant), use U("${parentId}", {...}) to update properties, or R("${parentId}", {...}) to replace it.`,
      );
    } else if (index && (index < 0 || index > parent.children.length)) {
      throw new Error(
        `Invalid insertion index ${index}, parent node '${parentId}' has ${parent.children.length} children!`,
      );
    }

    if (parent.prototype && !parent.prototype.childrenOverridden) {
      parent.setChildrenOverridden(block.rollback, true);
    }

    const node = this.manager.scenegraph.getNodeByPath(nodeData.id);
    if (!node) {
      throw new Error(`Can't find node with id '${nodeData.id}'!`);
    }
    canonicalizeDescendantPaths(nodeData, node);

    const copiedNode = node.createInstancesFromSubtree();
    copiedNode.id = SceneGraph.createUniqueID();
    block.addNode(copiedNode, parent);
    this.updateNodeProperties(block, copiedNode, nodeData);
    copiedNode.ensurePrototypeReusability(block.rollback);

    this.manager.scenegraph.updateLayout();
    this.manager.skiaRenderer.addFlashForNode(copiedNode);

    return copiedNode;
  }

  private collectOverrides<T extends { descendants?: any }>(
    node: SceneNode,
    into: T,
    options?: {
      maxDepth?: number;
      resolveInstances?: boolean;
      resolveVariables?: boolean;
      includePathGeometry?: boolean;
    },
    mapChildId: (id: string) => string = (id) => id,
  ): T {
    if (!node.prototype) {
      throw new Error("Node has no prototype!");
    } else if (!node.isUnique) {
      // NOTE(zaza): normally we would throw an error here, because regular
      // serialization will only ever call this on unique nodes.
      // But LLM agents can query non-unique nodes via MCP tools, so we have to allow it.
    }

    const collectOverrides = (node: SceneNode, path?: string) => {
      if (path && node.isUnique) {
        (into.descendants ??= {})[path] = this.serializeNode(node, options);
      } else {
        assert(node.prototype); // implied by !path || !node.isUnique

        const properties =
          (options?.resolveVariables ?? false)
            ? node.properties.resolved
            : node.properties;

        const setNodeOverride = <T>(
          key: RefOverrideKey,
          value: JSONCompatible<T>,
        ) => {
          let destination;
          if (path) {
            destination = (into.descendants ??= {})[path] ??= {};
          } else {
            destination = into;
          }
          destination[key] = value;
        };
        for (const overriddenProperty of node.prototype.overriddenProperties ??
          []) {
          switch (overriddenProperty) {
            case "name": {
              setNodeOverride("name", serializeOptionalValue(properties.name));
              break;
            }
            case "context": {
              setNodeOverride("context", properties.context);
              break;
            }
            case "theme": {
              setNodeOverride(
                "theme",
                Object.fromEntries(properties.theme?.entries() ?? []),
              );
              break;
            }
            case "enabled": {
              setNodeOverride("enabled", serializeValue(properties.enabled));
              break;
            }
            case "horizontalSizing":
            case "width": {
              setNodeOverride(
                "width",
                serializeSingleAxisSize(
                  node,
                  properties.width,
                  properties.horizontalSizing,
                ),
              );
              break;
            }
            case "verticalSizing":
            case "height": {
              setNodeOverride(
                "height",
                serializeSingleAxisSize(
                  node,
                  properties.height,
                  properties.verticalSizing,
                ),
              );
              break;
            }
            case "x": {
              setNodeOverride("x", properties.x);
              break;
            }
            case "y": {
              setNodeOverride("y", properties.y);
              break;
            }
            case "rotation": {
              setNodeOverride(
                "rotation",
                serializeValue(properties.rotation, serializeRotation),
              );
              break;
            }
            case "flipX": {
              setNodeOverride("flipX", serializeValue(properties.flipX));
              break;
            }
            case "flipY": {
              setNodeOverride("flipY", serializeValue(properties.flipY));
              break;
            }
            case "fills": {
              setNodeOverride("fill", serializeFill(properties.fills, false));
              break;
            }
            case "clip": {
              setNodeOverride("clip", serializeValue(properties.clip));
              break;
            }
            case "strokeFills":
            case "strokeWidth":
            case "strokeAlignment":
            case "lineJoin":
            case "lineCap": {
              // NOTE(zaza): this may re-serialize the same value up to 5 times,
              // which is not optimal, but negligible.
              setNodeOverride("stroke", serializeStroke(properties, false));
              break;
            }
            case "opacity": {
              setNodeOverride("opacity", serializeValue(properties.opacity));
              break;
            }
            case "textContent": {
              setNodeOverride("content", properties.textContent);
              break;
            }
            case "textAlign": {
              setNodeOverride("textAlign", properties.textAlign);
              break;
            }
            case "textAlignVertical": {
              setNodeOverride(
                "textAlignVertical",
                properties.textAlignVertical,
              );
              break;
            }
            case "textGrowth": {
              setNodeOverride("textGrowth", properties.textGrowth);
              break;
            }
            case "fontSize": {
              setNodeOverride("fontSize", serializeValue(properties.fontSize));
              break;
            }
            case "letterSpacing": {
              setNodeOverride(
                "letterSpacing",
                serializeValue(properties.letterSpacing),
              );
              break;
            }
            case "lineHeight": {
              setNodeOverride(
                "lineHeight",
                serializeValue(properties.lineHeight),
              );
              break;
            }
            case "fontFamily": {
              setNodeOverride(
                "fontFamily",
                serializeValue(properties.fontFamily),
              );
              break;
            }
            case "fontWeight": {
              setNodeOverride(
                "fontWeight",
                serializeValue(properties.fontWeight),
              );
              break;
            }
            case "fontStyle": {
              setNodeOverride(
                "fontStyle",
                serializeValue(properties.fontStyle),
              );
              break;
            }
            case "cornerRadius": {
              setNodeOverride(
                "cornerRadius",
                serializeCornerRadius(properties.cornerRadius, false),
              );
              break;
            }
            case "iconFontName": {
              setNodeOverride(
                "iconFontName",
                serializeOptionalValue(properties.iconFontName),
              );
              break;
            }
            case "iconFontFamily": {
              setNodeOverride(
                "iconFontFamily",
                serializeOptionalValue(properties.iconFontFamily),
              );
              break;
            }
            case "effects": {
              setNodeOverride(
                "effect",
                serializeEffects(properties.effects, false),
              );
              break;
            }
            case "pathData": {
              setNodeOverride("geometry", properties.pathData);
              break;
            }
            case "fillRule": {
              setNodeOverride("fillRule", properties.fillRule);
              break;
            }
            case "polygonCount": {
              setNodeOverride(
                "polygonCount",
                serializeOptionalValue(properties.polygonCount),
              );
              break;
            }
            case "layoutChildSpacing": {
              setNodeOverride(
                "gap",
                serializeValue(properties.layoutChildSpacing ?? 0),
              );
              break;
            }
            case "layoutMode": {
              setNodeOverride(
                "layout",
                serializeLayoutMode(properties.layoutMode, node.type, false),
              );
              break;
            }
            case "layoutPadding": {
              setNodeOverride(
                "padding",
                serializePadding(properties.layoutPadding, false),
              );
              break;
            }
            case "layoutJustifyContent": {
              setNodeOverride(
                "justifyContent",
                serializeJustifyContent(properties.layoutJustifyContent, false),
              );
              break;
            }
            case "layoutAlignItems": {
              setNodeOverride(
                "alignItems",
                serializeAlignItems(properties.layoutAlignItems, false),
              );
              break;
            }
          }
        }

        if (node.prototype.childrenOverridden) {
          setNodeOverride(
            "children",
            node.children.map((child) => this.serializeNode(child, options)),
          );
        } else {
          for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            const prototypeChild = node.prototype.node.children[i];
            const mappedChildId = mapChildId(prototypeChild.id);
            collectOverrides(
              child,
              path && !prototypeChild.isUnique
                ? node.isInstanceBoundary
                  ? `${path}/${mappedChildId}`
                  : replaceLastPathComponent(path, mappedChildId)
                : mappedChildId,
            );
          }
        }
      }
    };
    collectOverrides(node);

    return into;
  }
}

function convertWidth(
  properties: Partial<NodeProperties>,
  input?: Schema.NumberOrVariable,
) {
  if (input === undefined) {
    return;
  } else if (typeof input === "number") {
    properties.width = input;
    properties.horizontalSizing = SizingBehavior.Fixed;
  } else if (input.startsWith("$")) {
    // TODO(zaza): handle size variables
    // properties.width = variableManager.getVariable(input.substring(1));
    // properties.horizontalSizing = SizingBehavior.Fixed;
  } else {
    const parsed = mapSchemaSizingBehaviorToNodeProperties(input);
    properties.width = parsed.fallback;
    properties.horizontalSizing = parsed.sizing;
  }
}

function convertHeight(
  properties: Partial<NodeProperties>,
  input?: Schema.NumberOrVariable,
) {
  if (input === undefined) {
    return;
  } else if (typeof input === "number") {
    properties.height = input;
    properties.verticalSizing = SizingBehavior.Fixed;
  } else if (input.startsWith("$")) {
    // TODO(zaza): handle size variables
    // properties.height = variableManager.getVariable(input.substring(1));
    // properties.verticalSizing = SizingBehavior.Fixed;
  } else {
    const parsed = mapSchemaSizingBehaviorToNodeProperties(input);
    properties.height = parsed.fallback;
    properties.verticalSizing = parsed.sizing;
  }
}

function convertSize(properties: Partial<NodeProperties>, input: Schema.Size) {
  convertWidth(properties, input.width);
  convertHeight(properties, input.height);
}

function convertFill(
  variableManager: VariableMapping,
  fills: Schema.Fills | undefined,
): Fill[] | undefined {
  if (fills == null) {
    return;
  }

  if (typeof fills === "string") {
    return [
      {
        type: FillType.Color,
        enabled: true,
        color: convertColor(variableManager, fills) ?? "#000000",
      },
    ];
  }

  const converted: Fill[] = [];

  if (!Array.isArray(fills)) {
    fills = [fills];
  }

  for (const fill of fills) {
    if (typeof fill === "string") {
      converted.push({
        type: FillType.Color,
        enabled: true,
        color: convertColor(variableManager, fill) ?? "#000000",
      });
    } else {
      const type = fill.type;
      switch (type) {
        case "color": {
          converted.push({
            type: FillType.Color,
            enabled: convertBoolean(variableManager, fill.enabled) ?? true,
            color: convertColor(variableManager, fill.color) ?? "#000000",
            blendMode: fill.blendMode,
          });
          break;
        }

        case "gradient": {
          const gradientType = fill.gradientType;
          if (gradientType) {
            const stops: ColorStop[] =
              fill.colors?.map((stop) => {
                return {
                  color: convertColor(variableManager, stop.color) ?? "#000000",
                  position: convertNumber(variableManager, stop.position) ?? 0,
                };
              }) ?? [];

            const opacityPercent =
              convertNumber(
                variableManager,
                fill.opacity,
                (value) => value * 100,
              ) ?? 100;
            const enabled =
              convertBoolean(variableManager, fill.enabled) ?? true;

            const center: [number, number] = [
              fill.center?.x ?? 0.5,
              fill.center?.y ?? 0.5,
            ];
            const width = convertNumber(variableManager, fill.size?.width) ?? 1;
            const height =
              convertNumber(variableManager, fill.size?.height) ?? 1;

            const rotationDegrees =
              convertNumber(variableManager, fill.rotation) ?? 0;

            let type;
            switch (gradientType) {
              case "linear": {
                type = FillType.LinearGradient as const;
                break;
              }
              case "radial": {
                type = FillType.RadialGradient as const;
                break;
              }
              case "angular": {
                type = FillType.AngularGradient as const;
                break;
              }
              default: {
                const missing: never = gradientType;
                logger.error(`Invalid gradient type: ${missing}`);
                break;
              }
            }

            if (type == null) {
              break;
            }

            converted.push({
              type: type,
              enabled: enabled,
              stops: stops,
              opacityPercent: opacityPercent,
              center: center,
              rotationDegrees: rotationDegrees,
              size: [width, height],
              blendMode: fill.blendMode,
            });
          }
          break;
        }

        case "image": {
          const opacityPercent =
            convertNumber(
              variableManager,
              fill.opacity,
              (value) => value * 100,
            ) ?? 100;

          converted.push({
            type: FillType.Image,
            enabled: convertBoolean(variableManager, fill.enabled) ?? true,
            url: convertString(variableManager, fill.url) ?? "",
            mode: deserializeStretchMode(fill.mode) ?? StretchMode.Stretch,
            opacityPercent,
            blendMode: fill.blendMode,
          });
          break;
        }

        case "mesh_gradient": {
          const columns = fill.columns;
          const rows = fill.rows;
          if (rows == null || columns == null) {
            break;
          }

          const points = fill.points;
          const colors = fill.colors;
          if (points == null || colors == null) {
            break;
          }

          if (points.length !== colors.length) {
            break;
          }

          if (rows * columns !== points.length) {
            break;
          }

          const convertedPoints = [];

          const tangentScaleX = 0.25 / Math.max(columns - 1, 1);
          const tangentScaleY = 0.25 / Math.max(rows - 1, 1);

          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
              const index = y * columns + x;

              const point = index < points.length ? points[index] : undefined;
              const color = colors[index % colors.length];

              let position: [number, number];
              let leftHandle: [number, number] | undefined;
              let rightHandle: [number, number] | undefined;
              let topHandle: [number, number] | undefined;
              let bottomHandle: [number, number] | undefined;

              if (Array.isArray(point)) {
                position = point as [number, number];
              } else if (point && typeof point === "object") {
                position = (point.position as [number, number] | undefined) ?? [
                  x / Math.max(columns - 1, 1),
                  y / Math.max(rows - 1, 1),
                ];
                leftHandle = point.leftHandle as [number, number] | undefined;
                rightHandle = point.rightHandle as [number, number] | undefined;
                topHandle = point.topHandle as [number, number] | undefined;
                bottomHandle = point.bottomHandle as
                  | [number, number]
                  | undefined;
              } else {
                position = [
                  x / Math.max(columns - 1, 1),
                  y / Math.max(rows - 1, 1),
                ];
              }

              const result: MeshGradientPoint = {
                color: convertColor(variableManager, color) ?? "#000000",

                position: position,

                leftHandle: leftHandle ?? [-tangentScaleX, 0],
                rightHandle: rightHandle ?? [tangentScaleX, 0],
                topHandle: topHandle ?? [0, -tangentScaleY],
                bottomHandle: bottomHandle ?? [0, tangentScaleY],
              };

              convertedPoints.push(result);
            }
          }

          converted.push({
            type: FillType.MeshGradient,
            enabled: convertBoolean(variableManager, fill.enabled) ?? true,
            columns: columns,
            rows: rows,
            points: convertedPoints,
            opacityPercent:
              convertNumber(
                variableManager,
                fill.opacity,
                (value) => value * 100,
              ) ?? 100,
            blendMode: fill.blendMode,
          });
          break;
        }

        default: {
          const missing: never = type;
          logger.error(`Unsupported fill type: ${missing}`);
          break;
        }
      }
    }
  }

  return converted;
}

function convertEffects(
  variableManager: VariableMapping,
  input: Schema.Effects | undefined,
): Effect[] | undefined {
  if (input == null) {
    return;
  }

  const src = Array.isArray(input) ? input : [input];

  const effects: Effect[] = [];

  for (const item of src) {
    const type = item.type;
    switch (type) {
      case "blur": {
        effects.push({
          type: EffectType.LayerBlur,
          radius: convertNumber(variableManager, item.radius) ?? 0,
          enabled: convertBoolean(variableManager, item.enabled) ?? true,
        });
        break;
      }

      case "shadow": {
        effects.push({
          type: EffectType.DropShadow,
          enabled: convertBoolean(variableManager, item.enabled) ?? true,

          offsetX: convertNumber(variableManager, item.offset?.x) ?? 0,
          offsetY: convertNumber(variableManager, item.offset?.y) ?? 0,

          color: convertColor(variableManager, item.color) ?? "#000000",
          radius: convertNumber(variableManager, item.blur) ?? 0,
          spread: convertNumber(variableManager, item.spread) ?? 0,
          blendMode: item.blendMode ?? "normal",
        });
        break;
      }

      case "background_blur": {
        effects.push({
          type: EffectType.BackgroundBlur,
          radius: convertNumber(variableManager, item.radius) ?? 0,
          enabled: convertBoolean(variableManager, item.enabled) ?? true,
        });
        break;
      }

      default: {
        const missing: never = type;
        logger.error(`Unsupported effect type: ${missing}`);
        break;
      }
    }
  }

  return effects;
}

function convertStroke(
  mapVariable: VariableMapping,
  properties: Partial<NodeProperties>,
  input: Schema.Stroke | undefined,
) {
  if (input == null) {
    properties.strokeFills = undefined;
    properties.strokeWidth = undefined;
    properties.strokeAlignment = undefined;
    properties.lineCap = undefined;
    properties.lineJoin = undefined;
    return;
  }

  properties.strokeFills = convertFill(mapVariable, input.fill);

  if (input.thickness != null) {
    if (typeof input.thickness === "object") {
      properties.strokeWidth = [
        convertNumber(mapVariable, input.thickness.top) ?? 0,
        convertNumber(mapVariable, input.thickness.right) ?? 0,
        convertNumber(mapVariable, input.thickness.bottom) ?? 0,
        convertNumber(mapVariable, input.thickness.left) ?? 0,
      ];
    } else {
      properties.strokeWidth = [
        convertNumber(mapVariable, input.thickness) ?? 0,
        convertNumber(mapVariable, input.thickness) ?? 0,
        convertNumber(mapVariable, input.thickness) ?? 0,
        convertNumber(mapVariable, input.thickness) ?? 0,
      ];
    }
  } else {
    properties.strokeWidth = undefined;
  }

  switch (input.align) {
    case "inside": {
      properties.strokeAlignment = StrokeAlignment.Inside;
      break;
    }
    case "center": {
      properties.strokeAlignment = StrokeAlignment.Center;
      break;
    }
    case "outside": {
      properties.strokeAlignment = StrokeAlignment.Outside;
      break;
    }

    default: {
      properties.strokeAlignment = undefined;
      break;
    }
  }

  properties.lineCap = input.cap;
  properties.lineJoin = input.join || "miter";
}

function convertLayoutMode(
  input: Schema.Layout["layout"] | undefined,
): LayoutMode | undefined {
  switch (input) {
    case "horizontal":
      return LayoutMode.Horizontal;
    case "vertical":
      return LayoutMode.Vertical;
    case "none":
      return LayoutMode.None;
  }

  return undefined;
}

function convertPadding(
  mapVariable: VariableMapping,
  input: Schema.Layout["padding"] | undefined,
): NodeProperties["layoutPadding"] {
  if (input != null) {
    if (Array.isArray(input)) {
      if (input.length === 2) {
        return [
          convertNumber(mapVariable, input[0]) ?? 0,
          convertNumber(mapVariable, input[1]) ?? 0,
        ];
      } else if (input.length === 4) {
        return [
          convertNumber(mapVariable, input[0]) ?? 0,
          convertNumber(mapVariable, input[1]) ?? 0,
          convertNumber(mapVariable, input[2]) ?? 0,
          convertNumber(mapVariable, input[3]) ?? 0,
        ];
      }
    } else if (typeof input === "number") {
      return convertNumber(mapVariable, input) ?? 0;
    }
  }

  return undefined;
}

function convertLayoutAlignItems(
  input: Schema.Layout["alignItems"] | undefined,
): AlignItems | undefined {
  switch (input) {
    case "start":
      return AlignItems.Start;
    case "end":
      return AlignItems.End;
    case "center":
      return AlignItems.Center;
  }
}

function convertLayoutJustifyContent(
  input: Schema.Layout["justifyContent"] | undefined,
): JustifyContent | undefined {
  switch (input) {
    case "start":
      return JustifyContent.Start;
    case "end":
      return JustifyContent.End;
    case "space_between":
      return JustifyContent.SpaceBetween;
    case "space_around":
      return JustifyContent.SpaceAround;
    case "center":
      return JustifyContent.Center;
  }
}

function convertLayoutProperties(
  mapVariable: VariableMapping,
  properties: NodeProperties,
  input: Schema.Layout,
  defaultLayoutMode: LayoutMode,
) {
  if (input == null) {
    return;
  }

  properties.layoutMode = convertLayoutMode(input.layout) ?? defaultLayoutMode;

  properties.layoutChildSpacing = convertNumber(mapVariable, input.gap) ?? 0;
  properties.layoutPadding = convertPadding(mapVariable, input.padding);
  properties.layoutAlignItems =
    convertLayoutAlignItems(input.alignItems) ?? AlignItems.Start;
  properties.layoutJustifyContent =
    convertLayoutJustifyContent(input.justifyContent) ?? JustifyContent.Start;
}

function convertValue<T extends Single<VariableType>>(
  mapVariable: VariableMapping,
  data: string | VariableValueType<T> | undefined,
  type: T,
  runtimeType: VariableRuntimeType<T>,
  map?: (value: VariableValueType<T>) => VariableValueType<T>,
): Value<T> | undefined {
  if (data === undefined) {
    return undefined;
  } else if (typeof data === "string" && data.startsWith("$")) {
    return mapVariable(data.substring(1), type);
  } else if (typeof data === runtimeType) {
    const properData = data as VariableValueType<T>;
    return map ? map(properData) : properData;
  } else {
    return undefined;
  }
}

function convertNumber(
  mapVariable: VariableMapping,
  data?: Schema.NumberOrVariable,
  map?: (value: number) => number,
): Value<"number"> | undefined {
  return convertValue(mapVariable, data, "number", "number", map);
}

function convertBoolean(
  mapVariable: VariableMapping,
  data?: Schema.BooleanOrVariable,
  map?: (value: boolean) => boolean,
): Value<"boolean"> | undefined {
  return convertValue(mapVariable, data, "boolean", "boolean", map);
}

function convertColor(
  mapVariable: VariableMapping,
  data?: Schema.ColorOrVariable,
  map?: (value: string) => string,
): Value<"color"> | undefined {
  return convertValue(mapVariable, data, "color", "string", map);
}

function convertString(
  mapVariable: VariableMapping,
  data?: Schema.ColorOrVariable,
  map?: (value: string) => string,
): Value<"string"> | undefined {
  return convertValue(mapVariable, data, "string", "string", map);
}

function convertCornerRadius(
  mapVariable: VariableMapping,
  data?: Schema.Rectangleish["cornerRadius"],
): NodeProperties["cornerRadius"] {
  if (Array.isArray(data)) {
    // TODO(sedivy): Add support for all sides
    return [
      convertNumber(mapVariable, data[0]) ?? 0,
      convertNumber(mapVariable, data[1]) ?? 0,
      convertNumber(mapVariable, data[2]) ?? 0,
      convertNumber(mapVariable, data[3]) ?? 0,
    ];
  } else if (data !== undefined && data !== 0) {
    return [
      convertNumber(mapVariable, data) ?? 0,
      convertNumber(mapVariable, data) ?? 0,
      convertNumber(mapVariable, data) ?? 0,
      convertNumber(mapVariable, data) ?? 0,
    ];
  }
}

// NOTE(sedivy): Parse sizing behavior strings like "fit_content(100.50)" or "fill_container".
// The number in parentheses is the fallback size.
const sizingBehaviorRegex = /^(\w+)(?:\((-?[\d.]+)\))?$/;

function mapSchemaSizingBehaviorToNodeProperties(
  sizeValue: Schema.SizingBehavior | undefined,
): { sizing: SizingBehavior; fallback: number } {
  if (!sizeValue) {
    return { sizing: SizingBehavior.FitContent, fallback: 0 };
  }

  const match = sizingBehaviorRegex.exec(sizeValue);
  if (!match) {
    return { sizing: SizingBehavior.FitContent, fallback: 0 };
  }

  const name = match[1];

  let fallback = match[2] ? parseFloat(match[2]) : 0;
  if (Number.isNaN(fallback)) {
    const error = new Error(
      `Invalid fallback size in sizing behavior: ${sizeValue}`,
    );

    logger.error(error.message);
    reportError(error);
    fallback = 0;
  }

  switch (name) {
    case "fit_content": {
      return { sizing: SizingBehavior.FitContent, fallback };
    }

    case "fill_container": {
      return { sizing: SizingBehavior.FillContainer, fallback };
    }

    default: {
      logger.error(`Unknown sizing behavior: ${name}`);
      return { sizing: SizingBehavior.FitContent, fallback: 0 };
    }
  }
}

function convertType(
  type: Exclude<Schema.Document["children"][0]["type"], "connection" | "ref">,
): NodeType {
  switch (type) {
    case "frame":
      return "frame";
    case "group":
      return "group";
    case "rectangle":
      return "rectangle";
    case "ellipse":
      return "ellipse";
    case "line":
      return "line";
    case "polygon":
      return "polygon";
    case "path":
      return "path";
    case "text":
      return "text";
    case "note":
      return "note";
    case "prompt":
      return "prompt";
    case "context":
      return "context";
    case "icon_font":
      return "icon_font";
  }
}

export type VariableMapping = <T extends Single<VariableType>>(
  name: string,
  type: T,
) => Value<T> | undefined;

// NOTE(sedivy): This function takes v2 schema and converts it to runtime values
// for each node type. Right now it's done here in a single place, but in the
// future each node type will do it internally and convert to it's own private
// runtime value.
export function deserializeToProperties(
  input:
    | Schema.Frame
    | Schema.Group
    | Schema.Rectangle
    | Schema.Ellipse
    | Schema.Line
    | Schema.Polygon
    | Schema.Path
    | Schema.Text
    | Schema.Note
    | Schema.Prompt
    | Schema.Context
    | Schema.IconFont,
  mapVariable: VariableMapping,
  mapTheme: ([axis, value]: [string, string]) => [string, string] = (t) => t,
  properties: NodeProperties = createNodeProperties(convertType(input.type)),
): null | { type: NodeType; properties: NodeProperties } {
  properties.x = input.x ?? properties.x;
  properties.y = input.y ?? properties.y;
  properties.name = input.name;
  properties.context = input.context;
  properties.theme = input.theme
    ? new Map(Object.entries(input.theme).map(mapTheme))
    : undefined;
  properties.enabled =
    convertBoolean(mapVariable, input.enabled) ?? properties.enabled;
  properties.rotation =
    convertNumber(mapVariable, input.rotation, deserializeRotation) ??
    properties.rotation;
  properties.opacity =
    convertNumber(mapVariable, input.opacity) ?? properties.opacity;
  properties.flipX =
    convertBoolean(mapVariable, input.flipX) ?? properties.flipX;
  properties.flipY =
    convertBoolean(mapVariable, input.flipY) ?? properties.flipY;
  properties.metadata = input.metadata;

  let type: NodeType;

  switch (input.type) {
    case "ellipse":
    case "line":
    case "polygon":
    case "path":
    case "frame":
    case "rectangle": {
      type = input.type;

      convertSize(properties, input);

      properties.effects = convertEffects(mapVariable, input.effect);

      const fills = convertFill(mapVariable, input.fill);
      if (fills !== undefined) {
        properties.fills = fills;
      }

      convertStroke(mapVariable, properties, input.stroke);

      if (input.type === "polygon") {
        properties.polygonCount = convertNumber(
          mapVariable,
          input.polygonCount,
        );
        properties.cornerRadius = convertCornerRadius(
          mapVariable,
          input.cornerRadius,
        );
      }

      if (input.type === "frame" || input.type === "rectangle") {
        properties.cornerRadius = convertCornerRadius(
          mapVariable,
          input.cornerRadius,
        );
      }

      if (input.type === "path") {
        properties.pathData = input.geometry;
        properties.fillRule = input.fillRule;
      }

      if (input.type === "frame") {
        properties.clip =
          convertBoolean(mapVariable, input.clip) ?? properties.clip;
        properties.placeholder = input.placeholder ?? properties.placeholder;
        convertLayoutProperties(
          mapVariable,
          properties,
          input,
          LayoutMode.Horizontal,
        );
      }
      break;
    }

    case "group": {
      type = input.type;

      convertLayoutProperties(mapVariable, properties, input, LayoutMode.None);
      properties.effects = convertEffects(mapVariable, input.effect);

      // NOTE(sedivy): Group is different from any other entity. Group can have
      // horizontal/vertical sizing, but it will never have a fixed pixel size.
      properties.horizontalSizing = mapSchemaSizingBehaviorToNodeProperties(
        input.width,
      ).sizing;

      properties.verticalSizing = mapSchemaSizingBehaviorToNodeProperties(
        input.height,
      ).sizing;

      break;
    }
    case "text": {
      type = input.type;
      properties.textContent =
        typeof input.content === "string" ? input.content : "";
      properties.fontSize =
        convertNumber(mapVariable, input.fontSize) ?? properties.fontSize;
      properties.fontFamily =
        convertString(mapVariable, input.fontFamily) ?? properties.fontFamily;
      properties.fontWeight =
        convertString(mapVariable, input.fontWeight) ?? properties.fontWeight;
      properties.fontStyle =
        convertString(mapVariable, input.fontStyle) ?? properties.fontStyle;
      properties.letterSpacing =
        convertNumber(mapVariable, input.letterSpacing) ??
        properties.letterSpacing;
      properties.lineHeight = convertNumber(mapVariable, input.lineHeight) ?? 0;
      properties.textGrowth = input.textGrowth ?? properties.textGrowth;
      properties.textAlign = input.textAlign ?? properties.textAlign;
      properties.textAlignVertical =
        input.textAlignVertical ?? properties.textAlignVertical;

      properties.effects = convertEffects(mapVariable, input.effect);

      convertSize(properties, input);

      const fill = convertFill(mapVariable, input.fill);
      if (fill != null) {
        properties.fills = fill;
      }
      break;
    }

    case "note":
    case "prompt":
    case "context": {
      type = input.type;

      properties.textContent =
        typeof input.content === "string" ? input.content : "";
      properties.fontSize =
        convertNumber(mapVariable, input.fontSize) ?? properties.fontSize;
      properties.fontFamily =
        convertString(mapVariable, input.fontFamily) ?? properties.fontFamily;
      properties.fontWeight =
        convertString(mapVariable, input.fontWeight) ?? properties.fontWeight;
      properties.fontStyle =
        convertString(mapVariable, input.fontStyle) ?? properties.fontStyle;
      properties.letterSpacing =
        convertNumber(mapVariable, input.letterSpacing) ??
        properties.letterSpacing;
      convertSize(properties, input);

      if (input.type === "prompt") {
        properties.modelName = input.model;
      }

      break;
    }

    case "icon_font": {
      type = input.type;
      properties.iconFontName =
        convertString(mapVariable, input.iconFontName) ??
        properties.iconFontName;
      properties.iconFontFamily =
        convertString(mapVariable, input.iconFontFamily) ??
        properties.iconFontFamily;
      properties.iconFontWeight =
        convertNumber(mapVariable, input.weight) ?? properties.iconFontWeight;

      properties.effects = convertEffects(mapVariable, input.effect);

      convertSize(properties, input);

      const fill = convertFill(mapVariable, input.fill);
      if (fill != null) {
        properties.fills = fill;
      }
      break;
    }
  }

  return {
    type: type,
    properties: properties,
  };
}

type JSONCompatible<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends Function
    ? never
    : T extends object
      ? { [K in keyof T]: JSONCompatible<T[K]> }
      : never;

function applyOverrides(
  block: ObjectUpdateBlock | undefined,
  node: SceneNode,
  from: { [key: string]: any; descendants?: Schema.Ref["descendants"] },
  mapVariable: VariableMapping,
  mapTheme: ([axis, value]: [string, string]) => [string, string] = (t) => t,
  mapChildId: (id: string) => string = (id) => id,
): Schema.Ref["descendants"] {
  const unconsumedOverrides =
    from.descendants && new Map(Object.entries(from.descendants));
  const applyOverrides = (node: SceneNode, path?: string) => {
    let overrides: { [key: string]: any } | undefined;
    if (path === undefined) {
      overrides = from;
    } else {
      overrides = unconsumedOverrides?.get(path);
      if (overrides) {
        unconsumedOverrides!.delete(path);
      }
    }

    let update: Partial<NodeProperties> | undefined;
    for (const [key, value] of Object.entries(overrides ?? {})) {
      switch (key) {
        case "ref":
        case "descendants": {
          continue;
        }
      }
      const typedKey = key as RefOverrideKey;
      switch (typedKey) {
        case "id":
        case "type":
        case "slot":
        case "reusable":
        case "children": {
          continue;
        }
        case "name": {
          (update ??= {}).name = value; // TODO(zaza): variable support?
          break;
        }
        case "context": {
          (update ??= {}).context = value;
          break;
        }
        case "theme": {
          (update ??= {}).theme = new Map(
            Object.entries(value as { [axis: string]: string }).map(mapTheme),
          );
          break;
        }
        case "enabled": {
          (update ??= {}).enabled =
            convertBoolean(mapVariable, value) ?? node.properties.enabled;
          break;
        }
        case "x": {
          (update ??= {}).x = value ?? 0;
          break;
        }
        case "y": {
          (update ??= {}).y = value ?? 0;
          break;
        }
        case "flipX": {
          (update ??= {}).flipX =
            convertBoolean(mapVariable, value) ?? node.properties.flipX;
          break;
        }
        case "flipY": {
          (update ??= {}).flipY =
            convertBoolean(mapVariable, value) ?? node.properties.flipY;
          break;
        }
        case "clip": {
          (update ??= {}).clip =
            convertBoolean(mapVariable, value) ?? node.properties.clip;
          break;
        }
        case "placeholder": {
          (update ??= {}).placeholder = value;
          break;
        }
        case "opacity": {
          (update ??= {}).opacity =
            convertNumber(mapVariable, value) ?? node.properties.opacity;
          break;
        }
        case "textAlign": {
          (update ??= {}).textAlign = value; // TODO(zaza): variable support?
          break;
        }
        case "textAlignVertical": {
          (update ??= {}).textAlignVertical = value; // TODO(zaza): variable support?
          break;
        }
        case "textGrowth": {
          (update ??= {}).textGrowth = value; // TODO(zaza): variable support?
          break;
        }
        case "fontSize": {
          (update ??= {}).fontSize =
            convertNumber(mapVariable, value) ?? node.properties.fontSize;
          break;
        }
        case "letterSpacing": {
          (update ??= {}).letterSpacing =
            convertNumber(mapVariable, value) ?? node.properties.letterSpacing;
          break;
        }
        case "lineHeight": {
          (update ??= {}).lineHeight =
            convertNumber(mapVariable, value) ?? node.properties.lineHeight;
          break;
        }
        case "fontFamily": {
          (update ??= {}).fontFamily =
            convertString(mapVariable, value) ?? node.properties.fontFamily;
          break;
        }
        case "fontWeight": {
          (update ??= {}).fontWeight =
            convertString(mapVariable, value) ?? node.properties.fontWeight;
          break;
        }
        case "fontStyle": {
          (update ??= {}).fontStyle =
            convertString(mapVariable, value) ?? node.properties.fontStyle;
          break;
        }
        case "iconFontName": {
          (update ??= {}).iconFontName = convertString(mapVariable, value);
          break;
        }
        case "iconFontFamily": {
          (update ??= {}).iconFontFamily = convertString(mapVariable, value);
          break;
        }
        case "weight": {
          (update ??= {}).iconFontWeight = convertNumber(mapVariable, value);
          break;
        }
        case "polygonCount": {
          (update ??= {}).polygonCount = convertNumber(mapVariable, value);
          break;
        }

        case "rotation": {
          (update ??= {}).rotation =
            convertNumber(mapVariable, value, deserializeRotation) ??
            node.properties.rotation;
          break;
        }

        case "width": {
          convertWidth((update ??= {}), value); // TODO(zaza): variable support?
          break;
        }

        case "height": {
          convertHeight((update ??= {}), value); // TODO(zaza): variable support?
          break;
        }

        case "gap": {
          (update ??= {}).layoutChildSpacing = convertNumber(
            mapVariable,
            value,
          );
          break;
        }

        case "layout": {
          (update ??= {}).layoutMode = convertLayoutMode(value);
          break;
        }

        case "layoutIncludeStroke": {
          (update ??= {}).layoutIncludeStroke = value;
          break;
        }

        case "padding": {
          (update ??= {}).layoutPadding = convertPadding(mapVariable, value);
          break;
        }

        case "justifyContent": {
          (update ??= {}).layoutJustifyContent =
            convertLayoutJustifyContent(value) ?? JustifyContent.Start;
          break;
        }

        case "alignItems": {
          (update ??= {}).layoutAlignItems =
            convertLayoutAlignItems(value) ?? AlignItems.Start;
          break;
        }

        case "fill": {
          (update ??= {}).fills = convertFill(mapVariable, value);
          break;
        }
        case "effect": {
          (update ??= {}).effects = convertEffects(mapVariable, value);
          break;
        }
        case "content": {
          (update ??= {}).textContent = value; // TODO(zaza): variable support?
          break;
        }
        case "cornerRadius": {
          (update ??= {}).cornerRadius = convertCornerRadius(
            mapVariable,
            value,
          );
          break;
        }
        case "geometry": {
          (update ??= {}).pathData = value;
          break;
        }
        case "fillRule": {
          (update ??= {}).fillRule = value;
          break;
        }
        case "stroke": {
          convertStroke(mapVariable, (update ??= {}), value);
          break;
        }
        case "underline":
        case "href":
        case "metadata":
        case "strikethrough": {
          // text effects not implemented yet
          break;
        }

        default: {
          const missing: never = typedKey;
          reportError(new Error(`Unknown override property: ${missing}`));
          console.warn(`Unknown override property: ${missing}`);
          break;
        }
      }
    }
    if (update) {
      if (block) {
        block.update(node, update as any); // NOTE(zaza): casting to any due to Pick<Partial<T>, K> vs Partial<T>.
      } else {
        Object.assign(node.properties, update);
      }
    }
    for (const child of node.children) {
      const mappedChildId = mapChildId(child.id);
      applyOverrides(
        child,
        path && !child.isUnique
          ? node.isInstanceBoundary
            ? `${path}/${mappedChildId}`
            : replaceLastPathComponent(path, mappedChildId)
          : mappedChildId,
      );
    }
  };
  applyOverrides(node);
  return (unconsumedOverrides?.size ?? 0) !== 0
    ? Object.fromEntries(unconsumedOverrides!.entries())
    : undefined;
}

function indexData(
  node: Schema.Document["children"][0],
  index: Map<string, Schema.Document["children"][0]> = new Map(),
): Map<string, Schema.Document["children"][0]> {
  if (node.id.indexOf("/") !== -1) {
    throw new Error(`Invalid node id containing slash '${node.id}'!`);
  } else if (index.has(node.id)) {
    throw new Error(`Duplicate node id '${node.id}'!`);
  }
  index.set(node.id, node);
  if ((node.type === "frame" || node.type === "group") && node.children) {
    for (const child of node.children) {
      indexData(child, index);
    }
  } else if (node.type === "ref") {
    const childrenOverrides = getChildrenOverrides(node);
    if (childrenOverrides) {
      for (const child of childrenOverrides) {
        indexData(child, index);
      }
    } else if (node.descendants) {
      for (const [_path, overrides] of Object.entries(node.descendants)) {
        if (isStructuralOverride(overrides)) {
          indexData(overrides, index);
        } else {
          const childrenOverrides = getChildrenOverrides(overrides);
          if (childrenOverrides) {
            for (const child of childrenOverrides) {
              indexData(child, index);
            }
          }
        }
      }
    }
  }
  return index;
}

export function isStructuralOverride(
  overrides: object,
): overrides is Schema.Document["children"][0] {
  return "type" in overrides;
}

export function getChildrenOverrides(
  overrides: object,
): Schema.Document["children"] | undefined {
  return "children" in overrides ? (overrides.children as any) : undefined;
}

function canonicalizeDescendantPaths(
  ref: Pick<Schema.Ref, "descendants">,
  referencedNode: SceneNode,
) {
  ref.descendants =
    ref.descendants &&
    Object.fromEntries(
      Object.entries(ref.descendants).map(([path, overrides]) => {
        const canonicalizedPath = referencedNode.canonicalizePath(path);
        if (!canonicalizedPath) {
          throw new Error(
            `There is no '${path}' under '${referencedNode.id}'!`,
          );
        }
        return [canonicalizedPath, overrides];
      }),
    );
}

function collectInstancesToRebuild(
  node: SceneNode,
  visitedNodes = new Set<SceneNode>(),
  instancesToRebuild = new Map<string, SceneNode>(),
): Map<string, SceneNode> {
  if (visitedNodes.has(node)) {
    return instancesToRebuild;
  }
  visitedNodes.add(node);

  for (const instance of node.instances) {
    if (!instance.isUnique) {
      continue;
    }
    instancesToRebuild.set(instance.id, instance);
    collectInstancesToRebuild(instance, visitedNodes, instancesToRebuild);
  }

  if (node.parent) {
    collectInstancesToRebuild(node.parent, visitedNodes, instancesToRebuild);
  }

  return instancesToRebuild;
}

function replaceNode(
  block: ObjectUpdateBlock,
  oldNode: SceneNode,
  newNode: SceneNode,
) {
  const parent = oldNode.parent;
  if (!parent) {
    throw new Error(`No parent for node '${oldNode.id}'!`);
  }

  const childIndex = parent.childIndex(oldNode);
  block.deleteNode(oldNode, false);
  block.changeParent(newNode, parent, childIndex, false);
}

function firstPathComponent(path: string): string {
  const firstSlash = path.indexOf("/");
  return firstSlash === -1 ? path : path.substring(0, firstSlash);
}

function lastPathComponent(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash === -1 ? path : path.substring(lastSlash + 1);
}

function replaceLastPathComponent(path: string, replacement: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash === -1
    ? replacement
    : path.substring(0, lastSlash + 1).concat(replacement);
}

export function deserializeRotation(rotation: number): number {
  return -degToRad(rotation);
}

export function createNodeProperties(
  type: NodeType,
  customization: Partial<NodeProperties> = {},
): NodeProperties {
  return {
    enabled: true,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    rotation: 0,
    flipX: false,
    flipY: false,
    clip: false,
    opacity: 1,

    layoutJustifyContent: JustifyContent.Start,
    layoutAlignItems: AlignItems.Start,
    layoutMode: LayoutMode.None,
    placeholder: false,

    verticalSizing: SizingBehavior.Fixed,
    horizontalSizing: SizingBehavior.Fixed,

    ...(type === "frame"
      ? {
          layoutMode: LayoutMode.Horizontal,
          verticalSizing: SizingBehavior.FitContent,
          horizontalSizing: SizingBehavior.FitContent,
        }
      : {}),

    ...(type === "icon_font"
      ? {
          iconFontFamily: "Material Symbols Rounded",
        }
      : {}),

    ...(type === "note" || type === "prompt" || type === "context"
      ? {
          textAlign: "left",
          textAlignVertical: "top",
          fontSize: 16,
          letterSpacing: 0,
          fontFamily: "Inter",
          fontWeight: "400",
          fontStyle: "normal",
          textGrowth: "auto",
          lineHeight: 0,
        }
      : {
          textAlign: "left",
          textAlignVertical: "top",
          fontSize: 14,
          letterSpacing: 0,
          fontFamily: "Inter",
          fontWeight: "normal",
          fontStyle: "normal",
          textGrowth: "auto",
          lineHeight: 0,
        }),
    ...customization,
  };
}

export function deserializeVariableValue<T extends VariableType>(
  value: unknown,
  validate: (value: unknown) => boolean,
  resolveTheme: ([axis, value]: [string, string]) => [string, string],
): ThemedValue<T> {
  if (typeof value === "object") {
    if (value && "value" in value && validate(value.value)) {
      let theme: ReadonlyMap<string, string> | undefined;
      if ("theme" in value) {
        if (
          !value.theme ||
          typeof value.theme !== "object" ||
          Object.entries(value.theme).some(
            ([key, value]) =>
              typeof key !== "string" && typeof value !== "string",
          )
        ) {
          throw new Error(
            `Invalid variable theme: ${JSON.stringify(value.theme)}`,
          );
        }
        theme = new Map(Object.entries(value.theme).map(resolveTheme));
      }
      return { value: value.value as VariableValueType<T>, theme };
    }
  } else if (validate(value)) {
    return { value: value as VariableValueType<T> };
  }
  throw new Error(`Invalid variable value: ${JSON.stringify(value)}`);
}

export function deserializeVariableValues<T extends VariableType>(
  type: T,
  value: unknown,
  resolveTheme: ([axis, value]: [string, string]) => [string, string] = (t) =>
    t,
): ThemedValue<T>[] {
  let validate;
  switch (type) {
    case "color": {
      validate = (value: unknown) =>
        typeof value === "string" && value.charAt(0) === "#";
      break;
    }
    case "number": {
      validate = (value: unknown) =>
        typeof value === "number" && Number.isFinite(value);
      break;
    }
    case "boolean": {
      validate = (value: unknown) => value === "true" || value === "false";
      break;
    }
    case "string": {
      validate = (value: unknown) => typeof value === "string";
      break;
    }
  }

  if (typeof value === "object" && Array.isArray(value)) {
    return value.map((value) =>
      deserializeVariableValue(value, validate, resolveTheme),
    );
  } else {
    return [deserializeVariableValue(value, validate, resolveTheme)];
  }
}

function singleQuote(value: string): string {
  return `'${value}'`;
}

export function deserializeStretchMode(
  mode: Extract<Schema.Fill, { type: "image" }>["mode"],
): StretchMode | undefined {
  if (!mode) {
    return;
  }

  switch (mode) {
    case "fill":
      return StretchMode.Fill;
    case "fit":
      return StretchMode.Fit;
    case "stretch":
      return StretchMode.Stretch;
    default: {
      const missing: never = mode;
      logger.warn(`Unknown stretch mode: '${missing}'`);
      break;
    }
  }
}

function assert(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

type KeyOfAllCases<T> = T extends T ? keyof T : never;
type RefOverrideKey = KeyOfAllCases<
  Exclude<
    Schema.Document["children"][0],
    Schema.Ref | Schema.Prompt | Schema.Connection
  >
>;
