import type { IPCHost } from "@ha/shared";
import EventEmitter from "eventemitter3";
import { NodeUtils } from "./canvas/node-utils";
import type { SceneNode } from "./canvas/scene-node";
import { serializeRotation } from "./canvas/serializer";
import {
  createClipboardDataFromNodes,
  pasteClipboardData,
  validateClipboardData,
} from "./clipboard.js";
import { setErrorReportCallback } from "./error-reporter";
import { deserializeVariableValues } from "./managers/file-manager";
import { SceneManager } from "./managers/scene-manager";
import type {
  ReplacePropertyMap,
  UniquePropertyKeys,
} from "./property-search-and-replace";
import { loadSkia } from "./skia";
import { SkiaRenderer } from "./skia-renderer";
import { BatchDesignProcessor } from "./tool-handlers/batch-design";
import { handleGetEditorState } from "./tool-handlers/get-editor-state";
import {
  handleGetStyleGuide,
  handleGetStyleGuideTags,
} from "./tool-handlers/get-style-guide";
import type {
  CanvasKitConfig,
  Input,
  PencilCanvas,
  PencilConfig,
  PixiManagerAdapter,
  SendAPIRequest,
} from "./types";
import { arrayBufferToBase64 } from "./util";
import type { Bounds } from "./utils/bounds";

interface PencilEditorEvents {
  telemetry: (event: { name: string; args?: object }) => void;
  "did-change-cursor": (cursor: string) => void;
}

interface SearchPattern {
  type?: string;
  name?: string;
  reusable?: boolean;
}

interface ToolResponseWithMessage {
  success: boolean;
  result?: { message: string };
  error: string;
}

export class PencilEditor extends EventEmitter<PencilEditorEvents> {
  private _initialized = false;
  private _sceneManager: SceneManager | undefined;

  get initialized(): boolean {
    return this._initialized;
  }

  get sceneManager(): SceneManager | undefined {
    return this._sceneManager;
  }

  setInput(input: Input): void {
    if (!this._sceneManager) {
      return;
    }

    this._sceneManager.setInput(input);
  }

  async setup(o: {
    canvas: PencilCanvas;
    pixiManager: PixiManagerAdapter;
    containerBounds: Bounds;
    colorScheme: string;
    ipc: IPCHost;
    sendAPIRequest: SendAPIRequest;
    canvasKitConfig: CanvasKitConfig;
    config: PencilConfig;
    errorReportCallback: (error: unknown) => void;
  }): Promise<void> {
    const {
      canvas,
      containerBounds,
      colorScheme,
      ipc,
      sendAPIRequest,
      pixiManager,
      canvasKitConfig,
      config,
      errorReportCallback,
    } = o;

    setErrorReportCallback(errorReportCallback);

    this._sceneManager = new SceneManager(
      containerBounds,
      colorScheme,
      pixiManager,
      ipc,
      config,
    );

    await loadSkia(canvasKitConfig);

    this._sceneManager.skiaRenderer = new SkiaRenderer(
      this._sceneManager,
      canvas,
    );

    this._sceneManager.resize(containerBounds.width, containerBounds.height);
    this._sceneManager.setActiveTool("move");

    // NOTE(sedivy): Load default fonts.
    const matchedFont = this._sceneManager.skiaRenderer.fontManager.matchFont(
      "Inter",
      400,
      false,
    );
    if (matchedFont) {
      this._sceneManager.skiaRenderer.fontManager.loadFont(matchedFont);
    }

    await this._sceneManager.skiaRenderer.fontManager.waitForAllFontsLoaded();
    this._sceneManager.requestFrame();
    await this.initializeIPC(ipc, sendAPIRequest);

    this._sceneManager.eventEmitter.on("didChangeCursor", (cursor) => {
      this.emit("did-change-cursor", cursor);
    });

    this._initialized = true;
  }

  onDidResizeContainer(rect: Bounds): void {
    if (!this.initialized || !this.sceneManager) {
      return;
    }

    this.sceneManager.onDidResizeContainer(rect);
  }

