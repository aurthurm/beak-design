import type { SceneManager } from "../managers/scene-manager";
import type { Variable } from "../managers/variable-manager";
import type { NodeProperties } from "./scene-graph";
import type { SceneNode } from "./scene-node";

export interface Action {
  perform(manager: SceneManager, undo: Action[] | null): void;
}

export class NodeUpdateAction implements Action {
  node: SceneNode;
  values: Partial<NodeProperties>;

  constructor(node: SceneNode, values: Partial<NodeProperties>) {
    this.node = node;
    this.values = values;
  }

  perform(manager: SceneManager, undo: Action[] | null) {
    manager.scenegraph.unsafeApplyChanges(this.node, this.values, undo);
  }
}

export class NodeAddAction implements Action {
  node: SceneNode;
  childIndex: number;
  parent: SceneNode;

  constructor(node: SceneNode, parent: SceneNode, childIndex: number) {
    this.node = node;
    this.parent = parent;
    this.childIndex = childIndex;
  }

  perform(manager: SceneManager, undo: Action[] | null) {
    manager.scenegraph.unsafeInsertNode(
      this.node,
      this.parent,
      this.childIndex,
      undo,
    );
  }
}

export class NodeDeleteAction implements Action {
  node: SceneNode;

  constructor(node: SceneNode) {
    this.node = node;
  }

  perform(manager: SceneManager, undo: Action[] | null) {
    manager.scenegraph.unsafeRemoveNode(this.node, undo, true);
  }
}

export class NodeChangeParentAction implements Action {
  node: SceneNode;
  parent: SceneNode | null;
  childIndex: number | null;

  constructor(
    node: SceneNode,
    parent: SceneNode | null,
    childIndex: number | null,
  ) {
    this.node = node;
    this.parent = parent;
    this.childIndex = childIndex;
  }

  perform(manager: SceneManager, undo: Action[] | null) {
    manager.scenegraph.unsafeChangeParent(
      this.node,
      this.parent,
      this.childIndex,
      undo,
    );
  }
}

export class VariableUpdateAction implements Action {
  variable: Variable<any>;
  value: any;

  constructor(variable: Variable<any>, value: any) {
    this.variable = variable;
    this.value = value;
  }

  perform(manager: SceneManager, undo: Action[] | null) {
    this.variable.unsafeSetValues(this.value, undo);
  }
}

export class FunctionAction implements Action {
  action: (manager: SceneManager, undo: Action[] | null) => void;

  constructor(action: typeof this.action) {
    this.action = action;
  }

  perform(manager: SceneManager, undo: Action[] | null) {
    this.action(manager, undo);
  }
}
