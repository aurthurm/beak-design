import type { SceneManager } from "../managers/scene-manager";
import type {
  ThemedValue,
  Variable,
  VariableType,
} from "../managers/variable-manager";
import {
  type Action,
  NodeChangeParentAction,
  NodeUpdateAction,
} from "./actions";
import type { NodeProperties } from "./scene-graph";
import type { SceneNode } from "./scene-node";

export class ObjectUpdateBlock {
  private manager: SceneManager;
  public rollback: Action[] = [];

  constructor(manager: SceneManager) {
    this.manager = manager;
  }

  update<K extends keyof NodeProperties>(
    node: SceneNode,
    data: Pick<NodeProperties, K>,
  ) {
    this.manager.scenegraph.unsafeApplyChanges(node, data, this.rollback);
  }

  deleteNode(node: SceneNode, updateInstances: boolean = true) {
    this.manager.scenegraph.unsafeRemoveNode(
      node,
      this.rollback,
      true,
      updateInstances,
    );
  }

  addNode(node: SceneNode, parent: SceneNode, index?: number) {
    this.manager.scenegraph.unsafeInsertNode(
      node,
      parent,
      index != null ? index : parent.children.length,
      this.rollback,
    );
  }

  changeParent(
    node: SceneNode,
    parent: SceneNode,
    index?: number,
    updateInstances: boolean = true,
  ) {
    this.manager.scenegraph.unsafeChangeParent(
      node,
      parent,
      index == null ? parent.children.length : index,
      this.rollback,
      updateInstances,
    );
  }

  clearChildren(node: SceneNode) {
    this.manager.scenegraph.unsafeClearChildren(node, this.rollback);
  }

  restoreInstanceChildren(node: SceneNode) {
    this.manager.scenegraph.unsafeRestoreInstanceChildren(node, this.rollback);
  }

  snapshotProperties<K extends keyof NodeProperties>(
    node: SceneNode,
    properties: K[],
  ) {
    const rollback: Partial<NodeProperties> = {};

    for (const key of properties) {
      rollback[key] = node.properties[key];
    }

    this.rollback.push(new NodeUpdateAction(node, rollback));
  }

  snapshotParent(node: SceneNode) {
    if (!node.parent) {
      return;
    }

    this.rollback.push(
      new NodeChangeParentAction(
        node,
        node.parent,
        node.parent?.childIndex(node),
      ),
    );
  }

  addVariable<T extends VariableType>(name: string, type: T): Variable<T> {
    return this.manager.variableManager.unsafeAddVariable(
      name,
      type,
      this.rollback,
    );
  }

  setVariable<T extends VariableType>(
    variable: Variable<T>,
    values: readonly ThemedValue<T>[],
  ) {
    variable.unsafeSetValues(values, this.rollback);
  }

  deleteVariable(name: string) {
    this.manager.variableManager.unsafeDeleteVariable(name, this.rollback);
  }

  renameVariable(oldName: string, newName: string) {
    this.manager.variableManager.unsafeRenameVariable(
      oldName,
      newName,
      this.rollback,
    );
  }

  setThemes(themes: ReadonlyMap<string, readonly string[]>) {
    this.manager.variableManager.unsafeSetThemes(themes, this.rollback);
  }
}
