"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("PENCIL_APP_NAME", "Electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    sendMessage: (message) => {
        electron_1.ipcRenderer.send("ipc-message", message);
    },
    onMessageReceived: (callback) => {
        electron_1.ipcRenderer.on("ipc-message", (_event, message) => {
            callback(message);
        });
    },
    resolveFilePath: (file) => {
        return electron_1.webUtils.getPathForFile(file);
    },
});
