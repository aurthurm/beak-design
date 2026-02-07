import { ChevronDown, EllipsisIcon, PlusIcon, XIcon } from "lucide-react";
import React from "react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { cn, firstAvailableName } from "../lib/utils";
import { useSceneManager } from "../pages/Editor";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import type {
  Variable,
  VariableManager,
  VariableType,
  VariableValueType,
  SceneNode,
} from "@ha/pencil-editor";
import { InputIcon } from "../components/input-icon";
import { throttle } from "lodash";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import {
  DuplicateIcon,
  MoveIcon,
  RenameIcon,
  TrashIcon,
  VariableColorIcon,
  VariableNumberIcon,
  VariableStringIcon,
} from "../components/icons";
import { createPortal } from "react-dom";

interface VariablesPanelProps {
  onClose: () => void;
  propertiesPanelWidth?: number;
  layersListPanelWidth?: number;
}

type ThemeAxis = { name: string; values: string[] };
type ThemeAxes = ThemeAxis[];

type Action =
  | {
      type: "replace";
      themeAxes: ThemeAxes;
      currentThemeAxis?: ThemeAxis;
      variables: Variable<any>[];
    }
  | {
      type: "merge";
      themeAxes: ThemeAxes;
      allVariables: Variable<any>[];
    };

const TOOLBAR_WIDTH = 40;

