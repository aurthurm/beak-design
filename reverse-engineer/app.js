"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PencilApp = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const ipc_1 = require("@ha/ipc");
const ws_server_1 = require("@ha/ws-server");
const electron_1 = require("electron");
const claude_1 = require("./claude");
const config_1 = require("./config");
const constants_1 = require("./constants");
const desktop_mcp_adapter_1 = require("./desktop-mcp-adapter");
const desktop_resource_device_1 = require("./desktop-resource-device");
const ide_1 = require("./ide");
const ipc_electron_1 = require("./ipc-electron");
const logger_1 = require("./logger");
const menu_1 = require("./menu");
const updater_1 = require("./updater");
const MAX_RECENT_FILES = 14;
function addRecentFile(filePath) {
    if (!node_path_1.default.isAbsolute(filePath)) {
        return;
    }
    const recentFiles = config_1.desktopConfig.get("recentFiles");
    const filtered = recentFiles.filter((f) => f !== filePath);
    const updated = [filePath, ...filtered].slice(0, MAX_RECENT_FILES);
    config_1.desktopConfig.set("recentFiles", updated);
}
function getRecentFiles() {
    const recentFiles = config_1.desktopConfig.get("recentFiles");
    return recentFiles.filter((f) => node_fs_1.default.existsSync(f));
}
function clearRecentFiles() {
    config_1.desktopConfig.set("recentFiles", []);
}
class PencilApp {
    constructor() {
        this.initialized = false;
        this.ignoreDirtyOnClose = false;
        this.wsServer = new ws_server_1.WebSocketServerManager(logger_1.logger, constants_1.WS_PORT);
        this.ipcDeviceManager = new ipc_1.IPCDeviceManager(this.wsServer, logger_1.logger, undefined, async (filePath) => {
            var _a;
            return (_a = this.currentDevice) === null || _a === void 0 ? void 0 : _a.openDocument(filePath);
        });
        this.mcpAdapter = new desktop_mcp_adapter_1.DesktopMCPAdapter(constants_1.APP_FOLDER_PATH);
    }
    get window() {
        return this.mainWindow;
    }
    async cleanup() {
        await this.mcpAdapter.cleanup();
    }
    async initialize(args) {
        this.wsServer.start();
        this.ipcDeviceManager.proxyMcpToolCallRequests();
        this.wsServer.on("ready", async (port) => {
            await this.mcpAdapter.setupIntegrations(port, true, args === null || args === void 0 ? void 0 : args.noMcpIntegration);
        });
        const windowBounds = config_1.desktopConfig.get("windowBounds");
        this.mainWindow = new electron_1.BrowserWindow({
            width: windowBounds.width,
            height: windowBounds.height,
            x: windowBounds.x,
            y: windowBounds.y,
            show: !(args === null || args === void 0 ? void 0 : args.headless),
            titleBarStyle: "hiddenInset",
            frame: process.platform !== "darwin",
            backgroundColor: "#1e1e1e",
            trafficLightPosition: { x: 12, y: 12 },
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: node_path_1.default.join(__dirname, "preload.js"),
            },
        });
        this.mainWindowIPC = new ipc_electron_1.IPCElectron(this.mainWindow.webContents);
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith("http://") || url.startsWith("https://")) {
                electron_1.shell.openExternal(url);
                return { action: "deny" };
            }
            return { action: "allow" };
        });
        if (!constants_1.IS_DEV) {
            await (0, updater_1.setupUpdater)(this.mainWindowIPC);
        }
        this.mainWindow.on("close", async (event) => {
            var _a, _b;
            if (this.currentDevice) {
                const isLoggedIn = Boolean((_a = this.currentDevice.getLicense()) === null || _a === void 0 ? void 0 : _a.licenseToken);
                if (!this.ignoreDirtyOnClose &&
                    isLoggedIn &&
                    this.currentDevice.getIsDirty()) {
                    event.preventDefault();
                    const cancelled = await this.currentDevice.saveResource({
                        userAction: false,
                    });
                    if (cancelled) {
                        return;
                    }
                    this.ignoreDirtyOnClose = true;
                    (_b = this.mainWindow) === null || _b === void 0 ? void 0 : _b.close();
                    return;
                }
            }
            this.ignoreDirtyOnClose = false;
        });
        this.mainWindow.on("resized", () => {
            var _a, _b;
            if ((_a = this.mainWindow) === null || _a === void 0 ? void 0 : _a.isDestroyed()) {
                return;
            }
            const bounds = (_b = this.mainWindow) === null || _b === void 0 ? void 0 : _b.getBounds();
            if (!bounds) {
                return;
            }
            config_1.desktopConfig.set("windowBounds", bounds);
        });
        this.mainWindow.on("closed", async () => {
            await this.ipcDeviceManager.stopAllAgents();
        });
        this.mainWindow.on("enter-full-screen", () => {
            var _a;
            (_a = this.mainWindowIPC) === null || _a === void 0 ? void 0 : _a.notify("fullscreen-change", true);
        });
        this.mainWindow.on("leave-full-screen", () => {
            var _a;
            (_a = this.mainWindowIPC) === null || _a === void 0 ? void 0 : _a.notify("fullscreen-change", false);
        });
        this.mainWindow.webContents.on("did-finish-load", async () => {
            // We dont handle reloads on the initial load.
            if (!this.initialized) {
                this.initialized = true;
                return;
            }
            if (this.currentDevice) {
                await this.loadFile(this.currentDevice.getResourcePath());
            }
        });
        (0, menu_1.setupMenu)(this.mainWindow, () => this.currentDevice, this.handleNewFile.bind(this), this.handleOpenDialog.bind(this), this.handleToggleTheme.bind(this), this.mainWindowIPC);
        // Determine which file to open on launch
        let fileToOpen = args === null || args === void 0 ? void 0 : args.filePath;
        if (!fileToOpen) {
            const recentFiles = getRecentFiles();
            if (recentFiles.length > 0 && node_fs_1.default.existsSync(recentFiles[0])) {
                fileToOpen = recentFiles[0];
            }
            else {
                fileToOpen = "pencil-welcome-desktop.pen";
            }
        }
        await this.openFile({
            filePath: fileToOpen,
            prompt: args === null || args === void 0 ? void 0 : args.prompt,
            agentType: args === null || args === void 0 ? void 0 : args.agentType,
        });
    }
    async openFile({ filePath, prompt, agentType, }) {
        logger_1.logger.info("openFile", filePath, prompt, agentType);
        if (!this.mainWindow) {
            return;
        }
        // Navigate to editor view when opening with prompt
        if (prompt) {
            const editorURL = constants_1.IS_DEV
                ? `http://localhost:${constants_1.EDITOR_PORT}/#/editor`
                : `${constants_1.APP_PROTOCOL}://editor/#/editor`;
            await this.mainWindow.webContents.loadURL(editorURL);
        }
        const obj = await this.loadFile(filePath, true);
        if (!obj) {
            return;
        }
        // Trigger agent if prompt is provided via CLI
        if (prompt && obj.device && this.mainWindowIPC) {
            await this.ipcDeviceManager.invokeAgent({
                prompt,
                appFolderPath: constants_1.APP_FOLDER_PATH,
                device: obj.device,
                ipc: this.mainWindowIPC,
                agentType: agentType || "claude",
                conversationId: `conv-${Date.now()}`,
            });
        }
    }
    async loadFile(filePath, zoomToFit = false) {
        logger_1.logger.info("loadFile", filePath, "zoomToFit:", zoomToFit);
        if (!this.mainWindow || !this.mainWindowIPC) {
            return undefined;
        }
        if (this.currentDevice) {
            this.ipcDeviceManager.removeResource(this.currentDevice.getResourcePath());
        }
        if (this.destroyClaudeAgent) {
            this.destroyClaudeAgent();
        }
        const ipc = this.mainWindowIPC;
        let fileContent;
        try {
            fileContent = node_path_1.default.isAbsolute(filePath)
                ? node_fs_1.default.readFileSync(filePath, "utf8")
                : "";
        }
        catch (e) {
            // NOTE(zaza): this exploits the bug that ipcDeviceManager.waitForDocumentReady() will only
            // resolve if the editor is not yet initialized.
            // There can be two cases:
            // 1. The editor into which we're loading is not yet initialized. In this case, the synchoronous
            //    "file-error" notification will be lost, because noone is listening for it. So we use
            //     ipcDeviceManager.waitForDocumentReady(), which resolves when the editor is ready.
            // 2. We're replacing the contents of an already initialized editor. In this case, the synchronoous
            //    notification will be handled by the editor, and ipcDeviceManager.waitForDocumentReady() won't
            //    resolve due to a bug in IPCDeviceManager.
            // In effect, we're going to deliver exactly one "file-error" notification in both cases.
            fileContent = "";
            const fileError = {
                filePath,
                errorMessage: e instanceof Error ? e.message : undefined,
            };
            ipc.notify("file-error", fileError);
            this.ipcDeviceManager.waitForDocumentReady(filePath).then(() => {
                ipc.notify("file-error", fileError);
            });
        }
        const device = new desktop_resource_device_1.DesktopResourceDevice(filePath, fileContent, this.mainWindow.webContents, this.mainWindow);
        this.currentDevice = device;
        ipc.on("open-file", async () => {
            return this.handleOpenDialog();
        });
        ipc.on("add-to-chat", async (message) => {
            // In desktop app we proxy add-to-chat notifications back to the client.
            ipc.notify("add-to-chat", message);
        });
        ipc.handle("get-fullscreen", () => {
            var _a, _b;
            return (_b = (_a = this.mainWindow) === null || _a === void 0 ? void 0 : _a.isFullScreen()) !== null && _b !== void 0 ? _b : false;
        });
        ipc.on("load-file", async (payload) => {
            return this.handleLoadFile(payload.filePath, payload.zoomToFit);
        });
        ipc.handle("get-recent-files", () => {
            return getRecentFiles();
        });
        ipc.on("clear-recent-files", () => {
            clearRecentFiles();
        });
        await (0, ide_1.handleExtensionToIDEInstall)(ipc);
        this.ipcDeviceManager.addResource(ipc, device, constants_1.APP_FOLDER_PATH);
        this.ipcDeviceManager.updateLastResource(filePath);
        device.on("reload", async (ev) => {
            await this.loadFile(ev.filePath);
        });
        device.on("dirty-changed", async (isDirty) => {
            ipc.notify("dirty-changed", isDirty);
        });
        device.on("prompt-agent", (prompt, agentMode) => {
            ipc.notify("prompt-agent", { prompt, agentMode });
        });
        addRecentFile(filePath);
        if (this.mainWindow.webContents.getURL() !== "") {
            ipc.notify("file-update", {
                content: device.getResourceContents(),
                filePath: device.getResourcePath(),
                zoomToFit,
            });
        }
        else {
            await device.loadURL(node_path_1.default.isAbsolute(filePath) ? "" : `${filePath}`);
        }
        this.destroyClaudeAgent = (0, claude_1.handleClaudeStatus)(this.mainWindow, ipc, logger_1.logger);
        return { device };
    }
    async handleLoadFile(filePath, zoomToFit) {
        var _a;
        if ((_a = this.currentDevice) === null || _a === void 0 ? void 0 : _a.getIsDirty()) {
            const cancelled = await this.currentDevice.saveResource({
                userAction: false,
            });
            if (cancelled) {
                return;
            }
        }
        await this.loadFile(filePath, zoomToFit);
    }
    async handleNewFile() {
        if (!this.mainWindow)
            return;
        await this.openFile({ filePath: "pencil-new.pen" });
    }
    async handleOpenDialog() {
        if (!this.mainWindow)
            return;
        const result = await electron_1.dialog.showOpenDialog(this.mainWindow, {
            title: "Open .pen file",
            filters: [
                { name: "Pencil Design Files", extensions: ["pen"] },
                { name: "All Files", extensions: ["*"] },
            ],
            properties: ["openFile"],
        });
        if (!result.canceled && result.filePaths.length > 0) {
            await this.openFile({ filePath: result.filePaths[0] });
        }
    }
    handleToggleTheme() {
        if (!this.mainWindowIPC) {
            return;
        }
        this.mainWindowIPC.notify("toggle-theme");
    }
}
exports.PencilApp = PencilApp;
