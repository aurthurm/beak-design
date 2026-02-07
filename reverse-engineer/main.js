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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const electron_1 = require("electron");
const app_1 = require("./app");
const constants_1 = require("./constants");
const logger_1 = require("./logger");
let initArgs = getInitArgs();
let pencilApp;
const multiMode = (_a = initArgs === null || initArgs === void 0 ? void 0 : initArgs.multiMode) !== null && _a !== void 0 ? _a : false;
if (!multiMode) {
    const gotTheLock = electron_1.app.requestSingleInstanceLock();
    if (!gotTheLock) {
        electron_1.app.quit();
    }
    else {
        electron_1.app.on("second-instance", (_event, commandLine, _workingDirectory) => {
            // Someone tried to run another instance, focus our window instead
            if (pencilApp === null || pencilApp === void 0 ? void 0 : pencilApp.window) {
                if (pencilApp.window.isMinimized())
                    pencilApp.window.restore();
                pencilApp.window.focus();
            }
            const args = commandLine.slice(electron_1.app.isPackaged ? 1 : 2);
            const fileArg = args.find((arg) => arg.endsWith(".pen"));
            if (fileArg && pencilApp) {
                const resolvedPath = resolveFilePath(fileArg);
                if (fs.existsSync(resolvedPath)) {
                    pencilApp.openFile({ filePath: resolvedPath });
                }
            }
        });
    }
}
// Register custom protocol for serving editor files
electron_1.protocol.registerSchemesAsPrivileged([
    {
        scheme: constants_1.APP_PROTOCOL,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
        },
    },
]);
electron_1.app.whenReady().then(async () => {
    logger_1.logger.info(`App ready. IS_DEV: ${constants_1.IS_DEV}, NODE_ENV: ${process.env.NODE_ENV}`);
    if (!constants_1.IS_DEV) {
        // Register protocol handler for production editor files
        electron_1.protocol.handle(constants_1.APP_PROTOCOL, (request) => {
            try {
                const url = new URL(request.url);
                const filePath = url.pathname;
                let targetFile;
                if (filePath === "/" || filePath === "/editor" || filePath === "") {
                    targetFile = path.join(__dirname, "editor", "index.html");
                }
                else {
                    const cleanPath = filePath.startsWith("/")
                        ? filePath.slice(1)
                        : filePath;
                    targetFile = path.join(__dirname, "editor", cleanPath);
                }
                return electron_1.net.fetch(`file://${targetFile}`);
            }
            catch (error) {
                logger_1.logger.error("Protocol handler error:", error);
                throw error;
            }
        });
    }
    else {
        logger_1.logger.debug("Skipping protocol handler registration (dev mode)");
    }
    pencilApp = new app_1.PencilApp();
    await pencilApp.initialize(initArgs);
});
electron_1.app.on("window-all-closed", async () => {
    if (pencilApp) {
        await pencilApp.cleanup();
    }
    electron_1.app.quit();
});
electron_1.app.on("open-file", async (event, filePath) => {
    logger_1.logger.info("open-file", event, filePath);
    event.preventDefault();
    if (path.extname(filePath) !== ".pen") {
        return;
    }
    if (pencilApp) {
        // App is already running, open the file directly
        pencilApp.openFile({ filePath });
    }
    else {
        // App is starting, store the file to open after initialization
        initArgs = { filePath };
    }
});
function resolveFilePath(filePath) {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    return path.resolve(process.cwd(), filePath);
}
function getInitArgs() {
    const argIndex = electron_1.app.isPackaged ? 1 : 2;
    const args = process.argv.slice(argIndex);
    if (args.length === 0) {
        return null;
    }
    const result = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--headless") {
            result.headless = true;
        }
        else if (arg === "--multi-mode") {
            result.multiMode = true;
        }
        else if (arg === "--no-mcp-integration") {
            result.noMcpIntegration = true;
        }
        else if (arg === "--file" && i + 1 < args.length) {
            const filePath = args[i + 1];
            const resolvedPath = resolveFilePath(filePath);
            if (fs.existsSync(resolvedPath) &&
                path.extname(resolvedPath) === ".pen") {
                result.filePath = resolvedPath;
            }
            else {
                logger_1.logger.error(`Error: File not found or invalid: ${filePath}`);
                electron_1.app.quit();
                return null;
            }
            i++;
        }
        else if (arg === "--prompt" && i + 1 < args.length) {
            result.prompt = args[i + 1];
            i++;
        }
        else if (arg === "--agent" && i + 1 < args.length) {
            result.agentType = args[i + 1];
            i++;
        }
    }
    return Object.keys(result).length > 0 ? result : null;
}
