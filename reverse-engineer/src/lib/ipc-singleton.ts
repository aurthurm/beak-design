/**
 * Singleton IPC instance for non-React modules
 * This module provides access to the IPC instance from classes and modules
 * that are not React components and can't use hooks.
 */

import { type IPCHost, logger } from "@ha/shared";

class IPCSingleton {
  private static instance: IPCSingleton;
  private ipc: IPCHost | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): IPCSingleton {
    if (!IPCSingleton.instance) {
      IPCSingleton.instance = new IPCSingleton();
    }
    return IPCSingleton.instance;
  }

  /**
   * Initialize the IPC singleton - should be called once from the React context
   */
  public initialize(ipcInstance: IPCHost): void {
    if (this.isInitialized) {
      logger.warn(
        "[IPC Singleton] Already initialized, ignoring duplicate initialization",
      );
      return;
    }

    this.ipc = ipcInstance;
    this.isInitialized = true;
    logger.debug("[IPC Singleton] Initialized for non-React modules");
  }

  /**
   * Get the IPC instance
   * @throws Error if not initialized
   */
  public getIPC(): IPCHost {
    if (!this.isInitialized || !this.ipc) {
      throw new Error(
        "IPC singleton not initialized. Make sure the IPCProvider is mounted.",
      );
    }
    return this.ipc;
  }

  /**
   * Get the IPC instance or null if not ready
   */
  public getIPCOrNull(): IPCHost | null {
    return this.isInitialized ? this.ipc : null;
  }

  /**
   * Check if IPC is ready
   */
  public isReady(): boolean {
    return this.isInitialized && this.ipc !== null;
  }

  /**
   * Dispose of the singleton (for cleanup)
   */
  public dispose(): void {
    this.ipc = null;
    this.isInitialized = false;
    logger.debug("[IPC Singleton] Disposed");
  }
}

// Export the singleton instance
export const ipcSingleton = IPCSingleton.getInstance();

/**
 * Convenience function to get IPC instance
 * @returns The IPC instance
 * @throws Error if not initialized
 */
export function getIPC(): IPCHost {
  return ipcSingleton.getIPC();
}

/**
 * Convenience function to get IPC instance or null
 * @returns The IPC instance or null if not ready
 */
export function getIPCOrNull(): IPCHost | null {
  return ipcSingleton.getIPCOrNull();
}

/**
 * Convenience function to check if IPC is ready
 * @returns true if IPC is ready
 */
export function isIPCReady(): boolean {
  return ipcSingleton.isReady();
}
