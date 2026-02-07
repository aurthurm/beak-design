import type * as Schema from "@ha/schema";
import { type IPCHost, logger } from "@ha/shared";
import * as acorn from "acorn";
import PQueue from "p-queue";
import {
  FillType,
  type ObjectUpdateBlock,
  SceneGraph,
  StretchMode,
} from "../canvas";
import {
  getChildrenOverrides,
  isStructuralOverride,
  type SceneManager,
} from "../managers";
import type { SendAPIRequest } from "../types";
import { Validator } from "./operation-validator";

interface ParsedCall {
  callee: string;
  variable?: string;
  arguments: any[];
}

type OperationBindings = Map<string, string | undefined>;
type PreprocessedOperation = { original: string } & ParsedCall;
type BatchDesignToolCall = {
  bindings: OperationBindings;
  block: ObjectUpdateBlock;
  validator: Validator;
  failed: boolean;
  operationResponse: string;
  queue: PQueue;
};

export class BatchDesignProcessor {
  private sceneManager: SceneManager;
  private sendAPIRequest: SendAPIRequest;
  private toolCalls: Map<string, BatchDesignToolCall>;

  constructor(sceneManager: SceneManager, sendAPIRequest: SendAPIRequest) {
    this.sceneManager = sceneManager;
    this.sendAPIRequest = sendAPIRequest;
    this.toolCalls = new Map<string, BatchDesignToolCall>();
  }

  async process(
    ipc: IPCHost,
    partial: boolean,
    operations: string,
    id: string,
  ): Promise<{ message: string; success: boolean } | undefined> {
    const sceneManager = this.sceneManager;
    const shouldProcess = partial || (!partial && !this.toolCalls.has(id));
    const isFinal = !partial;

    let toolCall = this.toolCalls.get(id);
    if (!toolCall) {
      toolCall = {
        bindings: new Map([
          ["document", "document"],
          ["root", "document"],
        ]),
        block: sceneManager.scenegraph.beginUpdate(),
        validator: new Validator(sceneManager),
        failed: false,
        operationResponse: "",
        queue: new PQueue({ concurrency: 1 }),
      };
    }

    await toolCall.queue.add(async () => {
      if (shouldProcess && !toolCall.failed) {
        await this.processOperations(toolCall, ipc, operations);
        this.toolCalls.set(id, toolCall);
      }
    });

    if (isFinal) {
      if (toolCall.failed) {
        this.sceneManager.scenegraph.rollbackBlock(toolCall.block);
        return { message: toolCall.operationResponse, success: false };
      } else {
        // TODO(sedivy): Figure out better UX for LLM undo. Right now the undo
        // will be recorded together with normal user actions.
        this.sceneManager.scenegraph.commitBlock(toolCall.block, {
          undo: true,
        });

        return { message: this.createResponse(toolCall), success: true };
      }
    }

    return undefined;
  }

  private async processOperations(
    toolCall: BatchDesignToolCall,
    ipc: IPCHost,
    operations: string,
  ): Promise<void> {
    const sceneManager = this.sceneManager;
    let currentOperation = "";

    try {
      for (const op of preprocessOperations(
        sceneManager,
        toolCall.bindings,
        operations,
      )) {
        currentOperation = op.original;

        logger.debug("[batch-design] executing", {
          bindings: toolCall.bindings,
          ...op,
        });

        if (op.callee === "I") {
          await this.handleInsert(toolCall, op);
        } else if (op.callee === "C") {
          await this.handleCopy(toolCall, op);
        } else if (op.callee === "R") {
          await this.handleReplace(toolCall, op);
        } else if (op.callee === "M") {
          await this.handleMove(toolCall, op);
        } else if (op.callee === "D") {
          await this.handleDelete(toolCall, op);
        } else if (op.callee === "U") {
          await this.handleUpdate(toolCall, op);
        } else if (op.callee === "G") {
          await this.handleGenerateImage(toolCall, ipc, op);
        }
      }
    } catch (err: any) {
      console.error(
        "[batch-design] failed to execute operation:",
        currentOperation,
        err,
      );

      toolCall.failed = true;
      toolCall.operationResponse = this.createFailedResponse(
        currentOperation,
        err.toString(),
      );
    }
  }

