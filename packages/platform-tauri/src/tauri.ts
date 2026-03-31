/**
 * Tauri Command Types and Helpers
 * Type-safe wrappers for Tauri commands
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * Check if running in Tauri context
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Detected agent info from Tauri
 */
export interface TauriAgentInfo {
  id: string
  name: string
  type: string
  status: string
  endpoint?: string
  command?: string
  args?: string[]
  metadata?: {
    version?: string
    models?: string[]
    [key: string]: any
  }
}

/**
 * Detect CLI tools available in PATH
 */
export async function detectCLITools(): Promise<TauriAgentInfo[]> {
  if (!isTauri()) {
    return []
  }
  return invoke<TauriAgentInfo[]>('detect_cli_tools')
}

/**
 * Detect MCP servers from config files
 */
export async function detectMCPServers(): Promise<TauriAgentInfo[]> {
  if (!isTauri()) {
    return []
  }
  return invoke<TauriAgentInfo[]>('detect_mcp_servers')
}

/**
 * Ollama detection result
 */
export interface OllamaDetectionResult {
  available: boolean
  models: Array<{
    name: string
    modified_at: string
    size: number
  }>
  error?: string
}

/**
 * Detect Ollama server
 */
export async function detectOllama(): Promise<OllamaDetectionResult> {
  if (!isTauri()) {
    return {
      available: false,
      models: [],
      error: 'Not running in Tauri context',
    }
  }
  return invoke<OllamaDetectionResult>('detect_ollama')
}

/**
 * Process information
 */
export interface ProcessInfo {
  connection_id: string
  process_type: string
  command: string
  args: string[]
}

/**
 * Spawn MCP server process with stdio transport
 * @returns connection_id to use for subsequent commands
 */
export async function spawnMCPServer(
  command: string,
  args: string[]
): Promise<string> {
  if (!isTauri()) {
    throw new Error('Tauri context required for stdio MCP servers')
  }
  return invoke<string>('spawn_mcp_server', { command, args })
}

/**
 * Spawn CLI agent process
 * @returns connection_id to use for subsequent commands
 */
export async function spawnCLIAgent(
  tool: string,
  args: string[]
): Promise<string> {
  if (!isTauri()) {
    throw new Error('Tauri context required for CLI agents')
  }
  return invoke<string>('spawn_cli_agent', { tool, args })
}

/**
 * Send message to process stdin
 */
export async function sendMCPMessage(
  connectionId: string,
  message: string
): Promise<void> {
  if (!isTauri()) {
    throw new Error('Tauri context required for stdio communication')
  }
  return invoke<void>('send_mcp_message', {
    connectionId,
    message,
  })
}

/**
 * Read response from process stdout
 * @returns Response as string (one line)
 */
export async function readMCPResponse(connectionId: string): Promise<string> {
  if (!isTauri()) {
    throw new Error('Tauri context required for stdio communication')
  }
  return invoke<string>('read_mcp_response', { connectionId })
}

/**
 * Kill process and remove from manager
 */
export async function killProcess(connectionId: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Tauri context required')
  }
  return invoke<void>('kill_process', { connectionId })
}

/**
 * List all active processes
 */
export async function listProcesses(): Promise<ProcessInfo[]> {
  if (!isTauri()) {
    return []
  }
  return invoke<ProcessInfo[]>('list_processes')
}

/**
 * Get process info by connection ID
 */
export async function getProcessInfo(connectionId: string): Promise<ProcessInfo> {
  if (!isTauri()) {
    throw new Error('Tauri context required')
  }
  return invoke<ProcessInfo>('get_process_info', { connectionId })
}

// Alias for backwards compatibility
export const closeMCPConnection = killProcess
