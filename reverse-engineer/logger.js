"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.DesktopLogger = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
class DesktopLogger {
    setLevel(_level) { }
    setEnabled(_enabled) { }
    debug(...args) {
        electron_log_1.default.debug(...args);
        // console.log(...args);
    }
    info(...args) {
        electron_log_1.default.info(...args);
        // console.log(...args);
    }
    warn(...args) {
        electron_log_1.default.warn(...args);
        // console.log(...args);
    }
    error(...args) {
        electron_log_1.default.error(...args);
        // console.log(...args);
    }
}
exports.DesktopLogger = DesktopLogger;
exports.logger = new DesktopLogger();
