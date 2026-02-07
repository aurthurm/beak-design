import {
  type Action,
  FunctionAction,
  VariableUpdateAction,
} from "../canvas/actions";
import { NodePropertyKeys } from "../canvas/scene-graph";
import type { SceneNode } from "../canvas/scene-node";
import { isHeadlessMode } from "../platform";
import type { SceneManager } from "./scene-manager";

export type Value<T extends Single<VariableType>> =
  | VariableValueType<T>
  | Variable<T>;

export type Theme = ReadonlyMap<string, string>;

export function themesEqual(a: Theme, b: Theme) {
  if (a === b) {
    return true;
  } else if (a.size !== b.size) {
    return false;
  } else {
    return a.entries().every(([key, value]) => b.get(key) === value);
  }
}

export type ThemedValue<T extends VariableType> = {
  value: VariableValueType<T>;
  theme?: Theme;
};

export type VariableType = "boolean" | "number" | "color" | "string";

export type VariableValueType<T extends VariableType> = T extends "boolean"
  ? boolean
  : T extends "number"
    ? number
    : T extends "color"
      ? string
      : T extends "string"
        ? string
        : never;

export type VariableRuntimeType<T extends Single<VariableType>> =
  T extends "boolean"
    ? "boolean"
    : T extends "number"
      ? "number"
      : T extends "color"
        ? "string"
        : T extends "string"
          ? "string"
          : never;

export type Single<T, U extends T = T> = U extends any
  ? [T] extends [U]
    ? never
    : U
  : never;

export type VariableChangeListener = () => void;
export abstract class Variable<T extends Single<VariableType>> {
  abstract readonly name: string;
  abstract readonly type: T;
  abstract readonly values: ReadonlyArray<ThemedValue<T>>;
  abstract readonly defaultValue: VariableValueType<T>;

  abstract getValue(theme: Theme): VariableValueType<T>;
  abstract unsafeSetValues(
    values: readonly ThemedValue<T>[],
    undo: Action[] | null,
  ): void;

  abstract addListener(listener: VariableChangeListener): void;
  abstract removeListener(listener: VariableChangeListener): void;
}

class VariableImpl<T extends Single<VariableType>> extends Variable<T> {
  name: string;
  readonly type: T;

  private _values: readonly ThemedValue<T>[] = [];
  get values(): ReadonlyArray<ThemedValue<T>> {
    return this._values;
  }
  private _listeners: VariableChangeListener[] = [];

  constructor(name: string, type: T) {
    super();
    this.name = name;
    this.type = type;
  }

  get defaultValue(): VariableValueType<T> {
    switch (this.type) {
      case "boolean":
        return false as VariableValueType<T>;
      case "number":
        return 0 as VariableValueType<T>;
      case "color":
        return "#000000" as VariableValueType<T>;
      case "string":
        return "" as VariableValueType<T>;
      default:
        throw new Error(
          `Missing default value for variable type: '${this.type}'`,
        );
    }
  }

  getValue(theme: Theme): VariableValueType<T> {
    for (let i = this._values.length - 1; i >= 0; i--) {
      const value = this._values[i];
      if (
        !value.theme ||
        value.theme.entries().every(([key, value]) => theme.get(key) === value)
      ) {
        return value.value;
      }
    }
    return this.defaultValue;
  }

  unsafeSetValues(values: readonly ThemedValue<T>[], undo: Action[] | null) {
    undo?.push(new VariableUpdateAction(this, this._values));

    this._values = values;

    for (const listener of [...this._listeners]) {
      listener();
    }
  }

  addListener(listener: VariableChangeListener) {
    this._listeners.push(listener);
  }

  removeListener(listener: VariableChangeListener) {
    const index = this._listeners.indexOf(listener);
    if (index === -1) {
      throw new Error(`No such listener on variable '${this.name}'!`);
    }
    this._listeners.splice(index, 1);
  }
}

export type Resolved<T> =
  T extends Variable<"color">
    ? string
    : T extends Variable<"string">
      ? string
      : T extends Variable<"number">
        ? number
        : T extends Variable<"boolean">
          ? boolean
          : T extends string | number | boolean | null | undefined | Function
            ? T
            : { [K in keyof T]: Resolved<T[K]> };

export type ValueWithResolved<T> = { value: T; resolved: Resolved<T> };

