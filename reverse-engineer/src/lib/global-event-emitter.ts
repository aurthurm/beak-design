import { EventEmitter } from "eventemitter3";
import type React from "react";

interface GlobalEventMap {
  openModal: (modal: React.ReactElement) => void;
}

export const globalEventEmitter = new EventEmitter<GlobalEventMap>();