  private async initializeIPC(
    ipc: IPCHost,
    sendAPIRequest: SendAPIRequest,
  ): Promise<void> {
    if (!this._sceneManager) {
      throw new Error("Editor not yet set up");
    }

    const sceneManager = this._sceneManager;
    const batchDesignProcessor = new BatchDesignProcessor(
      sceneManager,
      sendAPIRequest,
    );

    ipc.handle<
      { operations: string; id?: string; partial: boolean },
      ToolResponseWithMessage
    >("batch-design", async (message) => {
      const toolUseID =
        !message.id || message.id === ""
          ? `tool-use-${Date.now()}`
          : message.id;

      const response = await batchDesignProcessor.process(
        ipc,
        message.partial,
        message.operations,
        toolUseID,
      );

      if (response) {
        if (response.success) {
          this.emit("telemetry", { name: "batch-design" });
        } else {
          this.emit("telemetry", {
            name: "batch-design-failed",
            args: { error: response.message },
          });
        }

        return {
          success: response.success,
          result: { message: response.success ? response.message : "" },
          error: response.success ? "" : response.message,
        };
      }

      return {
        success: false,
        error: "",
      };
    });

    ipc.handle<unknown, ToolResponseWithMessage>(
      "get-style-guide-tags",
      async () => {
        this.emit("telemetry", { name: "get-style-guide-tags" });
        try {
          const msg = await handleGetStyleGuideTags(sendAPIRequest);

          return { success: true, result: { message: msg }, error: "" };
        } catch (error) {
          this.emit("telemetry", {
            name: "get-style-guide-tags-failed",
            args: { error },
          });

          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to execute get-style-guide-tags!",
          };
        }
      },
    );