export type VariablesChangeListener = () => void;
export class VariableManager {
  private readonly sceneManager: SceneManager;
  private _listeners: VariablesChangeListener[] = [];
  private _themes: ReadonlyMap<string, readonly string[]> = new Map();
  get themes(): ReadonlyMap<string, ReadonlyArray<string>> {
    return this._themes;
  }
  private _variables: Map<string, VariableImpl<VariableType>> = new Map();
  get variables(): ReadonlyMap<string, Variable<VariableType>> {
    return this._variables;
  }

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;

    if (!isHeadlessMode) {
      (window as any).__VARIABLE_MANAGER = this;
    }
  }

  addListener(listener: VariablesChangeListener) {
    this._listeners.push(listener);
  }

  removeListener(listener: VariablesChangeListener) {
    const index = this._listeners.indexOf(listener);
    if (index === -1) {
      throw new Error(`No such listener!`);
    }
    this._listeners.splice(index, 1);
  }

  unsafeSetThemes(themes: typeof this._themes, undo: Action[] | null) {
    const oldThemes = this._themes;
    undo?.push(
      new FunctionAction((_manager, undo) =>
        this.unsafeSetThemes(oldThemes, undo),
      ),
    );

    this._themes = structuredClone(themes);
    this.sceneManager.scenegraph.getViewportNode().properties.theme =
      this.getDefaultTheme();

    this._listeners.forEach((listener) => {
      listener();
    });
  }

  getDefaultTheme(): ReadonlyMap<string, string> {
    return new Map(
      this._themes
        .entries()
        .filter(([_key, value]) => value.length !== 0)
        .map(([key, value]) => [key, value[0]]),
    );
  }

  unsafeAddVariable<T extends VariableType>(
    name: string,
    type: T,
    undo: Action[] | null,
  ): Variable<T> {
    const variable = new VariableImpl(name, type);
    this.unsafeAddVariableInstance(variable, undo);
    return variable;
  }

  unsafeDeleteVariable(name: string, undo: Action[] | null) {
    const variable = this._variables.get(name);
    if (!variable) {
      throw new Error(`No such variable: '${name}'`);
    }
    this.unsafeDeleteVariableInstance(variable, undo);
  }

  private unsafeAddVariableInstance<T extends VariableType>(
    variable: VariableImpl<T>,
    undo: Action[] | null,
  ) {
    this._variables.set(variable.name, variable);
    undo?.push(
      new FunctionAction((_manager, undo) =>
        this.unsafeDeleteVariableInstance(variable, undo),
      ),
    );

    this._listeners.forEach((listener) => {
      listener();
    });
  }

  private unsafeDeleteVariableInstance<T extends VariableType>(
    variable: VariableImpl<T>,
    undo: Action[] | null,
  ) {
    const resolveVariable = (node: SceneNode) => {
      for (const key of NodePropertyKeys) {
        const value = node.properties[key];
        const resolved = node.properties.resolveVariable(value, variable);
        if (!Object.is(value, resolved)) {
          (node.properties as any)[key] = resolved;
          undo?.push(
            new FunctionAction((_manager, _undo) => {
              (node.properties as any)[key] = value;
            }),
          );
        }
      }
      node.children.forEach(resolveVariable);
    };
    resolveVariable(this.sceneManager.scenegraph.getViewportNode());
    this._variables.delete(variable.name);
    undo?.push(
      new FunctionAction((_manager, undo) =>
        this.unsafeAddVariableInstance(variable, undo),
      ),
    );

    this._listeners.forEach((listener) => {
      listener();
    });
  }

  unsafeRenameVariable(
    oldName: string,
    newName: string,
    undo: Action[] | null,
  ) {
    const variable = this._variables.get(oldName);
    if (!variable) {
      throw new Error(`No such variable: '${oldName}'`);
    }
    this._variables.delete(oldName);
    variable.name = newName;
    this._variables.set(newName, variable);

    undo?.push(
      new FunctionAction((_manager, undo) =>
        this.unsafeRenameVariable(newName, oldName, undo),
      ),
    );

    this._listeners.forEach((listener) => {
      listener();
    });
  }

  getVariable<T extends Single<VariableType>>(
    name: string,
    type: T,
  ): Variable<T> | undefined {
    const variable = this._variables.get(name);
    if (!variable) {
      return undefined;
    } else if (variable.type !== type) {
      throw new Error(
        `Variable '${name}' has type '${variable.type}' (expected '${type}')`,
      );
    } else {
      return variable as unknown as Variable<T>;
    }
  }

  clear() {
    this._listeners.length = 0;
    this._themes = new Map();
    this._variables.clear();
  }
}