  private createFailedResponse(
    currentOperation: string,
    errorMessage: string,
  ): string {
    const currentOperationMessage = currentOperation
      ? `\n\nFailed to execute the operation: \`${currentOperation}\``
      : "";

    return `## Failure during operation execution ${currentOperationMessage}: ${errorMessage}\n\nAll operations in this block have been rolled back. Fix the issue and run \`batch_design\` again.`;
  }

  private createResponse(toolCall: BatchDesignToolCall): string {
    let response = "# Successfully executed all operations.\n";

    if (toolCall.operationResponse !== "") {
      response += `\n## Operation results:\n${toolCall.operationResponse}`;
    }

    const bindingNames = [...toolCall.bindings.keys()].filter(
      (b) => !["document", "root"].includes(b),
    );

    if (bindingNames.length > 0) {
      response += `\n## The following bindings are NO LONGER AVAILABLE to use:\n${bindingNames.map((n) => `\`${n}\``).join(", ")}\n`;
    }

    const validationResult = toolCall.validator.result();
    if (validationResult) {
      response += `\n${validationResult}\n`;
    }

    return response;
  }

  private async handleInsert(
    toolCall: BatchDesignToolCall,
    op: PreprocessedOperation,
  ): Promise<void> {
    const parentId = parseParentParam(op.arguments[0], toolCall.bindings);
    const data = op.arguments[1];
    mapBindingsIntoPaths(data, toolCall.bindings);

    if (op.variable && data.name === undefined) {
      data.name = op.variable;
    }

    const insertedNodes = this.sceneManager.fileManager.insertNodes(
      toolCall.block,
      parentId,
      undefined,
      [data],
      true,
    );
    const insertedNode = insertedNodes[0];

    if (op.variable) {
      toolCall.bindings.set(op.variable, insertedNode.id);
    }

    const serializedNode = this.sceneManager.fileManager.serializeNode(
      insertedNode,
      {
        maxDepth: 2,
        includePathGeometry: false,
        resolveVariables: false,
        resolveInstances: false,
      },
    );

    // TODO(sedivy): Validate all nested children and their input data as well.
    toolCall.validator.validateInputProperties(insertedNodes[0], data, true);

    toolCall.operationResponse += `- Inserted node \`${insertedNode.id}\`: \`${JSON.stringify(serializedNode)}\`\n`;
  }

  private async handleCopy(
    toolCall: BatchDesignToolCall,
    op: PreprocessedOperation,
  ): Promise<void> {
    const toCopy = mapPathWithBindings(op.arguments[0], toolCall.bindings);
    const parentId = parseParentParam(op.arguments[1], toolCall.bindings);
    const fromNode = op.arguments[2];
    mapBindingsIntoPaths(fromNode, toolCall.bindings);

    if (op.variable && fromNode.name === undefined) {
      fromNode.name = op.variable;
    }

    fromNode.id = toCopy;

    const copyNode = this.sceneManager.fileManager.copyNode(
      toolCall.block,
      parentId,
      undefined,
      fromNode,
    );

    this.sceneManager.scenegraph.updateLayout();

    if (fromNode.positionPadding || fromNode.positionDirection) {
      const bounds = copyNode.getTransformedLocalBounds();

      const findSpaceResult =
        this.sceneManager.scenegraph.findEmptySpaceAroundNode(
          copyNode,
          bounds.width,
          bounds.height,
          fromNode.positionPadding ?? 0,
          fromNode.positionDirection ?? "right",
        );

      // NOTE(sedivy): We don't need to set the parentID from findSpaceResult
      // because it should return the same parent. If we were to use the result
      // on a different node than what was the input to the function, then we
      // need to set the parent.
      copyNode.layoutCommitPosition(findSpaceResult.x, findSpaceResult.y);
    }

    if (op.variable) {
      toolCall.bindings.set(op.variable, copyNode.id);
    }

    const serializedNode = this.sceneManager.fileManager.serializeNode(
      copyNode,
      {
        maxDepth: 2,
        includePathGeometry: false,
        resolveVariables: false,
        resolveInstances: false,
      },
    );

    toolCall.validator.validateInputProperties(copyNode, fromNode, true);

    toolCall.operationResponse += `- Copied node \`${copyNode.id}\`: \`${JSON.stringify(serializedNode)}\`\n`;
  }

  private async handleReplace(
    toolCall: BatchDesignToolCall,
    op: PreprocessedOperation,
  ): Promise<void> {
    const toReplace = mapPathWithBindings(op.arguments[0], toolCall.bindings);
    const data = op.arguments[1];
    mapBindingsIntoPaths(data, toolCall.bindings);

    if (op.variable && data.name === undefined) {
      data.name = op.variable;
    }

    const node = this.sceneManager.scenegraph.getNodeByPath(
      this.sceneManager.scenegraph.canonicalizePath(toReplace) ?? toReplace,
    );
    if (!node) {
      throw new Error(`No such node to replace with path '${toReplace}'!`);
    }

    const replacedNode = this.sceneManager.fileManager.replaceNode(
      toolCall.block,
      node,
      data,
    );

    toolCall.validator.validateInputProperties(node, data, true);

    if (op.variable) {
      toolCall.bindings.set(op.variable, replacedNode.id);
    }

    const serializedNode = this.sceneManager.fileManager.serializeNode(
      replacedNode,
      {
        maxDepth: 2,
        includePathGeometry: false,
        resolveVariables: false,
        resolveInstances: false,
      },
    );

    // TODO(sedivy): Should we return the replaced node? There is currently
    // a bug where the LLM tries to use old node IDs after doing a replace
    // call. Returning the data would inform the LLM about the new structure.

    toolCall.operationResponse += `- Repalced node \`${toReplace}\` with \`${replacedNode.id}\`, replaced node data: \`${JSON.stringify(serializedNode)}\`\n`;
  }

  private async handleMove(
    toolCall: BatchDesignToolCall,
    op: PreprocessedOperation,
  ): Promise<void> {
    const toMove = mapPathWithBindings(op.arguments[0], toolCall.bindings);
    const parentId = op.arguments[1]
      ? parseParentParam(op.arguments[1], toolCall.bindings)
      : undefined;
    const index = op.arguments[2];

    const node = this.sceneManager.scenegraph.getNodeByPath(
      this.sceneManager.scenegraph.canonicalizePath(toMove) ?? toMove,
    );
    if (!node) {
      throw new Error(`No such node to move with id '${toMove}'!`);
    }

    const originalParent = node.parent;

    this.sceneManager.fileManager.moveNodes(toolCall.block, [
      {
        node: node,
        index: index,
        parentId: parentId,
      },
    ]);

    // NOTE(sedivy): Validate the original parent layout because the move
    // could cause the layout to collapse.
    if (originalParent) {
      toolCall.validator.queueLayoutValidation(originalParent);
    }

    toolCall.validator.queueLayoutValidation(node);

    toolCall.operationResponse += `- Moved node \`${node.id}\` under \`${parentId}\`\n`;
  }

  private async handleDelete(
    toolCall: BatchDesignToolCall,
    op: PreprocessedOperation,
  ): Promise<void> {
    const toDelete = mapPathWithBindings(op.arguments[0], toolCall.bindings);

    const node = this.sceneManager.scenegraph.getNodeByPath(
      this.sceneManager.scenegraph.canonicalizePath(toDelete) ?? toDelete,
    );

    if (node) {
      if (node.parent?.prototype && !node.parent.prototype.childrenOverridden) {
        throw new Error(
          `Cannot delete descendants of instances: '${JSON.stringify(node.parent?.prototype)}'`,
        );
      }

      // NOTE(sedivy): Validate the parent layout because the deletion could
      // cause the layout to collapse.
      if (node.parent) {
        toolCall.validator.queueLayoutValidation(node.parent);
      }

      toolCall.block.deleteNode(node);

      toolCall.operationResponse += `- Deleted node \`${node.id}\`\n`;
    } else {
      console.warn(`[batch-design] No such node to delete: ${toDelete}`);
    }
  }

  private async handleUpdate(
    toolCall: BatchDesignToolCall,
    op: PreprocessedOperation,
  ): Promise<void> {
    const pathParam = mapPathWithBindings(op.arguments[0], toolCall.bindings);
    const data = op.arguments[1];
    mapBindingsIntoPaths(data, toolCall.bindings);

    const path =
      this.sceneManager.scenegraph.canonicalizePath(pathParam) ?? pathParam;

    const updatedNode = this.sceneManager.scenegraph.getNodeByPath(path);
    if (!updatedNode) {
      throw new Error(`Node '${path}' not found!`);
    }

    this.sceneManager.fileManager.updateNodeProperties(
      toolCall.block,
      updatedNode,
      data,
    );

    toolCall.validator.validateInputProperties(updatedNode, data, false);

    toolCall.operationResponse += `- Updated properties of node \`${updatedNode.id}\`\n`;
  }

  private async handleGenerateImage(
    toolCall: BatchDesignToolCall,
    ipc: IPCHost,
    op: PreprocessedOperation,
  ): Promise<void> {
    const path = mapPathWithBindings(op.arguments[0], toolCall.bindings);
    const type = op.arguments[1];
    const prompt = op.arguments[2];

    if (!path) {
      throw new Error("`path` property is required for G operation!");
    }

    if (!type || (type !== "ai" && type !== "stock")) {
      throw new Error(
        "`type` property must be 'ai' or 'stock' for G operation!",
      );
    }

    if (!prompt) {
      throw new Error("`prompt` property is required for G operation!");
    }

    const resolvedNodeId = mapPathWithBindings(path, toolCall.bindings);

    const node = this.sceneManager.scenegraph.getNodeByPath(
      this.sceneManager.scenegraph.canonicalizePath(resolvedNodeId) ??
        resolvedNodeId,
    );
    if (!node) {
      throw new Error(`Node '${path}' not found for G operation!`);
    }

    if (!node.supportsImageFill()) {
      throw new Error(`Node '${path}' does not support image fills!`);
    }

    let imageUrl: string;

    if (type === "ai") {
      const { success, image } = await this.sendAPIRequest(
        "POST",
        "generate-image",
        { prompt: prompt },
      );

      if (!success || !image) {
        throw new Error(`Failed to generate AI image for prompt "${prompt}"`);
      }

      const { relativePath } = await ipc.request<
        { image: string },
        { relativePath: string }
      >("save-generated-image", { image });

      imageUrl = relativePath;

      // AI-generated image - no attribution metadata
      toolCall.block.update(node, {
        fills: [
          {
            enabled: true,
            type: FillType.Image,
            url: imageUrl,
            mode: StretchMode.Fill,
            opacityPercent: 100,
          },
        ],
      });
    } else {
      // stock image
      const { success, image } = await this.sendAPIRequest(
        "POST",
        "get-stock-image",
        { prompt: prompt },
      );

      if (!success || !image) {
        throw new Error(`No stock image found for prompt "${prompt}"`);
      }

      imageUrl = image.url;

      toolCall.block.update(node, {
        fills: [
          {
            enabled: true,
            type: FillType.Image,
            url: imageUrl,
            mode: StretchMode.Fill,
            opacityPercent: 100,
          },
        ],
        metadata: {
          type: "unsplash",
          username: image.attribution?.username,
          link: image.attribution?.link,
          author: image.attribution?.name,
        },
      });
    }

    logger.info(`Successfully applied ${type} image to node ${node.id}`);

    toolCall.operationResponse += `- Added image to node \`${node.id}\` with prompt: \`${prompt}\`\n`;
  }
}

