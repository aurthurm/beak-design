"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopMCPAdapter = void 0;
const mcp_1 = require("@ha/mcp");
const logger_1 = require("./logger");
class DesktopMCPAdapter {
    constructor(appPath) {
        this.appPath = appPath;
        this.log = logger_1.logger;
    }
    getInstallationPath() {
        return this.appPath;
    }
    getExternalExtensionPath(_extensionId) {
        return undefined;
    }
    async setupIntegrations(wsServerPort, _isInitialSetup, noMcpIntegration) {
        if (noMcpIntegration) {
            await (0, mcp_1.setupSelectiveIntegrations)(wsServerPort, this, {});
            return;
        }
        const enabledIntegrations = {
            claudeCode: true,
            claudeCodeCLI: true,
            codex: true,
            codexCLI: true,
            geminiCLI: true,
            windsurfIDE: true,
            cursorCLI: false,
            antigravityIDE: true,
        };
        await (0, mcp_1.setupSelectiveIntegrations)(wsServerPort, this, enabledIntegrations);
    }
    async cleanup() {
        try {
            await (0, mcp_1.removeAllIntegrations)(this);
            logger_1.logger.info("Cleaned up all MCP integrations from external tools");
        }
        catch (error) {
            logger_1.logger.error("Failed to cleanup MCP integrations", error);
        }
    }
}
exports.DesktopMCPAdapter = DesktopMCPAdapter;
