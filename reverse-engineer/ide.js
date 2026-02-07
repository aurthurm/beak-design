"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleExtensionToIDEInstall = handleExtensionToIDEInstall;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
async function handleExtensionToIDEInstall(ipc) {
    ipc.on("add-extension-to-ide", (ide) => {
        if (ide === "cursor") {
            electron_1.shell.openExternal("cursor:extension/highagency.pencildev");
        }
    });
    for (const ide of ["cursor"]) {
        if (await notifyExtensionInstall(ide)) {
            ipc.notify("ide-name-changed", ide);
            return;
        }
    }
}
async function notifyExtensionInstall(ide) {
    const userDir = electron_1.app.getPath("home");
    const idePath = node_path_1.default.join(userDir, `.${ide}`);
    if (!node_fs_1.default.existsSync(idePath)) {
        return false;
    }
    const extensionsPath = node_path_1.default.join(idePath, "extensions");
    if (!node_fs_1.default.existsSync(extensionsPath)) {
        return false;
    }
    const extensions = node_fs_1.default.readdirSync(extensionsPath);
    return !extensions.some((ext) => ext.startsWith("highagency.pencildev"));
}