function preprocessOperations(
  sceneManager: SceneManager,
  bindings: OperationBindings,
  operations: string,
): PreprocessedOperation[] {
  const preprocessedOperations: PreprocessedOperation[] = [];
  const ast = acorn.parse(operations, { ecmaVersion: 2020 }) as any;
  const ops: ParsedCall[] = ast.body.map((statement: any) =>
    parseStatement(statement),
  );

  for (const op of ops) {
    const operation = JSON.stringify(op);

    if (op === undefined) {
      throw new Error(`could not parse operation: \`${operation}\``);
    }

    if ((op.callee === "I" || op.callee === "C") && !op.variable) {
      logger.warn(
        `Insert (I) and Copy (C) operation requires a binding name (e.g., bindingName=I("parent", {...})). Operation: \`${operation}\``,
      );
    }

    switch (op.callee) {
      case "I":
      case "R": {
        generateIdsIfNeeded(
          op.arguments[op.arguments.length - 1],
          sceneManager.scenegraph,
          bindings,
        );
        break;
      }
      case "C":
      case "U": {
        generateIdsForUpdatesIfNeeded(
          op.arguments[op.arguments.length - 1],
          sceneManager.scenegraph,
          bindings,
        );
        break;
      }
    }

    preprocessedOperations.push({
      original: operation,
      ...op,
    });
  }

  return preprocessedOperations;
}

