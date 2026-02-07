"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVAL_FOLDER = exports.IS_MAC = exports.APP_FOLDER_PATH = exports.WS_PORT = exports.EDITOR_PORT = exports.APP_PROTOCOL = exports.IS_DEV = void 0;
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
exports.IS_DEV = process.env.NODE_ENV === "development";
exports.APP_PROTOCOL = "pencil";
exports.EDITOR_PORT = process.env.EDITOR_PORT || "3000";
exports.WS_PORT = process.env.WS_PORT
    ? Number.parseInt(process.env.WS_PORT, 10)
    : undefined;
exports.APP_FOLDER_PATH = electron_1.app.isPackaged
    ? node_path_1.default.resolve(__dirname, "..", "..", "app.asar.unpacked")
    : node_path_1.default.resolve(__dirname, "..");
exports.IS_MAC = process.platform === "darwin";
exports.EVAL_FOLDER = process.env.INTERNAL_PENCIL_EVAL_FOLDER;
