/**
 * Connection Manager
 * Manages active MCP/CLI connections and provides singleton access
 */

import type { AgentConfig } from './agent-config'
import {
  spawnMCPServer,
  killProcess,
  isTauri,
} from '@/lib/tauri'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ConnectionInfo {
  agentId: string
  status: ConnectionStatus
  connectionId?: string // For stdio MCP connections
  error?: string
  connectedAt?: Date
}

/**
 * Connection Manager Singleton
 * Manages active connections to MCP servers and other agents
 */
class ConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map()
  private listeners: Set<(connections: ConnectionInfo[]) => void> = new Set()

  /**
   * Get all active connections
   */
  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get connection status for agent
   */
  getConnectionStatus(agentId: string): ConnectionStatus {
    return this.connections.get(agentId)?.status || 'disconnected'
  }

  /**
   * Get connection info for agent
   */
  getConnection(agentId: string): ConnectionInfo | undefined {
    return this.connections.get(agentId)
  }

  /**
   * Subscribe to connection changes
   */
  subscribe(listener: (connections: ConnectionInfo[]) => void): () => void {
    this.listeners.add(listener)
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of connection changes
   */
  private notify(): void {
    const connections = this.getConnections()
    this.listeners.forEach((listener) => listener(connections))
  }

  /**
   * Update connection status
   */
  private updateConnection(
    agentId: string,
    update: Partial<ConnectionInfo>
  ): void {
    const current = this.connections.get(agentId) || { agentId, status: 'disconnected' }
    this.connections.set(agentId, { ...current, ...update })
    this.notify()
  }

  /**
   * Connect to MCP server using stdio transport (Tauri only)
   */
  async connectMCPStdio(config: AgentConfig): Promise<void> {
    if (!isTauri()) {
      throw new Error('Stdio MCP connections require Tauri environment')
    }

    if (!config.command) {
      throw new Error('MCP stdio connection requires command')
    }

    this.updateConnection(config.id, { status: 'connecting' })

    try {
      // Spawn the MCP server process
      const connectionId = await spawnMCPServer(
        config.command,
        config.args || []
      )

      this.updateConnection(config.id, {
        status: 'connected',
        connectionId,
        connectedAt: new Date(),
        error: undefined,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.updateConnection(config.id, {
        status: 'error',
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Connect to MCP server using HTTP transport
   */
  async connectMCPHTTP(config: AgentConfig): Promise<void> {
    if (!config.endpoint) {
      throw new Error('MCP HTTP connection requires endpoint')
    }

    this.updateConnection(config.id, { status: 'connecting' })

    try {
      // Test the HTTP endpoint
      const response = await fetch(`${config.endpoint}/health`, {
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      this.updateConnection(config.id, {
        status: 'connected',
        connectedAt: new Date(),
        error: undefined,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.updateConnection(config.id, {
        status: 'error',
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Connect to Ollama server
   */
  async connectOllama(config: AgentConfig): Promise<void> {
    if (!config.endpoint) {
      throw new Error('Ollama connection requires endpoint')
    }

    this.updateConnection(config.id, { status: 'connecting' })

    try {
      // Test Ollama endpoint
      const response = await fetch(`${config.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      this.updateConnection(config.id, {
        status: 'connected',
        connectedAt: new Date(),
        error: undefined,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.updateConnection(config.id, {
        status: 'error',
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Test connection to agent
   */
  async testConnection(config: AgentConfig): Promise<void> {
    switch (config.type) {
      case 'mcp':
        if (config.command && isTauri()) {
          return this.connectMCPStdio(config)
        } else if (config.endpoint) {
          return this.connectMCPHTTP(config)
        }
        throw new Error('MCP connection requires either command (Tauri) or endpoint')

      case 'ollama':
        return this.connectOllama(config)

      case 'cli':
        // CLI tools are executed per-request, no persistent connection needed
        this.updateConnection(config.id, {
          status: 'connected',
          connectedAt: new Date(),
        })
        return

      case 'cloud':
        // Cloud agents don't need connection testing
        this.updateConnection(config.id, {
          status: 'connected',
          connectedAt: new Date(),
        })
        return

      default:
        throw new Error(`Unknown agent type: ${config.type}`)
    }
  }

  /**
   * Disconnect from agent
   */
  async disconnect(agentId: string): Promise<void> {
    const connection = this.connections.get(agentId)
    if (!connection) {
      return
    }

    // Close stdio connection if exists
    if (connection.connectionId && isTauri()) {
      try {
        await killProcess(connection.connectionId)
      } catch (error) {
        console.error(`Failed to kill process: ${error}`)
      }
    }

    this.connections.delete(agentId)
    this.notify()
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    const agentIds = Array.from(this.connections.keys())
    await Promise.all(agentIds.map((id) => this.disconnect(id)))
  }

  /**
   * Auto-reconnect to agent
   */
  async reconnect(config: AgentConfig): Promise<void> {
    await this.disconnect(config.id)
    await this.testConnection(config)
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager()