function generateIdsForUpdatesIfNeeded(
  updates: Partial<Schema.Document["children"][0]>,
  sceneGraph: SceneGraph,
  bindings: OperationBindings,
) {
  if (updates.type) {
    generateIdsIfNeeded(updates, sceneGraph, bindings);
  } else {
    if ("descendants" in updates) {
      for (const [_, descendantUpdates] of Object.entries(
        updates.descendants ?? {},
      )) {
        generateIdsForUpdatesIfNeeded(descendantUpdates, sceneGraph, bindings);
      }
    }
    if ("children" in updates) {
      for (const child of updates.children) {
        generateIdsIfNeeded(child, sceneGraph, bindings);
      }
    }
  }
}

function generateIdsIfNeeded(
  node: Partial<Schema.Document["children"][0]>,
  sceneGraph: SceneGraph,
  bindings: OperationBindings,
) {
  const newNodeId = SceneGraph.createUniqueID();

  if (node.id?.length) {
    console.log("[batch-design] setting binding to new id", node.id, newNodeId);
    bindings.set(node.id, newNodeId);
  }

  node.id = newNodeId;

  if ((node.type === "frame" || node.type === "group") && node.children) {
    for (const child of node.children) {
      generateIdsIfNeeded(child, sceneGraph, bindings);
    }
  } else if (node.type === "ref") {
    const childrenOverrides = getChildrenOverrides(node);
    if (childrenOverrides) {
      for (const child of childrenOverrides) {
        generateIdsIfNeeded(child, sceneGraph, bindings);
      }
    } else if (node.descendants) {
      for (const [_path, overrides] of Object.entries(node.descendants)) {
        if (isStructuralOverride(overrides)) {
          generateIdsIfNeeded(overrides, sceneGraph, bindings);
        } else {
          const childrenOverrides = getChildrenOverrides(overrides);
          if (childrenOverrides) {
            for (const child of childrenOverrides) {
              generateIdsIfNeeded(child, sceneGraph, bindings);
            }
          }
        }
      }
    }
  }
}