    ipc.handle<{ tags: string[]; id?: string }, ToolResponseWithMessage>(
      "get-style-guide",
      async (message) => {
        this.emit("telemetry", { name: "get-style-guide" });
        try {
          const msg = await handleGetStyleGuide(
            message.tags,
            message.id,
            sendAPIRequest,
          );

          return { success: true, result: { message: msg }, error: "" };
        } catch (error) {
          this.emit("telemetry", {
            name: "get-style-guide-failed",
            args: { error },
          });

          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to execute get-style-guide!",
          };
        }
      },
    );

    ipc.handle<
      {
        patterns: SearchPattern[] | undefined;
        nodeIds: string[] | undefined;
        includePathGeometry: boolean;
        resolveVariables: boolean;
        resolveInstances: boolean;
        readDepth?: number;
        searchDepth?: number;
        parentId?: string;
      },
      { success: boolean; error: string; result: any }
    >(
      "search-design-nodes",
      ({
        patterns,
        parentId,
        searchDepth,
        nodeIds,
        readDepth,
        includePathGeometry,
        resolveInstances,
        resolveVariables,
      }) => {
        this.emit("telemetry", { name: "search-design-nodes" });

        try {
          const parent = parentId
            ? sceneManager.scenegraph.getNodeByPath(parentId)
            : sceneManager.scenegraph.getViewportNode();
          if (!parent) {
            throw new Error(`No node with id '${parentId}'!`);
          }

          let nodeIdsToRead: string[] = [];

          if (patterns) {
            for (const pattern of patterns) {
              const { type, name, reusable } = pattern;
              const nameRegExp = name ? new RegExp(name, "i") : undefined;

              const collectResults = (
                node: SceneNode,
                searchDepth?: number,
              ) => {
                if (
                  searchDepth === 0 ||
                  (node.prototype && node.id === node.prototype.node.id)
                ) {
                  return;
                }
                if (
                  (type === undefined || node.type === type) &&
                  (nameRegExp === undefined ||
                    node.properties.resolved.name?.match(nameRegExp)) &&
                  (reusable === undefined || node.reusable === reusable)
                ) {
                  nodeIdsToRead.push(node.id);
                  // sceneManager.skiaRenderer.addFlashForNode(node, {
                  //   color: [200 / 255, 200 / 255, 200 / 255],
                  //   scanLine: false,
                  // });
                }
                for (const child of node.children) {
                  collectResults(child, searchDepth && searchDepth - 1);
                }
              };
              for (const child of parent.children) {
                collectResults(child, searchDepth);
              }
            }
          }

          if (nodeIds) {
            nodeIdsToRead = [...nodeIdsToRead, ...nodeIds];
          }

          // If no patterns and no nodeIds, return top-level children
          if (
            (!patterns || patterns.length === 0) &&
            (!nodeIds || nodeIds.length === 0)
          ) {
            nodeIdsToRead = parent.children.map((child) => child.id);
          }

          const nodes = nodeIdsToRead.map((id) => {
            id = sceneManager.scenegraph.canonicalizePath(id) ?? id;
            const node = sceneManager.scenegraph.getNodeByPath(id);
            if (!node) {
              throw new Error(`No node with id '${id}'!`);
            }

            sceneManager.skiaRenderer.addFlashForNode(node, {
              longHold: true,
            });

            return sceneManager.fileManager.serializeNode(node, {
              maxDepth: readDepth,
              includePathGeometry,
              resolveVariables,
              resolveInstances,
            });
          });

          return { success: true, error: "", result: { nodes } };
        } catch (error) {
          this.emit("telemetry", {
            name: "search-design-nodes-failed",
            args: { error },
          });

          // TODO(sedivy): We could rollback the update block to revert all changes caused by this call.
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to search for nodes!",
            result: null,
          };
        }
      },
    );

    ipc.handle<
      { parents: string[]; properties: UniquePropertyKeys[] },
      { success: boolean; error: string }
    >("search-all-unique-properties", (message) => {
      this.emit("telemetry", { name: "search-all-unique-properties" });

      try {
        const roots = [];

        for (const id of message.parents) {
          const found = sceneManager.scenegraph.getNodeByPath(id);
          if (!found) {
            throw new Error(`Failed to find a node with id ${id}`);
          }

          if (found.root) {
            for (const child of found.children) {
              sceneManager.skiaRenderer.addFlashForNode(child, {
                longHold: true,
              });
            }
          } else {
            sceneManager.skiaRenderer.addFlashForNode(found, {
              longHold: true,
            });
          }

          roots.push(found);
        }

        const result = sceneManager.scenegraph.searchUniqueProperties(
          roots,
          message.properties,
        );
        return { result: result, success: true, error: "" };
      } catch (error) {
        this.emit("telemetry", {
          name: "search-all-unique-properties-failed",
          args: { error },
        });

        // TODO(sedivy): We could rollback the update block to revert all changes caused by this call.
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to find unique properties!",
        };
      }
    });

    ipc.handle<
      { parents: string[]; properties: ReplacePropertyMap },
      { success: boolean; error: string }
    >("replace-all-matching-properties", (message) => {
      this.emit("telemetry", { name: "replace-all-matching-properties" });

      const block = sceneManager.scenegraph.beginUpdate();

      try {
        const roots = [];

        for (const id of message.parents) {
          const found = sceneManager.scenegraph.getNodeByPath(id);
          if (!found) {
            throw new Error(`Failed to find a node with id ${id}`);
          }

          sceneManager.skiaRenderer.addFlashForNode(found);

          roots.push(found);
        }

        sceneManager.scenegraph.replaceProperties(
          block,
          roots,
          message.properties,
        );

        return { success: true, error: "" };
      } catch (error) {
        this.emit("telemetry", {
          name: "replace-all-matching-properties-failed",
          args: { error },
        });

        // TODO(sedivy): We could rollback the update block to revert all changes caused by this call.
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to replace all matching properties!",
        };
      } finally {
        sceneManager.scenegraph.commitBlock(block, { undo: true });
      }
    });

    ipc.handle<
      {
        nodeId: string;
        width: number;
        height: number;
        padding: number;
        direction: "top" | "right" | "bottom" | "left";
      },
      {
        success: boolean;
        error: string;
        result?: { x: number; y: number; parentId?: string };
      }
    >("find-empty-space-around-node", (message) => {
      this.emit("telemetry", { name: "find-empty-space-around-node" });

      try {
        const node = sceneManager.scenegraph.getNodeByPath(message.nodeId);
        if (!node) {
          throw new Error(`Failed to find a node with id ${message.nodeId}`);
        }

        const result = sceneManager.scenegraph.findEmptySpaceAroundNode(
          node,
          message.width,
          message.height,
          message.padding,
          message.direction,
        );

        {
          let point = { x: result.x, y: result.y };

          if (result.parent && !result.parent.root) {
            point = result.parent.getWorldMatrix().apply(point);
          }

          sceneManager.skiaRenderer.addFlash(
            point.x,
            point.y,
            message.width,
            message.height,
            {
              longHold: true,
              color: [200 / 255, 200 / 255, 200 / 255],
            },
          );
        }

        return {
          success: true,
          error: "",
          result: {
            x: result.x,
            y: result.y,
            parentId: result.parent?.id,
          },
        };
      } catch (error) {
        this.emit("telemetry", {
          name: "find-empty-space-around-node-failed",
          args: { error },
        });

        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to find empty space around node!",
        };
      }
    });

    ipc.handle<
      { parentId?: string; maxDepth?: number; problemsOnly?: boolean },
      { success: boolean; error: string; result?: any }
    >("snapshot-layout", ({ parentId, maxDepth, problemsOnly }) => {
      this.emit("telemetry", { name: "snapshot-layout" });

      try {
        const parent = parentId
          ? sceneManager.scenegraph.getNodeByPath(parentId)
          : sceneManager.scenegraph.getViewportNode();
        if (!parent) {
          throw new Error(`Failed to find a node with id ${parentId}`);
        }

        const snapshotLayout = (
          node: SceneNode,
          maxDepth?: number,
          problemsOnly?: boolean,
        ): any => {
          const bounds = node.getTransformedLocalBounds();
          const layout: any = {
            id: node.path,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          };

          const parent = node.parent;
          if (parent && !parent.root && !parent.includesNode(node)) {
            layout.problems = parent.overlapsNode(node)
              ? "partially clipped"
              : "fully clipped";
          }

          if (node.properties.resolved.rotation) {
            layout.rotation = serializeRotation(
              node.properties.resolved.rotation,
            );
          }
          if (node.children.length !== 0) {
            if (maxDepth === undefined || maxDepth > 0) {
              layout.children = node.children
                .map((child) =>
                  snapshotLayout(child, maxDepth && maxDepth - 1, problemsOnly),
                )
                .filter(Boolean);
            } else {
              layout.children = "...";
            }
          }
          return problemsOnly &&
            !layout.problems &&
            (maxDepth === 0 || (layout.children ?? []).length === 0)
            ? undefined
            : layout;
        };

        for (const child of parent.children) {
          sceneManager.skiaRenderer.addFlashForNode(child, {
            longHold: true,
          });
        }

        let nodes;
        if (parent.root) {
          nodes = parent.children
            .map((child) => snapshotLayout(child, maxDepth, problemsOnly))
            .filter(Boolean);
          if (problemsOnly && nodes.length === 0) {
            nodes = "No layout problems.";
          }
        } else {
          nodes = snapshotLayout(parent, maxDepth, problemsOnly);
          if (problemsOnly && !nodes) {
            nodes = "No layout problems.";
          }
        }

        return {
          success: true,
          error: "",
          result: { nodes },
        };
      } catch (error) {
        this.emit("telemetry", {
          name: "snapshot-layout-failed",
          args: { error },
        });

        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to snapshot layout!",
        };
      }
    });

    ipc.handle<
      { nodeId: string },
      { success: boolean; error: string; result?: any }
    >("get-screenshot", async ({ nodeId }) => {
      this.emit("telemetry", { name: "get-screenshot" });

      try {
        const node = sceneManager.scenegraph.getNodeByPath(nodeId);
        if (!node) {
          throw new Error(`Failed to find a node with id ${nodeId}`);
        }

        sceneManager.skiaRenderer.addFlashForNode(node, {
          longHold: true,
        });

        const pngBytes = await sceneManager.skiaRenderer.exportToPNG([node], {
          dpi: 1,
          maxResolution: 512,
        });

        return {
          success: true,
          error: "",
          result: {
            image: arrayBufferToBase64(pngBytes),
            mimeType: "image/png",
          },
        };
      } catch (error) {
        this.emit("telemetry", {
          name: "get-screenshot-failed",
          args: { error },
        });

        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to get screenshot!",
        };
      }
    });

    ipc.handle<undefined, { success: boolean; error: string; result?: any }>(
      "export-viewport",
      async () => {
        this.emit("telemetry", { name: "export-viewport" });

        try {
          const nodesToExport =
            sceneManager.scenegraph.getViewportNode().children;

          if (nodesToExport.length === 0) {
            throw new Error("No nodes to export");
          }

          // ---------------------------------------------------------------------
          // TODO(sedivy): Right now we don't have a good way to pre-load all
          // the assets before we render the document. So right now we need to
          // do this dirty throw away render to queue up the async tasks to wait
          // for them for the real export.
          await sceneManager.skiaRenderer.exportToPNG(nodesToExport, {
            dpi: 1,
            maxResolution: 10,
          });
          await sceneManager.skiaRenderer.fontManager.waitForAllFontsLoaded();
          // ---------------------------------------------------------------------

          // This is the export that we want, ^^^ section is workaround to get fonts correctly in this export
          const pngBytes = await sceneManager.skiaRenderer.exportToPNG(
            nodesToExport,
            {
              dpi: 1,
              maxResolution: 2048,
            },
          );

          return {
            success: true,
            error: "",
            result: {
              image: arrayBufferToBase64(pngBytes),
              mimeType: "image/png",
            },
          };
        } catch (error) {
          this.emit("telemetry", {
            name: "export-viewport-failed",
            args: { error },
          });

          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to export viewport!",
          };
        }
      },
    );

    ipc.handle<undefined, { success: boolean; error: string; result?: any }>(
      "get-variables",
      async () => {
        this.emit("telemetry", { name: "get-variables" });

        try {
          const variables = sceneManager.variableManager.variables;
          const themes = sceneManager.variableManager.themes;

          // Convert variables to serializable format (remove circular references)
          const serializedVariables: Record<string, any> = {};
          for (const [key, variable] of variables.entries()) {
            serializedVariables[key] = {
              name: variable.name,
              type: variable.type,
              values: variable.values,
            };
          }

          const result = {
            success: true,
            error: "",
            result: {
              variables: serializedVariables,
              themes: Object.fromEntries(themes),
            },
          };

          return result;
        } catch (error) {
          this.emit("telemetry", {
            name: "get-variables-failed",
            args: { error },
          });

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: errorMessage || "Unknown error",
          };
        }
      },
    );

    ipc.handle<
      { replace: boolean; variables: any },
      { success: boolean; error: string; result?: any }
    >("set-variables", async ({ replace, variables }) => {
      this.emit("telemetry", { name: "set-variables" });

      const block = sceneManager.scenegraph.beginUpdate();
      try {
        if (replace) {
          for (const variable of [
            ...sceneManager.variableManager.variables.values(),
          ]) {
            block.deleteVariable(variable.name);
          }
          const clearThemeForNode = (node: SceneNode) => {
            if (node.properties.theme) {
              block.update(node, { theme: undefined });
            }
            node.children.forEach(clearThemeForNode);
          };
          clearThemeForNode(sceneManager.scenegraph.getViewportNode());
          block.setThemes(new Map());
        }

        for (const [name, definition] of Object.entries(variables)) {
          if (!definition || typeof definition !== "object") {
            throw new Error(
              `Variable '${name}' does not have a valid definition: ${JSON.stringify(definition)}`,
            );
          } else if (!("type" in definition)) {
            throw new Error(
              `Variable '${name}' is missing its 'type' property!`,
            );
          } else if (
            typeof definition.type !== "string" ||
            !["color", "string", "number"].includes(definition.type)
          ) {
            throw new Error(
              `Variable '${name}' has an invalid 'type' property: ${JSON.stringify(definition.type)}`,
            );
          } else if (!("value" in definition)) {
            throw new Error(
              `Variable '${name}' is missing its 'value' property!`,
            );
          }
          const properType = definition.type as "color" | "number" | "string";
          const variable =
            sceneManager.variableManager.getVariable(name, properType) ??
            block.addVariable(name, properType);
          block.setVariable(
            variable,
            variable.values.concat(
              deserializeVariableValues(properType, definition.value),
            ),
          );
        }

        const themes = new Map(
          sceneManager.variableManager.themes
            .entries()
            .map(([axis, values]) => [axis, [...values]]),
        );
        for (const variable of sceneManager.variableManager.variables.values()) {
          for (const { theme } of variable.values) {
            if (theme) {
              for (const [axis, value] of theme) {
                const values = themes.get(axis);
                if (!values) {
                  themes.set(axis, [value]);
                } else if (!values.includes(value)) {
                  values.push(value);
                }
              }
            }
          }
        }
        block.setThemes(themes);

        sceneManager.scenegraph.commitBlock(block, { undo: true });
        return {
          success: true,
          result: {
            message: "Successfully set variables.",
          },
          error: "",
        };
      } catch (error) {
        this.emit("telemetry", {
          name: "set-variables-failed",
          args: { error },
        });

        sceneManager.scenegraph.rollbackBlock(block);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to set variables! Make sure to set variables in the correct format according to the .pen file schema returned by the `general` guidelines.",
        };
      }
    });

    ipc.handle<undefined, { success: boolean; error: string; result?: any }>(
      "get-selection",
      async () => {
        this.emit("telemetry", { name: "get-selection" });

        try {
          const bounds = sceneManager.selectionManager.getWorldspaceBounds();
          if (bounds) {
            sceneManager.skiaRenderer.addFlash(
              bounds.x,
              bounds.y,
              bounds.width,
              bounds.height,
              { longHold: false },
            );
          }

          const ids: string[] = [];

          for (const node of sceneManager.selectionManager.selectedNodes) {
            ids.push(node.id);

            sceneManager.skiaRenderer.addFlashForNode(node, {
              longHold: false,
              scanLine: false,
            });
          }

          return {
            success: true,
            error: "",
            result: {
              selectedElementIds: ids,
            },
          };
        } catch (error) {
          this.emit("telemetry", {
            name: "get-selection-failed",
            args: { error },
          });

          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to get selection!",
          };
        }
      },
    );

    ipc.handle("get-guidelines", async () => {
      this.emit("telemetry", { name: "get-guidelines" });
      return {
        success: true,
        result: {},
      };
    });

    ipc.handle<unknown, ToolResponseWithMessage>(
      "get-editor-state",
      async () => {
        this.emit("telemetry", { name: "get-editor-state" });

        try {
          const message = handleGetEditorState(sceneManager);

          return {
            success: true,
            error: "",
            result: { message },
          };
        } catch (error) {
          this.emit("telemetry", {
            name: "get-editor-state-failed",
            args: { error },
          });

          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to get editor state!",
          };
        }
      },
    );

    // Copy nodes by ID and return clipboard JSON
    ipc.handle<
      { nodeIds: string[] },
      { success: boolean; error?: string; clipboardData?: string }
    >("copy-nodes-by-id", async ({ nodeIds }) => {
      this.emit("telemetry", { name: "copy-nodes-by-id" });

      try {
        const nodes = nodeIds.map((id) => {
          const node = sceneManager.scenegraph.getNodeByPath(id);
          if (!node) {
            throw new Error(`No such node for id: ${id}`);
          }
          return node;
        });
        const viewport = sceneManager.scenegraph.getViewportNode();
        const nodesToCopy = NodeUtils.getTopLevelNodes(nodes, viewport);

        const clipboardData = createClipboardDataFromNodes(
          nodesToCopy,
          sceneManager.fileManager,
          sceneManager.variableManager,
          sceneManager.selectionManager.clipboardSourceId,
        );

        return {
          success: true,
          result: {
            clipboardData: JSON.stringify(clipboardData),
          },
        };
      } catch (error) {
        this.emit("telemetry", {
          name: "copy-nodes-by-id-failed",
          args: { error },
        });

        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to copy nodes by ID!",
        };
      }
    });

    ipc.handle<unknown, { success: boolean; error: string; result?: any }>(
      "internal-export-top-level-nodes",
      async () => {
        try {
          const topLevelNodes =
            sceneManager.scenegraph.getViewportNode().children;
          if (topLevelNodes.length === 0) {
            throw new Error("Failed to find a top level nodes in document");
          }

          const pngBytes = await sceneManager.skiaRenderer.exportToPNG(
            topLevelNodes,
            {
              dpi: 1,
              maxResolution: 1920,
            },
          );

          return {
            success: true,
            error: "",
            result: {
              image: pngBytes,
            },
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to export top level nodes!",
          };
        }
      },
    );

    ipc.handle<{ clipboardData: string }, { success: boolean; error?: string }>(
      "paste-clipboard-data",
      async ({ clipboardData }) => {
        this.emit("telemetry", { name: "paste-clipboard-data" });

        const block = sceneManager.scenegraph.beginUpdate();
        try {
          const data = JSON.parse(clipboardData);

          if (!validateClipboardData(data)) {
            throw new Error("Invalid clipboard data structure");
          }

          const viewport = sceneManager.scenegraph.getViewportNode();

          pasteClipboardData(
            data,
            sceneManager.scenegraph,
            sceneManager.variableManager,
            viewport,
            block,
            sceneManager.selectionManager.clipboardSourceId,
          );

          sceneManager.scenegraph.commitBlock(block, { undo: true });

          return {
            success: true,
          };
        } catch (error) {
          this.emit("telemetry", {
            name: "paste-clipboard-data-failed",
            args: { error },
          });

          sceneManager.scenegraph.rollbackBlock(block);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to paste clipboard data!",
          };
        }
      },
    );

    ipc.on("undo", () => {
      sceneManager.undoManager.undo();
    });

    ipc.on("redo", () => {
      sceneManager.undoManager.redo();
    });
  }
}
