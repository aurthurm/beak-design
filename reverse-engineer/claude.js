"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClaudeCodeExecutablePath = getClaudeCodeExecutablePath;
exports.getClaudeCodeEnv = getClaudeCodeEnv;
exports.getClaudeExecPath = getClaudeExecPath;
exports.handleClaudeStatus = handleClaudeStatus;
const node_child_process_1 = require("node:child_process");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const agent_1 = require("@ha/agent");
const electron_1 = require("electron");
const config_1 = require("./config");
const constants_1 = require("./constants");
function getClaudeCodeExecutablePath() {
    if (!electron_1.app.isPackaged) {
        return undefined;
    }
    const appPath = electron_1.app.getAppPath();
    const asarUnpackedPath = appPath.replace(/\.asar$/, ".asar.unpacked");
    return node_path_1.default.join(asarUnpackedPath, "node_modules", "@anthropic-ai", "claude-agent-sdk", "cli.js");
}
function getClaudeCodeEnv() {
    return Object.assign(Object.assign({}, process.env), { ANTHROPIC_BETAS: "fine-grained-tool-streaming-2025-05-14" });
}
function getClaudeExecPath() {
    if (!electron_1.app.isPackaged) {
        return undefined;
    }
    return node_path_1.default.join(constants_1.APP_FOLDER_PATH, "out", "assets", `bun-${node_os_1.default.platform()}-${node_os_1.default.arch()}`);
}
function handleClaudeStatus(window, ipc, logger) {
    const claude = new agent_1.ClaudeAgent({
        logger,
        claudeExecutablePath: getClaudeCodeExecutablePath(),
        execPath: getClaudeExecPath(),
        env: getClaudeCodeEnv(),
    });
    const check = async () => {
        logger.debug("Checking for Claude Code status");
        const status = await claude.getClaudeStatus();
        ipc.notify("claude-status", status);
        logger.debug("Checked for Claude Code status");
        if (status.loggedIn) {
            config_1.desktopConfig.set("claudeCodeAccount", status.accountInfoEmail || "no-email");
        }
        else {
            config_1.desktopConfig.delete("claudeCodeAccount");
            const pollInterval = setInterval(async () => {
                logger.debug("Polling for Claude Code status");
                if (window.isMinimized()) {
                    logger.debug("Skipping Claude Code status check");
                    return;
                }
                const status = await claude.getClaudeStatus();
                ipc.notify("claude-status", status);
                if (status.loggedIn) {
                    config_1.desktopConfig.set("claudeCodeAccount", status.accountInfoEmail || "no-email");
                    clearInterval(pollInterval);
                }
            }, 5 * 1000);
        }
    };
    ipc.on("desktop-open-terminal", (param) => {
        openTerminal();
        if (param.runCheck) {
            check();
        }
    });
    ipc.on("claude-status-help-triggered", check);
    if (config_1.desktopConfig.get("claudeCodeAccount")) {
        logger.debug("Claude Code was already connected before");
        ipc.notify("claude-status", {
            cliInstalled: true,
            loggedIn: true,
            accountInfoEmail: config_1.desktopConfig.get("claudeCodeAccount"),
        });
    }
    else {
        check();
    }
    return () => {
        claude.destroy();
    };
}
function openTerminal() {
    const platform = node_os_1.default.platform();
    if (platform === "darwin") {
        (0, node_child_process_1.exec)("open -a iTerm", (error) => {
            if (error) {
                (0, node_child_process_1.exec)(`open -a Terminal`);
            }
        });
    }
    else if (platform === "win32") {
        (0, node_child_process_1.exec)(`start cmd.exe`);
    }
}
