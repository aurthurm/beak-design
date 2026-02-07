"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMenu = setupMenu;
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const constants_1 = require("./constants");
function setupMenu(mainWindow, getCurrentDevice, handleNewFile, handleOpenDialog, handleToggleTheme, ipc) {
    const template = [
        {
            label: "File",
            submenu: [
                {
                    label: "New File",
                    accelerator: "CmdOrCtrl+N",
                    click: async () => {
                        return handleNewFile();
                    },
                },
                {
                    label: "Open…",
                    accelerator: "CmdOrCtrl+O",
                    click: async () => {
                        return handleOpenDialog();
                    },
                },
                {
                    type: "separator",
                },
                {
                    label: "Import Figma...",
                    click: async () => {
                        return handleImportFigma(mainWindow);
                    },
                },
                {
                    label: "Import PNG/JPG/SVG...",
                    click: async () => {
                        return handleImportImages(mainWindow, ipc);
                    },
                },
                {
                    type: "separator",
                },
                {
                    label: "Export Code && MCP Setup",
                    click: async () => {
                        ipc === null || ipc === void 0 ? void 0 : ipc.notify("show-code-mcp-dialog");
                    },
                },
                {
                    type: "separator",
                },
                {
                    label: "Save",
                    accelerator: "CmdOrCtrl+S",
                },
                {
                    label: "Save As…",
                    accelerator: "CmdOrCtrl+Shift+S",
                    click: async () => {
                        const currentDevice = getCurrentDevice();
                        if (currentDevice) {
                            await currentDevice.saveResource({
                                userAction: true,
                                saveAs: true,
                            });
                        }
                    },
                },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "delete" },
                { type: "separator" },
                { role: "selectAll" },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
            ],
        },
        {
            label: "Window",
            submenu: [
                { role: "minimize" },
                { role: "zoom" },
                { type: "separator" },
                {
                    label: "Toggle Light/Dark Mode",
                    click: () => handleToggleTheme(),
                },
                { type: "separator" },
                // @ts-expect-error
                ...(constants_1.IS_MAC
                    ? [
                        { type: "separator" },
                        { role: "front" },
                        { type: "separator" },
                        { role: "window" },
                    ]
                    : [{ role: "close" }]),
            ],
        },
        {
            role: "help",
            submenu: [
                {
                    label: "Learn More",
                    click: async () => {
                        await electron_1.shell.openExternal("https://pencil.dev");
                    },
                },
            ],
        },
    ];
    if (process.platform === "darwin") {
        template.unshift({
            label: electron_1.app.name,
            submenu: [
                { role: "about" },
                {
                    label: "Check for Updates…",
                    click: async () => {
                        if (constants_1.IS_DEV) {
                            return;
                        }
                        const response = await electron_updater_1.autoUpdater.checkForUpdates();
                        if (response === null || response === void 0 ? void 0 : response.isUpdateAvailable) {
                            ipc === null || ipc === void 0 ? void 0 : ipc.notify("desktop-update-available");
                        }
                        else {
                            electron_1.dialog.showMessageBox(mainWindow, {
                                type: "info",
                                title: "No Updates Available",
                                message: "There are currently no updates available.",
                            });
                        }
                    },
                },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
            ],
        });
    }
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
}
async function handleImportFigma(mainWindow) {
    await electron_1.dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Import from Figma",
        message: "How to import from Figma",
        detail: "Just copy/paste.\n\nCopy any layer or frame in Figma and paste it directly into the canvas using Cmd+V (Mac) or Ctrl+V (Window/Linux).\n\nNote: Bitmaps won't copy over currently, coming in the future. Some advanced graphics features might be not yet supported.",
    });
}
async function handleImportImages(mainWindow, ipc) {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        title: "Import Image or SVG",
        filters: [
            { name: "Images", extensions: ["png", "jpg", "jpeg", "svg"] },
            { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile", "multiSelections"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
        ipc === null || ipc === void 0 ? void 0 : ipc.notify("import-images", { filePaths: result.filePaths });
    }
}