export default function VariablesPanel({
  onClose,
  propertiesPanelWidth = 0,
  layersListPanelWidth = 0,
}: VariablesPanelProps): React.JSX.Element {
  const variableIDs = useRef(new Map<Variable<any>, string>());
  const getIDForVariable = useMemo(
    () => (variable: Variable<any>) => {
      let id = variableIDs.current.get(variable);
      if (!id) {
        id = crypto.randomUUID();
        variableIDs.current.set(variable, id);
      }
      return id;
    },
    [],
  );

  const sceneManager = useSceneManager();
  const variableManager = sceneManager.variableManager;
  const [{ themeAxes, currentThemeAxis, variables }, dispatch] = useReducer(
    (state, action: Action) => {
      switch (action.type) {
        case "merge": {
          let themeAxes;
          const themeAxesByName = new Map(
            action.themeAxes.map((axis) => [axis.name, axis]),
          );
          if (
            state.themeAxes.length === action.themeAxes.length &&
            state.themeAxes.every((axis) => themeAxesByName.has(axis.name))
          ) {
            themeAxes = state.themeAxes.map(
              (axis) => themeAxesByName.get(axis.name)!,
            );
          } else {
            themeAxes = action.themeAxes;
          }
          const currentThemeAxis =
            themeAxes.find(
              ({ name }) => name === state.currentThemeAxis?.name,
            ) ?? (themeAxes.length !== 0 ? themeAxes[0] : undefined);
          return {
            themeAxes,
            currentThemeAxis,
            variables: getVariablesForThemeAxis(
              action.allVariables,
              currentThemeAxis,
              themeAxes,
            ),
          };
        }
        case "replace":
          return {
            themeAxes: action.themeAxes,
            currentThemeAxis: action.currentThemeAxis,
            variables: action.variables,
          };
      }
      return state;
    },
    null,
    () => {
      const themeAxes = getThemeAxes(variableManager);
      const currentThemeAxis =
        themeAxes.length === 0 ? undefined : themeAxes[0];
      const variables = getVariablesForThemeAxis(
        [...variableManager.variables.values()],
        currentThemeAxis,
        themeAxes,
      );
      return { themeAxes, currentThemeAxis, variables };
    },
  );

  useEffect(() => {
    dispatch({
      type: "replace",
      themeAxes,
      currentThemeAxis,
      variables: getVariablesForThemeAxis(
        [...variableManager.variables.values()],
        currentThemeAxis,
        themeAxes,
      ),
    });
  }, [variableManager, currentThemeAxis, themeAxes]);
  const refresh = useCallback(() => {
    dispatch({
      type: "merge",
      themeAxes: getThemeAxes(variableManager),
      allVariables: [...variableManager.variables.values()],
    });
  }, [variableManager]);
  useEffect(() => {
    const listener = () => refresh();
    variableManager.addListener(listener);
    return () => variableManager.removeListener(listener);
  }, [variableManager, refresh]);
  const handleVariableRename = useCallback(
    (variable: Variable<any>, name: string): boolean => {
      if (variableManager.variables.has(name)) {
        return false;
      }
      const block = sceneManager.scenegraph.beginUpdate();
      block.renameVariable(variable.name, name);
      sceneManager.scenegraph.commitBlock(block, { undo: true });

      dispatch({ type: "replace", themeAxes, currentThemeAxis, variables });
      return true;
    },
    [variableManager, themeAxes, currentThemeAxis, variables],
  );
  const [variableToEditName, setVariableToEditName] = useState<
    Variable<any> | undefined
  >();
  const [variableToScrollTo, setVariableToScrollTo] = useState<
    Variable<any> | undefined
  >();
  const handleAddVariable = useCallback(
    (type: Exclude<VariableType, "boolean">) => {
      const block = sceneManager.scenegraph.beginUpdate();
      const variable = block.addVariable(
        firstAvailableName(type, (name) => variableManager.variables.has(name)),
        type,
      );
      block.setVariable(
        variable,
        currentThemeAxis?.values.map((value) => ({
          value: variable.defaultValue,
          theme: new Map([[currentThemeAxis.name, value]]),
        })) ?? [{ value: variable.defaultValue }],
      );
      sceneManager.scenegraph.commitBlock(block, { undo: true });

      setVariableToEditName(variable);
      dispatch({
        type: "replace",
        themeAxes,
        currentThemeAxis,
        variables: [...variables, variable],
      });
    },
    [variableManager, variables, currentThemeAxis, themeAxes],
  );
  const handleAddThemeAxis = useCallback(() => {
    const newThemes = new Map(variableManager.themes);
    if (newThemes.size === 0) {
      newThemes.set("Theme", ["Default"]);
    }
    const newAxis = firstAvailableName("Theme", (theme) =>
      newThemes.has(theme),
    );
    const newAxisValues = ["Default"];
    newThemes.set(newAxis, newAxisValues);
    const block = sceneManager.scenegraph.beginUpdate();
    block.setThemes(newThemes);
    sceneManager.scenegraph.commitBlock(block, { undo: true });

    const newThemeAxis = { name: newAxis, values: newAxisValues };

    dispatch({
      type: "replace",
      themeAxes: [
        ...(themeAxes.length === 0
          ? [{ name: "Theme", values: ["Default"] }]
          : themeAxes),
        newThemeAxis,
      ],
      currentThemeAxis: newThemeAxis,
      variables: variables,
    });
  }, [variableManager, themeAxes, variables]);
  const handleAddThemeValue = useCallback(() => {
    const newValue = firstAvailableName(
      "Variant",
      (name) => currentThemeAxis?.values.includes(name) ?? false,
    );
    const newAxis = {
      name: currentThemeAxis?.name ?? "Theme",
      values: [...(currentThemeAxis?.values ?? ["Default"]), newValue],
    };

    const duplicatedAxisValue = newAxis.values[newAxis.values.length - 2];
    const block = sceneManager.scenegraph.beginUpdate();
    const newThemes = new Map(variableManager.themes);
    newThemes.set(newAxis.name, newAxis.values);
    block.setThemes(newThemes);
    for (const variable of variables) {
      block.setVariable(
        variable,
        newAxis.values.map((value) => ({
          value: resolveVariable(variableManager, variable, {
            name: newAxis.name,
            value: value === newValue ? duplicatedAxisValue : value,
          }),
          theme: new Map([[newAxis.name, value]]),
        })),
      );
    }
    sceneManager.scenegraph.commitBlock(block, { undo: true });

    let newThemeAxes;
    if (currentThemeAxis) {
      const index = themeAxes.indexOf(currentThemeAxis);
      newThemeAxes = themeAxes.toSpliced(index, 1, newAxis);
    } else {
      newThemeAxes = [newAxis];
    }

    dispatch({
      type: "replace",
      themeAxes: newThemeAxes,
      currentThemeAxis: newAxis,
      variables: variables,
    });
  }, [variableManager, themeAxes, currentThemeAxis, variables]);
  const handleVariableDelete = useCallback(
    (variable: Variable<any>) => {
      const block = sceneManager.scenegraph.beginUpdate();
      block.deleteVariable(variable.name);
      sceneManager.scenegraph.commitBlock(block, { undo: true });
      dispatch({
        type: "replace",
        themeAxes,
        currentThemeAxis,
        variables: variables.toSpliced(variables.indexOf(variable), 1),
      });
    },
    [themeAxes, currentThemeAxis, variables],
  );
  const handleVariableDuplicate = useCallback(
    (variable: Variable<any>) => {
      const block = sceneManager.scenegraph.beginUpdate();
      const newVariable = block.addVariable(
        firstAvailableName(variable.type, (name) =>
          variableManager.variables.has(name),
        ),
        variable.type,
      );
      block.setVariable(newVariable, structuredClone(variable.values));
      sceneManager.scenegraph.commitBlock(block, { undo: true });

      setVariableToEditName(newVariable);

      dispatch({
        type: "replace",
        themeAxes,
        currentThemeAxis,
        variables: [...variables, newVariable],
      });
    },
    [variableManager, themeAxes, currentThemeAxis, variables],
  );
  const handleVariableMove = useCallback(
    (variable: Variable<any>, themeAxis: (typeof themeAxes)[0]) => {
      const block = sceneManager.scenegraph.beginUpdate();
      block.setVariable(
        variable,
        themeAxis.values.map((themeValue) => ({
          value: resolveVariable(variableManager, variable, {
            name: themeAxis.name,
            value: themeValue,
          }),
          theme: new Map([[themeAxis.name, themeValue]]),
        })),
      );
      sceneManager.scenegraph.commitBlock(block, { undo: true });

      setVariableToScrollTo(variable);

      dispatch({
        type: "replace",
        themeAxes,
        currentThemeAxis: themeAxis,
        variables: variables.toSpliced(variables.indexOf(variable, 1)),
      });
    },
    [sceneManager.scenegraph, variableManager, themeAxes, variables],
  );
  const handleRenameThemeValue = useCallback(
    (oldValue: string, newValue: string) => {
      const block = sceneManager.scenegraph.beginUpdate();
      block.setThemes(
        new Map(
          variableManager.themes
            .entries()
            .map(([themeAxis, values]) =>
              themeAxis === currentThemeAxis?.name
                ? [
                    themeAxis,
                    values.toSpliced(values.indexOf(oldValue), 1, newValue),
                  ]
                : [themeAxis, values],
            ),
        ),
      );

      const replaceInSceneNode = (node: SceneNode) => {
        if (
          node.properties.theme &&
          node.properties.theme.get(currentThemeAxis!.name) === oldValue
        ) {
          const theme = new Map(node.properties.theme);
          theme.set(currentThemeAxis!.name, newValue);
          block.update(node, { theme });
        }
        node.children.forEach(replaceInSceneNode);
      };
      replaceInSceneNode(sceneManager.scenegraph.getViewportNode());

      for (const variable of variables) {
        block.setVariable(
          variable,
          variable.values.map(({ value, theme }) => ({
            value,
            theme:
              theme &&
              new Map(
                theme
                  .entries()
                  .map(([themeAxis, themeValue]) => [
                    themeAxis,
                    themeAxis === currentThemeAxis?.name &&
                    themeValue === oldValue
                      ? newValue
                      : themeValue,
                  ]),
              ),
          })),
        );
      }
      sceneManager.scenegraph.commitBlock(block, { undo: true });

      const updatedCurrentThemeAxis = structuredClone(currentThemeAxis!);
      updatedCurrentThemeAxis.values.splice(
        updatedCurrentThemeAxis.values.indexOf(oldValue),
        1,
        newValue,
      );

      dispatch({
        type: "replace",
        themeAxes: themeAxes.toSpliced(
          themeAxes.indexOf(currentThemeAxis!),
          1,
          updatedCurrentThemeAxis,
        ),
        currentThemeAxis: updatedCurrentThemeAxis,
        variables,
      });
    },
    [
      sceneManager.scenegraph,
      variableManager,
      currentThemeAxis,
      themeAxes,
      variables,
    ],
  );
  const handleDeleteThemeValue = useCallback(
    (deletedValue: string) => {
      const block = sceneManager.scenegraph.beginUpdate();

      const newThemes = new Map(
        variableManager.themes
          .entries()
          .map(([themeAxis, values]) =>
            themeAxis === currentThemeAxis?.name
              ? [themeAxis, values.toSpliced(values.indexOf(deletedValue), 1)]
              : [themeAxis, values],
          ),
      );
      for (const variable of variables) {
        block.setVariable(
          variable,
          newThemes.get(currentThemeAxis!.name)!.map((themeValue) => ({
            value: resolveVariable(variableManager, variable, {
              name: currentThemeAxis!.name,
              value: themeValue,
            }),
            theme: new Map([[currentThemeAxis!.name, themeValue]]),
          })),
        );
      }
      block.setThemes(newThemes);

      const replaceInSceneNode = (node: SceneNode) => {
        if (
          node.properties.theme?.get(currentThemeAxis!.name) === deletedValue
        ) {
          const theme = new Map(node.properties.theme);
          theme.delete(currentThemeAxis!.name);
          block.update(node, { theme });
        }
        node.children.forEach(replaceInSceneNode);
      };
      replaceInSceneNode(sceneManager.scenegraph.getViewportNode());
      sceneManager.scenegraph.commitBlock(block, { undo: true });

      const updatedCurrentThemeAxis = structuredClone(currentThemeAxis!);
      updatedCurrentThemeAxis.values.splice(
        updatedCurrentThemeAxis.values.indexOf(deletedValue),
        1,
      );

      dispatch({
        type: "replace",
        themeAxes: themeAxes.toSpliced(
          themeAxes.indexOf(currentThemeAxis!),
          1,
          updatedCurrentThemeAxis,
        ),
        currentThemeAxis: updatedCurrentThemeAxis,
        variables,
      });
    },
    [
      sceneManager.scenegraph,
      variableManager,
      currentThemeAxis,
      themeAxes,
      variables,
    ],
  );
  const handleRenameThemeAxis = useCallback(
    (themeAxis: (typeof themeAxes)[0], newName: string) => {
      const block = sceneManager.scenegraph.beginUpdate();

      block.setThemes(
        new Map(
          variableManager.themes
            .entries()
            .map(([name, values]) =>
              name === themeAxis.name ? [newName, values] : [name, values],
            ),
        ),
      );
      const replaceInSceneNode = (node: SceneNode) => {
        if (node.properties.theme?.has(themeAxis.name)) {
          const theme = new Map(node.properties.theme);
          theme.set(newName, theme.get(themeAxis.name)!);
          theme.delete(themeAxis.name);
          block.update(node, { theme });
        }
        node.children.forEach(replaceInSceneNode);
      };
      replaceInSceneNode(sceneManager.scenegraph.getViewportNode());

      for (const variable of variableManager.variables.values()) {
        if (variable.values.find((value) => value.theme?.has(themeAxis.name))) {
          block.setVariable(
            variable,
            themeAxis.values.map((themeValue) => ({
              value: resolveVariable(variableManager, variable, {
                name: themeAxis.name,
                value: themeValue,
              }),
              theme: new Map([[newName, themeValue]]),
            })),
          );
        }
      }
      sceneManager.scenegraph.commitBlock(block, { undo: true });

      const renamedThemeAxis = structuredClone(themeAxis);
      renamedThemeAxis.name = newName;

      dispatch({
        type: "replace",
        themeAxes: themeAxes.toSpliced(
          themeAxes.indexOf(themeAxis),
          1,
          renamedThemeAxis,
        ),
        currentThemeAxis:
          currentThemeAxis === themeAxis ? renamedThemeAxis : currentThemeAxis,
        variables,
      });
    },
    [variableManager, themeAxes, currentThemeAxis, variables],
  );
  const handleDeleteThemeAxis = useCallback(
    (themeAxis: (typeof themeAxes)[0]) => {
      const block = sceneManager.scenegraph.beginUpdate();
      const newThemes = new Map(variableManager.themes);
      newThemes.delete(themeAxis.name);
      block.setThemes(newThemes);

      const deleteInSceneNode = (node: SceneNode) => {
        if (node.properties.theme?.has(themeAxis.name)) {
          const theme = new Map(node.properties.theme);
          theme.delete(themeAxis.name);
          block.update(node, { theme });
        }
        node.children.forEach(deleteInSceneNode);
      };
      deleteInSceneNode(sceneManager.scenegraph.getViewportNode());

      const variablesToDelete = getVariablesForThemeAxis(
        [...variableManager.variables.values()],
        themeAxis,
        themeAxes,
      );
      for (const variable of variablesToDelete) {
        block.deleteVariable(variable.name);
      }
      for (const variable of variableManager.variables.values()) {
        if (variable.values.find((value) => value.theme?.has(themeAxis.name))) {
          block.setVariable(
            variable,
            variable.values.map(({ value, theme }) => ({
              value,
              theme:
                theme &&
                new Map(
                  theme
                    .entries()
                    .filter(([axis, _value]) => axis !== themeAxis.name),
                ),
            })),
          );
        }
      }

      sceneManager.scenegraph.commitBlock(block, { undo: true });

      const index = themeAxes.indexOf(themeAxis);
      dispatch({
        type: "replace",
        themeAxes: themeAxes.toSpliced(index, 1),
        currentThemeAxis:
          currentThemeAxis === themeAxis
            ? themeAxes[Math.abs(index - 1)]
            : currentThemeAxis,
        variables,
      });
    },
    [variableManager, themeAxes, currentThemeAxis, variables],
  );
  const selectThemeAxis = useCallback(
    (axis: ThemeAxis) =>
      dispatch({
        type: "replace",
        themeAxes,
        currentThemeAxis: axis,
        variables,
      }),
    [themeAxes, variables],
  );
  const handleVariableRowRef = useCallback(
    (row: VariableTableRowInstance) => {
      if (!row) {
        return;
      }
      const variable = row.getVariable();
      if (variable === variableToEditName) {
        row.focusNameField();
        setVariableToEditName(undefined);
      } else if (
        variable === variableToScrollTo &&
        variables.includes(variable)
      ) {
        row.scrollIntoView();
        setVariableToScrollTo(undefined);
      }
    },
    [variables, variableToEditName, variableToScrollTo],
  );

  // Use the draggable panel hook for drag/resize/corner-snap behavior
  const { panelRef, panelStyle, dragHandleProps, resizeHandleProps } =
    useDraggablePanel({
      defaultWidth: 640,
      defaultHeight: 480,
      minWidth: 400,
      maxWidth: 900,
      minHeight: 300,
      maxHeight: 800,
      defaultCorner: "top-left",
      rightOffset: propertiesPanelWidth,
      leftOffset: layersListPanelWidth,
      toolbarWidth: TOOLBAR_WIDTH,
      manageDimensions: true,
      storageKey: "pencil-variables-panel-corner",
    });

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Variables Panel"
      className={cn(
        "fixed z-50 bg-card rounded-lg shadow-md overflow-hidden border border-zinc-300/50 dark:border-zinc-700/50 flex text-xxs flex-col pointer-events-auto",
      )}
      style={panelStyle}
      onMouseMove={resizeHandleProps.onMouseMove}
      onMouseDown={resizeHandleProps.onMouseDown}
      onMouseLeave={resizeHandleProps.onMouseLeave}
    >
      <div
        role="toolbar"
        aria-label="Variables panel controls and drag handle"
        className="handle flex flex-row pl-2 pr-1 mt-2 border-b cursor-grab active:cursor-grabbing"
        onMouseDown={dragHandleProps.onMouseDown}
      >
        {themeAxes.length !== 0 ? (
          themeAxes.map((axis) => (
            <ThemeAxisButton
              key={axis.name}
              selected={axis === currentThemeAxis}
              name={axis.name}
              onSelect={() => selectThemeAxis(axis)}
              onRename={(newName) => handleRenameThemeAxis(axis, newName)}
              onDelete={
                themeAxes.length > 1
                  ? () => handleDeleteThemeAxis(axis)
                  : undefined
              }
            />
          ))
        ) : (
          <ThemeAxisButton selected={true} name="Theme" />
        )}
        <button type="button" className="p-1" onClick={handleAddThemeAxis}>
          <PlusIcon className="size-3" />
        </button>
        <button type="button" className="ml-auto mr-1 p-1" onClick={onClose}>
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="overflow-auto min-h-0">
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-[1]">
            <tr>
              <th className="p-2 pl-3 text-left w-[40%]">Name</th>
              {currentThemeAxis?.values.map((value) => (
                <ThemeValueHeader
                  key={value}
                  value={value}
                  onRename={(newValue) =>
                    handleRenameThemeValue(value, newValue)
                  }
                  onDelete={
                    currentThemeAxis.values.length > 1
                      ? () => handleDeleteThemeValue(value)
                      : undefined
                  }
                />
              )) ?? <th className="p-2 text-left">Value</th>}
              <th className="p-1 pr-2 w-4 text-center">
                <button
                  type="button"
                  className="p-1"
                  onClick={handleAddThemeValue}
                >
                  <PlusIcon className="size-4" />
                </button>
              </th>
            </tr>
            <tr>
              <th
                colSpan={(currentThemeAxis?.values.length ?? 1) + 2}
                className="h-[0.5px] bg-secondary"
              />
            </tr>
          </thead>
          <tbody>
            {variables.map((variable) => (
              <VariableTableRow
                key={getIDForVariable(variable)}
                ref={handleVariableRowRef}
                variable={variable}
                themeAxes={themeAxes}
                currentThemeAxis={currentThemeAxis}
                handleRename={handleVariableRename}
                handleDelete={handleVariableDelete}
                handleDuplicate={handleVariableDuplicate}
                handleMove={handleVariableMove}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-row p-2 gap-2 border-t mt-auto ">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="hover:bg-secondary p-1 rounded-sm flex flex-row items-center gap-1 whitespace-nowrap "
            >
              <PlusIcon className="size-3" />
              Add variable
              <ChevronDown className="size-2" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent>
              <DropdownMenuItem
                className="text-xxs"
                onSelect={() =>
                  afterDropdownDisappeared(() => handleAddVariable("color"))
                }
              >
                <VariableColorIcon className="size-3" />
                Color
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xxs"
                onSelect={() =>
                  afterDropdownDisappeared(() => handleAddVariable("number"))
                }
              >
                <VariableNumberIcon className="size-3" />
                Number
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xxs"
                onSelect={() =>
                  afterDropdownDisappeared(() => handleAddVariable("string"))
                }
              >
                <VariableStringIcon className="size-3" />
                String
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      </div>
    </div>,
    document.body,
  );
}

function ThemeAxisButton({
  name,
  selected,
  onSelect,
  onRename,
  onDelete,
}: {
  name: string;
  selected: boolean;
  onSelect?: () => void;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
}): React.JSX.Element {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [focusRenameInput, setFocusRenameInput] = useState(false);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "Enter": {
          onRename?.(e.currentTarget.value);
          // intentional fallthrough
        }
        case "Escape": {
          e.preventDefault();
          setIsRenaming(false);
          break;
        }
      }
    },
    [onRename],
  );

  return (
    <div
      className="flex flex-row whitespace-nowrap"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isRenaming ? (
        <input
          ref={(input) => {
            if (focusRenameInput) {
              input?.focus();
              input?.select();
              setFocusRenameInput(false);
            }
          }}
          className={cn(
            "field-sizing-content rounded-sm p-1",
            selected && "bg-secondary",
          )}
          type="text"
          defaultValue={name}
          onKeyDown={handleKeyDown}
          onBlur={() => setIsRenaming(false)}
        />
      ) : (
        <button
          type="button"
          className={cn("rounded-sm p-1", selected && "bg-secondary")}
          onClick={onSelect}
        >
          {name}
        </button>
      )}
      {(onRename || onDelete) && (
        <DropdownMenu
          open={isDropdownOpen}
          onOpenChange={(open) => {
            setIsHovered(false);
            setIsDropdownOpen(open);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "pl-1 pr-3 hover:text-sidebar-foreground",
                !(isHovered || isDropdownOpen || selected) && "invisible",
              )}
            >
              <ChevronDown className="size-2" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent>
              {onRename && (
                <DropdownMenuItem
                  onSelect={() =>
                    afterDropdownDisappeared(() => {
                      setIsRenaming(true);
                      setFocusRenameInput(true);
                    })
                  }
                >
                  <RenameIcon />
                  Rename
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onSelect={() => afterDropdownDisappeared(() => onDelete())}
                >
                  <TrashIcon />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      )}
    </div>
  );
}

