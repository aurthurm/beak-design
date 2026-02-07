import { useEffect, useState } from "react";
import { useIPC } from "../contexts/ipc-context";
import { platform } from "../platform";

/**
 * Hook to track whether the window is in fullscreen mode.
 * Only relevant when running in Electron.
 */
export function useIsFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { ipc, isReady } = useIPC();

  useEffect(() => {
    if (!platform.isElectron || !ipc || !isReady) {
      return;
    }

    // Get initial fullscreen state
    ipc.request("get-fullscreen").then((fullscreen) => {
      setIsFullscreen(fullscreen as boolean);
    });

    // Listen for fullscreen changes
    ipc.on("fullscreen-change", (fullscreen: boolean) => {
      setIsFullscreen(fullscreen);
    });
  }, [ipc, isReady]);

  return isFullscreen;
}
