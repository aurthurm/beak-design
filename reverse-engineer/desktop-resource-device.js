"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopResourceDevice = void 0;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const electron_1 = __importDefault(require("electron"));
const eventemitter3_1 = __importDefault(require("eventemitter3"));
const claude_1 = require("./claude");
const constants_1 = require("./constants");
const logger_1 = require("./logger");
const configFolderPath = path.join(os.homedir(), ".pencil");
const licenseFilePath = path.join(configFolderPath, `license-token${constants_1.IS_DEV ? "-dev" : ""}.json`);
class DesktopResourceDevice extends eventemitter3_1.default {
    constructor(filePath, fileContent, webContents, window) {
        super();
        this.isDirty = false;
        this.id = crypto.randomUUID();
        this.filePath = filePath;
        this.fileContent = fileContent;
        this.webContents = webContents;
        this.window = window;
    }
    getResourcePath() {
        return this.filePath;
    }
    getResourceContents() {
        return this.fileContent;
    }
    getDeviceId() {
        const machineId = os.hostname() + os.platform() + os.arch();
        return crypto.createHash("md5").update(machineId).digest("hex");
    }
    getApiKey() {
        // TODO: Implement API key storage for Desktop app
        // For now, return undefined - will be implemented with settings UI
        return undefined;
    }
    getIsDirty() {
        return this.isDirty;
    }
    getLicense() {
        try {
            const license = require(licenseFilePath);
            // Only return if both fields are present
            if ((license === null || license === void 0 ? void 0 : license.email) && (license === null || license === void 0 ? void 0 : license.licenseToken)) {
                return { email: license.email, licenseToken: license.licenseToken };
            }
            return undefined;
        }
        catch (_a) {
            return undefined;
        }
    }
    setLicense(email, licenseToken) {
        try {
            // Ensure directory exists synchronously for simplicity
            try {
                fs.mkdirSync(configFolderPath, { recursive: true });
            }
            catch (_a) { }
            fs.writeFileSync(licenseFilePath, JSON.stringify({ email, licenseToken }, null, 2));
        }
        catch (error) {
            console.error("Failed to save license:", error);
        }
    }
    async readFile(filePath) {
        if (this.isTemporary() && !path.isAbsolute(filePath)) {
            filePath = path.join(await this.getResourceFolderPath(), filePath);
        }
        const data = fs.readFileSync(filePath);
        return new Uint8Array(data);
    }
    async ensureDir(dirPath) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    async writeFile(filePath, contents) {
        fs.writeFileSync(filePath, contents);
    }
    async saveResource(params) {
        let shouldSave = true;
        if (this.isDirty && !params.userAction) {
            const response = await electron_1.default.dialog.showMessageBox(this.window, {
                type: "warning",
                message: `Do you want to save the changes you made to ${this.getResourcePath()}?`,
                buttons: ["Save", "Don't Save", "Cancel"],
                detail: "Your changes will be lost if you don't save them.",
            });
            // User selected "Don't Save"
            if (response.response === 1) {
                shouldSave = false;
            }
            // User selected "Cancel"
            if (response.response === 2) {
                return true;
            }
        }
        if (!shouldSave) {
            return false;
        }
        if (!this.isTemporary() && !params.saveAs) {
            fs.writeFileSync(this.getResourcePath(), this.fileContent, "utf8");
            if (this.isDirty) {
                this.emit("dirty-changed", false);
                this.isDirty = false;
            }
            return false;
        }
        let filePathToSave;
        if (!this.isTemporary()) {
            const response = await electron_1.default.dialog.showSaveDialog(this.window, {
                title: "Save .pen file as…",
                filters: [
                    { name: "Pencil Design Files", extensions: ["pen"] },
                    { name: "All Files", extensions: ["*"] },
                ],
                defaultPath: this.getResourcePath(),
            });
            if (response.canceled) {
                return true;
            }
            filePathToSave = response.filePath;
        }
        else {
            const response = await electron_1.default.dialog.showSaveDialog(this.window, {
                title: "Save new .pen file",
                defaultPath: "untitled.pen",
            });
            if (response.canceled) {
                return true;
            }
            const srcImages = path.join(await this.getResourceFolderPath(), "images");
            if (fs.existsSync(srcImages)) {
                const dstImages = path.join(path.dirname(response.filePath), "images");
                fs.cpSync(srcImages, dstImages, { recursive: true });
                fs.rmSync(srcImages, { recursive: true, force: true });
            }
            filePathToSave = response.filePath;
        }
        if (filePathToSave) {
            fs.writeFileSync(filePathToSave, this.fileContent, "utf8");
            this.emit("reload", {
                filePath: filePathToSave,
            });
        }
        if (this.isDirty) {
            this.emit("dirty-changed", false);
            this.isDirty = false;
        }
        return false;
    }
    async replaceFileContents(content) {
        this.fileContent = content;
        if (!this.isDirty) {
            this.emit("dirty-changed", true);
            this.isDirty = true;
        }
    }
    async importFileByName(fileName, fileContents) {
        const penDir = path.dirname(this.filePath);
        const targetPath = path.join(penDir, fileName);
        try {
            const existing = fs.readFileSync(targetPath);
            if (Buffer.from(fileContents).equals(existing)) {
                return { filePath: `./${fileName}` };
            }
        }
        catch (_a) {
            // File doesn't exist, continue with import
        }
        fs.writeFileSync(targetPath, new Uint8Array(fileContents));
        return { filePath: `./${fileName}` };
    }
    async importFileByUri(fileUriString) {
        // Simple implementation - copy file to pen directory
        const sourceFile = fileUriString.replace("file://", "");
        const fileName = path.basename(sourceFile);
        const fileContents = fs.readFileSync(sourceFile);
        const result = await this.importFileByName(fileName, fileContents.buffer);
        return {
            filePath: result.filePath,
            fileContents: fileContents.buffer,
        };
    }
    async openDocument(type) {
        logger_1.logger.info("openDocument", type);
        const filePath = type.endsWith(".pen") ? type : `pencil-${type}.pen`;
        this.emit("reload", { filePath });
    }
    getActiveThemeKind() {
        return electron_1.default.nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }
    async submitPrompt(prompt, model, _selectedIDs) {
        logger_1.logger.info("submitPrompt", prompt, model);
        if (model === null || model === void 0 ? void 0 : model.includes("haiku")) {
            model = "haiku";
        }
        else if (model === null || model === void 0 ? void 0 : model.includes("sonnet")) {
            model = "sonnet";
        }
        else if (model === null || model === void 0 ? void 0 : model.includes("opus")) {
            model = "opus";
        }
        else {
            model = "sonnet";
        }
        this.emit("prompt-agent", prompt, model);
    }
    async loadURL(fileToLoad) {
        logger_1.logger.info("[DesktopResourceDevice] loadURL() | fileToLoad:", fileToLoad);
        if (constants_1.IS_DEV) {
            return this.webContents.loadURL(`http://localhost:${constants_1.EDITOR_PORT}/#/editor/${fileToLoad}`);
        }
        else {
            return this.webContents.loadURL(`${constants_1.APP_PROTOCOL}://editor/#/editor/${fileToLoad}`);
        }
    }
    toggleDesignMode() {
        logger_1.logger.info("toggleDesignMode not implemented for desktop");
    }
    setLeftSidebarVisible(visible) {
        logger_1.logger.info("setLeftSidebarVisible not implemented for desktop", visible);
    }
    signOut() {
        if (fs.existsSync(licenseFilePath)) {
            fs.unlinkSync(licenseFilePath);
        }
    }
    getClaudeCodeExecutablePath() {
        return (0, claude_1.getClaudeCodeExecutablePath)();
    }
    execPath() {
        return (0, claude_1.getClaudeExecPath)();
    }
    getAgentEnv() {
        return (0, claude_1.getClaudeCodeEnv)();
    }
    agentIncludePartialMessages() {
        return true;
    }
    isTemporary() {
        const resource = this.getResourcePath();
        return !path.isAbsolute(resource) && resource.startsWith("pencil-");
    }
    async getResourceFolderPath() {
        if (!this.isTemporary()) {
            return path.dirname(this.getResourcePath());
        }
        const resourcePath = path.join(configFolderPath, "resources", this.id);
        fs.mkdirSync(resourcePath, { recursive: true });
        return resourcePath;
    }
    async dispose() {
        if (!this.isTemporary()) {
            return;
        }
        const imagesDir = path.join(await this.getResourceFolderPath(), "images");
        if (fs.existsSync(imagesDir)) {
            await fs.promises.rm(imagesDir, { recursive: true, force: true });
        }
    }
}
exports.DesktopResourceDevice = DesktopResourceDevice;
