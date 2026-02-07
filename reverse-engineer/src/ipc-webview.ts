/**
 * Webview side IPC handler
 */

import { IPCHost, type IPCMessage, logger } from "@ha/shared";

interface VSCodeAPI {
  postMessage(message: unknown): void;
}

interface ElectronAPI {
  sendMessage(message: IPCMessage): void;
  onMessageReceived(callback: (message: IPCMessage) => void): void;
  resolveFilePath: (file: any) => string;
}

interface WebAppAPI {
  getBasePath(): string;
}

declare global {
  interface Window {
    vscodeapi?: VSCodeAPI;
    electronAPI?: ElectronAPI;
    webappapi?: WebAppAPI;
  }
}

export function createWebviewIPC(): IPCHost {
  const vscode = window.vscodeapi;
  let onMessage = null;
  let sendMessage = null;

  if (vscode) {
    onMessage = (callback: (message: IPCMessage) => void) => {
      window.addEventListener("message", (event: MessageEvent) => {
        if (event.data && typeof event.data === "object") {
          const message = event.data as IPCMessage;
          if (message.id && message.type && message.method) {
            callback(message);
          }
        }
      });
    };
    sendMessage = (message: IPCMessage) => vscode.postMessage(message);
  } else if (window.electronAPI) {
    console.log("[IPC Webview] Using Electron API");
    onMessage = (callback: (message: IPCMessage) => void) => {
      console.log("[IPC Webview] Setting up onMessage callback");
      window.electronAPI?.onMessageReceived(callback);
    };
    sendMessage = (message: IPCMessage) => {
      console.log("[IPC Webview] Sending message:", message);
      window.electronAPI?.sendMessage(message);
    };
  } else if (window.webappapi) {
    logger.info("[IPC Webview] Running in webapp environment");

    onMessage = (callback: (message: IPCMessage) => void) => {
      const handleMessage = (event: MessageEvent) => {
        if (!event.data) return;

        if (event.data.type && event.data.id && event.data.method) {
          callback(event.data as IPCMessage);
          return;
        }
      };
      window.addEventListener("message", handleMessage);
    };

    sendMessage = (message: IPCMessage) => {
      if (window.parent !== window) {
        window.parent.postMessage(message, "*");
      }
    };
  }

  if (!onMessage || !sendMessage) {
    throw new Error("Could not create IPCHost");
  }

  return new IPCHost(onMessage, sendMessage, logger);
}
