import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useSyncExternalStore,
} from "react";
import type { PencilConfigData } from "@ha/pencil-editor/src/types";
import { useSceneManager } from "../pages/Editor";

export function useConfigValue<K extends keyof PencilConfigData>(
  key: K,
): [PencilConfigData[K], Dispatch<SetStateAction<PencilConfigData[K]>>] {
  const manager = useSceneManager();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const listener = (changedKey: keyof PencilConfigData) => {
        if (changedKey === key) {
          onStoreChange();
        }
      };

      manager.config.on("change", listener);
      return () => manager.config.removeListener("change", listener);
    },
    [manager, key],
  );

  const getSnapshot = useCallback(
    () => manager.config.data[key],
    [manager, key],
  );

  const value = useSyncExternalStore(subscribe, getSnapshot);

  const setValue = useCallback(
    (newValue: SetStateAction<PencilConfigData[K]>) => {
      const actualValue =
        typeof newValue === "function"
          ? newValue(manager.config.data[key])
          : newValue;

      if (actualValue !== manager.config.data[key]) {
        manager.config.set(key, actualValue);
      }
    },
    [manager, key],
  );

  return [value, setValue];
}