function parseParentParam(
  path: string,
  bindings: OperationBindings,
): string | undefined {
  if (["document", "root", "#document", "#root"].includes(path)) {
    return undefined;
  } else {
    return mapPathWithBindings(path, bindings);
  }
}

function mapPathWithBindings(
  path: string,
  bindings: OperationBindings,
): string {
  return path
    .split("/")
    .map((c) => {
      if (c.startsWith("#")) {
        const name = c.slice(1);
        if (!bindings.has(name)) {
          throw new Error(`binding variable ${name} not found`);
        }

        return bindings.get(name);
      }

      return c;
    })
    .join("/");
}

function mapBindingsIntoPaths(
  node: Partial<Schema.Document["children"][0]>,
  bindings: OperationBindings,
) {
  if ((node.type === "frame" || node.type === "group") && node.children) {
    for (const child of node.children) {
      mapBindingsIntoPaths(child, bindings);
    }
  } else if (node.type === "ref") {
    if (node.ref) {
      node.ref = mapPathWithBindings(node.ref, bindings);
    }

    const childrenOverrides = getChildrenOverrides(node);
    if (childrenOverrides) {
      for (const child of childrenOverrides) {
        mapBindingsIntoPaths(child, bindings);
      }
    } else if (node.descendants) {
      node.descendants = Object.fromEntries(
        Object.entries(node.descendants).map(([path, overrides]) => [
          mapPathWithBindings(path, bindings),
          overrides,
        ]),
      );

      for (const [_path, overrides] of Object.entries(node.descendants)) {
        if (isStructuralOverride(overrides)) {
          mapBindingsIntoPaths(overrides, bindings);
        } else {
          const childrenOverrides = getChildrenOverrides(overrides);
          if (childrenOverrides) {
            for (const child of childrenOverrides) {
              mapBindingsIntoPaths(child, bindings);
            }
          }
        }
      }
    }
  }
}