function ThemeValueHeader({
  value,
  onRename,
  onDelete,
}: {
  value: string;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
}): React.JSX.Element {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [focusRenameInput, setFocusRenameInput] = useState(false);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "Enter": {
          onRename?.(e.currentTarget.value);
          // intentional fallthrough
        }
        case "Escape": {
          e.preventDefault();
          setIsRenaming(false);
          break;
        }
      }
    },
    [onRename],
  );

  return (
    <th
      className="p-2 text-left"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-row">
        {isRenaming ? (
          <input
            ref={(input) => {
              if (focusRenameInput) {
                input?.focus();
                input?.select();
                setFocusRenameInput(false);
              }
            }}
            className="field-sizing-content"
            type="text"
            defaultValue={value}
            onKeyDown={handleKeyDown}
            onBlur={() => setIsRenaming(false)}
          />
        ) : (
          <span>{value}</span>
        )}
        {(onRename || onDelete) && (
          <DropdownMenu
            open={isDropdownOpen}
            onOpenChange={(open) => {
              setIsHovered(false);
              setIsDropdownOpen(open);
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "pl-1 pr-3 hover:text-sidebar-foreground",
                  ((!isHovered && !isDropdownOpen) || isRenaming) &&
                    "invisible",
                )}
              >
                <ChevronDown className="size-2" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent>
                {onRename && (
                  <DropdownMenuItem
                    onSelect={() =>
                      afterDropdownDisappeared(() => {
                        setIsRenaming(true);
                        setFocusRenameInput(true);
                      })
                    }
                  >
                    <RenameIcon />
                    Rename
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onSelect={() => afterDropdownDisappeared(() => onDelete())}
                  >
                    <TrashIcon />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        )}
      </div>
    </th>
  );
}

type VariableTableRowInstance = {
  getVariable: () => Variable<any>;
  focusNameField: () => void;
  scrollIntoView: () => void;
};

const VariableTableRow = React.memo(function VariableTableRow({
  ref,
  variable,
  themeAxes,
  currentThemeAxis,
  handleRename,
  handleDelete,
  handleDuplicate,
  handleMove,
}: {
  ref: React.Ref<VariableTableRowInstance>;
  variable: Variable<any>;
  themeAxes: { name: string; values: string[] }[];
  currentThemeAxis?: { name: string; values: string[] };
  handleRename: (variable: Variable<any>, newName: string) => boolean;
  handleDelete: (variable: Variable<any>) => void;
  handleDuplicate: (variable: Variable<any>) => void;
  handleMove: (
    variable: Variable<any>,
    themeAxis: (typeof themeAxes)[0],
  ) => void;
}): React.JSX.Element {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const tableRowRef = useRef<HTMLTableRowElement>(null);
  const focusNameField = useCallback((scrollIntoView: boolean) => {
    if (scrollIntoView) {
      nameInputRef.current?.scrollIntoView();
    }
    nameInputRef.current?.focus();
    // NOTE(zaza): for some reason this select() doesn't do anything if done synchronously ¯\_(ツ)_/¯
    setTimeout(() => nameInputRef.current?.select(), 0);
  }, []);
  const handleRenameWithErrors = useCallback(
    (newName: string) => {
      if (!handleRename(variable, newName) && nameInputRef.current) {
        nameInputRef.current.value = variable.name;
      }
    },
    [handleRename, variable],
  );
  useImperativeHandle(
    ref,
    () => ({
      getVariable: () => variable,
      focusNameField: () => focusNameField(true),
      scrollIntoView: () => tableRowRef.current?.scrollIntoView(),
    }),
    [variable, focusNameField],
  );

  return (
    <tr ref={tableRowRef} key={variable.name} className="border-b">
      <td className="p-2 pr-0">
        <InputIcon
          className="font-sans h-6 focus:outline-none focus-visible:ring-0"
          inputRef={nameInputRef}
          value={variable.name}
          onCommit={(newName) => handleRenameWithErrors(newName)}
          icon={variableIcon(variable.type)}
          iconClassName="text-sidebar-secondary"
          allowArrowKeysChange={false}
        />
      </td>
      {currentThemeAxis?.values.map((value) => (
        <td key={value} className="p-2 pr-0">
          <VariableValue
            key={`${currentThemeAxis.name}-${value}`}
            variable={variable}
            themeAxis={{ name: currentThemeAxis.name, value }}
          />
        </td>
      )) ?? (
        <td className="p-2 pr-0">
          <VariableValue variable={variable} />
        </td>
      )}
      <td className="text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="p-1">
              <EllipsisIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent>
              <DropdownMenuItem
                onSelect={() =>
                  afterDropdownDisappeared(() => focusNameField(false))
                }
              >
                <RenameIcon />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  afterDropdownDisappeared(() => handleDuplicate(variable))
                }
              >
                <DuplicateIcon />
                Duplicate
              </DropdownMenuItem>
              {themeAxes.length > 1 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <MoveIcon />
                    Move to...
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {themeAxes
                        .filter((axis) => axis !== currentThemeAxis)
                        .map((axis) => (
                          <DropdownMenuItem
                            key={axis.name}
                            onSelect={() => handleMove(variable, axis)}
                          >
                            {axis.name}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleDelete(variable)}>
                <TrashIcon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      </td>
    </tr>
  );
});

function VariableValue<T extends Exclude<VariableType, "boolean">>({
  variable,
  themeAxis,
}: {
  variable: Variable<T>;
  themeAxis?: { name: string; value: string };
}): React.JSX.Element {
  const sceneManager = useSceneManager();
  const variableManager = sceneManager.variableManager;
  const [value, setValue] = useState(
    resolveVariable(variableManager, variable, themeAxis),
  );

  // TODO(zaza): figure out why this crashes with "Maximum update depth exceeded [...]" when doing the update synchronously (in particular when using a color picker).
  const setValueThrottled = useMemo(
    () =>
      throttle((newValues: any) => {
        const block = sceneManager.scenegraph.beginUpdate();
        block.setVariable(variable, newValues);
        sceneManager.scenegraph.commitBlock(block, { undo: true });
      }, 1000 / 60),
    [sceneManager.scenegraph, variable],
  );
  const handleSetValue = useCallback(
    (newValue: any) => {
      const newValues = themeAxis
        ? variableManager.themes.get(themeAxis.name)!.map((themeValue) => ({
            value:
              themeValue === themeAxis.value
                ? newValue
                : resolveVariable(variableManager, variable, {
                    name: themeAxis.name,
                    value: themeValue,
                  }),
            theme: new Map([[themeAxis.name, themeValue]]),
          }))
        : [{ value: newValue }];
      setValueThrottled(newValues);
    },
    [
      sceneManager.scenegraph,
      variableManager,
      themeAxis?.name,
      themeAxis?.value,
      setValueThrottled,
      variable,
    ],
  );

  useEffect(() => {
    const listener = () =>
      setValue(resolveVariable(variableManager, variable, themeAxis));
    variable.addListener(listener);
    return () => variable.removeListener(listener);
  }, [variableManager, variable, themeAxis?.name, themeAxis?.value]);

  return (
    <VariableValueInput<T>
      type={variable.type}
      value={value}
      onCommit={handleSetValue}
    />
  );
}

function VariableValueInput<T extends Exclude<VariableType, "boolean">>({
  type,
  value,
  onCommit,
}: {
  type: T;
  value: VariableValueType<T>;
  onCommit?: (value: VariableValueType<T>) => void;
}): React.JSX.Element {
  switch (type) {
    case "string":
      return (
        <InputIcon
          className="font-sans h-6 text-xxs focus:outline-none focus-visible:ring-0"
          value={value}
          icon={variableIcon(type)}
          iconClassName="text-sidebar-secondary"
          allowArrowKeysChange={false}
          onCommit={onCommit as any}
        />
      );
    case "number":
      return (
        <InputIcon
          className="h-6 text-xxs focus:outline-none focus-visible:ring-0"
          value={value as number}
          icon={variableIcon(type)}
          iconClassName="text-sidebar-secondary"
          onCommit={(value) => {
            const numberValue = parseFloat(value);
            if (Number.isNaN(numberValue)) {
              return;
            }
            onCommit?.(numberValue as VariableValueType<T>);
          }}
        />
      );
    case "color":
      return (
        <InputIcon
          className="h-6 text-xxs focus:outline-none focus-visible:ring-0"
          value={value}
          isSwatch={true}
          onCommit={onCommit as any}
        />
      );
  }
}

function variableIcon(type: Exclude<VariableType, "boolean">): ReactNode {
  switch (type) {
    case "string":
      return <VariableStringIcon />;
    case "number":
      return <VariableNumberIcon />;
    case "color":
      return <VariableColorIcon />;
  }
}

function afterDropdownDisappeared(f: () => void) {
  // NOTE(zaza): DropdownMenu has the habit of moving focus to the DropdownMenuTrigger when it disappears.
  // This 200ms delay lets us do our own focus changes, without the disappearing DropdownMenu stealing back the focus from us.
  setTimeout(f, 200);
}

function getThemeAxes(
  variableManager: VariableManager,
): { name: string; values: string[] }[] {
  return [...variableManager.themes.entries()]
    .map(([name, values]) => ({ name, values: [...values] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getVariablesForThemeAxis(
  variables: Variable<any>[],
  currentThemeAxis: ThemeAxis | undefined,
  themeAxes: ThemeAxes,
): Variable<any>[] {
  return variables
    .filter(
      (variable) =>
        !currentThemeAxis ||
        (variable.values
          .find((value) => value.theme)
          ?.theme?.has(currentThemeAxis.name) ??
          currentThemeAxis === themeAxes[0]),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function resolveVariable<T extends VariableType>(
  variableManager: VariableManager,
  variable: Variable<T>,
  themeAxis?: { name: string; value: string },
): VariableValueType<T> {
  const theme = new Map(variableManager.getDefaultTheme());
  if (themeAxis) {
    theme.set(themeAxis.name, themeAxis.value);
  }
  return variable.getValue(theme);
}
