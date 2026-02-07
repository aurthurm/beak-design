"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupUpdater = setupUpdater;
const electron_updater_1 = require("electron-updater");
async function setupUpdater(ipc) {
    const log = require("electron-log");
    log.transports.file.level = "debug";
    electron_updater_1.autoUpdater.logger = log;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;
    electron_updater_1.autoUpdater.on("update-downloaded", (_info) => {
        ipc.notify("desktop-update-ready");
    });
    ipc.on("desktop-update-install", () => {
        electron_updater_1.autoUpdater.quitAndInstall(false, true);
    });
    // Check for updates every 30 minutes.
    setInterval(() => {
        electron_updater_1.autoUpdater.checkForUpdates();
    }, 30 * 60 * 1000);
    return electron_updater_1.autoUpdater.checkForUpdates();
}