function parseStatement(statement: any): ParsedCall {
  // Handle variable assignment
  if (
    statement.type === "ExpressionStatement" &&
    statement.expression.type === "AssignmentExpression"
  ) {
    const { left, right } = statement.expression;
    return {
      callee: right.callee.name,
      variable: left.name,
      arguments: right.arguments.map(astNodeToValue),
    };
  }

  // Handle direct call
  if (
    statement.type === "ExpressionStatement" &&
    statement.expression.type === "CallExpression"
  ) {
    return {
      callee: statement.expression.callee.name,
      arguments: statement.expression.arguments.map(astNodeToValue),
    };
  }

  throw new Error("Unexpected statement type");
}

function astNodeToValue(node: any): any {
  switch (node.type) {
    case "Literal":
      return node.value;

    case "Identifier": {
      if (node.name === "undefined") {
        return undefined;
      }

      return `#${node.name}`;
    }

    case "BinaryExpression": {
      let expr = "";
      if (node.operator === "+") {
        expr +=
          node.left.type === "Identifier"
            ? `#${node.left.name}`
            : node.left.value;
        expr +=
          node.right.type === "Identifier"
            ? `/#${node.right.name}`
            : node.right.value;
      }
      return expr;
    }

    case "ObjectExpression": {
      const obj: Record<string, any> = {};
      for (const prop of node.properties) {
        if (prop.type === "Property") {
          const key =
            prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
          obj[key] = astNodeToValue(prop.value);
        }
      }
      return obj;
    }

    case "ArrayExpression":
      return node.elements.map((el: any) => (el ? astNodeToValue(el) : null));

    case "UnaryExpression": {
      // Handle -5, +5, !true, etc.
      const arg = astNodeToValue(node.argument);
      switch (node.operator) {
        case "-":
          return -arg;
        case "+":
          return +arg;
        case "!":
          return !arg;
        default:
          return arg;
      }
    }

    case "TemplateLiteral":
      return node.quasis.map((q: any) => q.value.cooked).join("");

    default:
      // For complex expressions, return the identifier/expression as-is
      return node.name || `<${node.type}>`;
  }
}
