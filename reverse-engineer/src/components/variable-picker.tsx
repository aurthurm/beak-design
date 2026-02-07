import type * as React from "react";
import { useMemo, useState, useEffect } from "react";
import type {
  Variable,
  VariableType,
  Single,
  VariableManager,
} from "@ha/pencil-editor";
import { useSceneManager } from "../pages/Editor";
import type { PopoverAnchorProps } from "@radix-ui/react-popover";
import { PopoverPicker } from "./popover-picker";

export interface VariablePickerProps<T extends Single<VariableType>> {
  variables: T;
  selectedVariable?: Variable<T>;
  onCommit?: (value?: Variable<T>) => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  anchorRef?: PopoverAnchorProps["virtualRef"];
}

function getAvailableVariableTypes(
  variableManager: VariableManager,
): Set<VariableType> {
  return new Set(
    variableManager.variables.values().map((variable) => variable.type),
  );
}

export function useAvailableVariableTypes(): Set<VariableType> {
  const sceneManager = useSceneManager();
  const [availableVariables, setAvailableVariableTypes] = useState(
    getAvailableVariableTypes(sceneManager.variableManager),
  );
  useEffect(() => {
    const updateAvailableVariableTypes = () => {
      setAvailableVariableTypes(
        getAvailableVariableTypes(sceneManager.variableManager),
      );
    };
    sceneManager.variableManager.addListener(updateAvailableVariableTypes);
    return sceneManager.variableManager.removeListener(
      updateAvailableVariableTypes,
    );
  }, [sceneManager.variableManager]);
  return availableVariables;
}

export function VariablePicker<T extends Single<VariableType>>({
  variables,
  selectedVariable,
  onCommit,
  onOpenChange,
  children,
  className,
  anchorRef,
}: VariablePickerProps<T>) {
  const sceneManager = useSceneManager();
  const variableManager = sceneManager.variableManager;

  const availableVariables = useMemo(() => {
    const availableVariables = [
      ...variableManager.variables
        .values()
        .filter((variable) => variable.type === variables),
    ] as Variable<T>[];
    availableVariables.sort((a, b) => a.name.localeCompare(b.name));
    return availableVariables;
  }, [variableManager, variables]);

  return (
    <PopoverPicker<Variable<T>>
      selectedValue={selectedVariable}
      values={availableVariables}
      valueKey={(variable) => variable.name}
      valueLabel={(variable) => variable.name}
      none={true}
      title={
        selectedVariable
          ? `Variable: ${selectedVariable.name}`
          : "Apply variable"
      }
      onFilter={(searchTerm, variable) =>
        variable.name.toLowerCase().includes(searchTerm.toLowerCase())
      }
      searchPlaceholder="Search variables..."
      onOpenChange={onOpenChange}
      onCommit={onCommit}
      className={className}
      anchorRef={anchorRef}
    >
      {children}
    </PopoverPicker>
  );
}
