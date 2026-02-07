"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCElectron = void 0;
const shared_1 = require("@ha/shared");
const electron_1 = require("electron");
const logger_1 = require("./logger");
class IPCElectron extends shared_1.IPCHost {
    constructor(webContents) {
        const onMessage = (callback) => {
            electron_1.ipcMain.on("ipc-message", (_event, message) => {
                callback(message);
            });
        };
        const sendMessage = (message) => {
            webContents.send("ipc-message", message);
        };
        super(onMessage, sendMessage, logger_1.logger);
    }
}
exports.IPCElectron = IPCElectron;
