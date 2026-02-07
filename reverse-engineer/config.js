"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.desktopConfig = exports.DesktopConfig = exports.store = void 0;
const electron_store_1 = __importDefault(require("electron-store"));
exports.store = new electron_store_1.default({
    defaults: {
        windowBounds: {
            width: 1200,
            height: 800,
            x: undefined,
            y: undefined,
        },
        recentFiles: [],
        claudeCodeAccount: undefined,
    },
});
class DesktopConfig {
    constructor(store) {
        this.store = store;
    }
    get(key) {
        // @ts-expect-error
        return this.store.get(key);
    }
    delete(key) {
        // @ts-expect-error
        this.store.delete(key);
    }
    set(key, value) {
        // @ts-expect-error
        this.store.set(key, value);
    }
}
exports.DesktopConfig = DesktopConfig;
exports.desktopConfig = new DesktopConfig(exports.store);
