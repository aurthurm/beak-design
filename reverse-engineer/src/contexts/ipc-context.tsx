import type { IPCHost } from "@ha/shared";
import { logger } from "@ha/shared";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { createWebviewIPC } from "../ipc-webview";
import { ipcSingleton } from "../lib/ipc-singleton";

interface IPCContextType {
  ipc: IPCHost | null;
  isReady: boolean;
}

const IPCContext = createContext<IPCContextType>({
  ipc: null,
  isReady: false,
});

interface IPCProviderProps {
  children: React.ReactNode;
}

export function IPCProvider({ children }: IPCProviderProps) {
  const [ipc, setIPC] = useState<IPCHost | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      logger.debug("[IPC Context] Initializing singleton IPC instance");
      const ipcInstance = createWebviewIPC();

      // Initialize both React context and singleton for non-React modules
      setIPC(ipcInstance);
      ipcSingleton.initialize(ipcInstance);
      setIsReady(true);

      logger.info(
        "[IPC Context] IPC singleton ready for both React and non-React usage",
      );
    } catch (error) {
      logger.error("[IPC Context] Failed to initialize IPC:", error);
      setIsReady(false);
    }

    return () => {
      if (ipc) {
        logger.debug("[IPC Context] Disposing IPC singleton");
        ipc.dispose();
        ipcSingleton.dispose();
      }
    };
  }, []);

  return (
    <IPCContext.Provider value={{ ipc, isReady }}>
      {children}
    </IPCContext.Provider>
  );
}

export function useIPC() {
  const context = useContext(IPCContext);
  if (context === undefined) {
    throw new Error("useIPC must be used within an IPCProvider");
  }
  return context;
}
