/**
 * MCP Server Adapter
 * Connects to local MCP servers using Model Context Protocol
 * Supports both HTTP and stdio transports
 */

import { BaseAgentAdapter } from './index'
import type { AgentConfig, ChatRequest, ChatDelta } from './index'
import {
  isTauri,
  sendMCPMessage,
  readMCPResponse,
} from '@/lib/tauri'
import { connectionManager } from '../connection-manager'

export class MCPAgentAdapter extends BaseAgentAdapter {
  name = 'MCP Server'
  config: AgentConfig
  private connectionId?: string

  constructor(config: AgentConfig) {
    super()
    this.config = config
  }

  async isAvailable(): Promise<boolean> {
    // Check if we have either endpoint or command
    if (!this.config.endpoint && !this.config.command) {
      return false
    }

    // For stdio, check if we're in Tauri context
    if (this.config.command && !isTauri()) {
      return false
    }

    // Check connection status
    const status = connectionManager.getConnectionStatus(this.config.id)
    return status === 'connected'
  }

  supportsTools(): boolean {
    return true // MCP servers support tools
  }

  async getAvailableModels(): Promise<string[]> {
    // MCP servers don't typically expose model lists
    return []
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnected(): Promise<void> {
    const status = connectionManager.getConnectionStatus(this.config.id)

    if (status === 'connected') {
      // Get connection info to set connectionId
      const connection = connectionManager.getConnection(this.config.id)
      if (connection?.connectionId) {
        this.connectionId = connection.connectionId
      }
      return
    }

    if (status === 'connecting') {
      // Wait for connection to complete
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          unsubscribe()
          reject(new Error('Connection timeout'))
        }, 10000)

        const unsubscribe = connectionManager.subscribe((connections) => {
          const conn = connections.find((c) => c.agentId === this.config.id)
          if (conn?.status === 'connected') {
            clearTimeout(timeout)
            unsubscribe()
            this.connectionId = conn.connectionId
            resolve()
          } else if (conn?.status === 'error') {
            clearTimeout(timeout)
            unsubscribe()
            reject(new Error(conn.error || 'Connection failed'))
          }
        })
      })
      return
    }

    // Not connected, initiate connection
    await connectionManager.testConnection(this.config)
    const connection = connectionManager.getConnection(this.config.id)
    if (connection?.connectionId) {
      this.connectionId = connection.connectionId
    }
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatDelta> {
    try {
      // Ensure connection is established
      await this.ensureConnected()

      // Route to appropriate transport
      if (this.config.command && isTauri() && this.connectionId) {
        yield* this.streamViaStdio(request)
      } else if (this.config.endpoint) {
        yield* this.streamViaHTTP(request)
      } else {
        yield this.createError('MCP server requires endpoint or command')
      }
    } catch (error) {
      yield this.createError(
        `MCP error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async *streamViaHTTP(request: ChatRequest): AsyncIterable<ChatDelta> {
    // HTTP-based MCP server
    const endpoint = this.config.endpoint!
    const url = `${endpoint}/chat`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: request.messages,
          system: request.system,
        }),
      })

      if (!response.ok) {
        yield this.createError(`MCP HTTP error: ${response.statusText}`)
        return
      }

      // Handle streaming response if available
      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'text-delta') {
                  yield this.createTextDelta(data.content || '')
                } else if (data.type === 'tool-call') {
                  yield this.createToolCall(data.name, data.input)
                } else if (data.type === 'tool-result') {
                  yield this.createToolResult(data.name, data.result, data.error)
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } else {
        // Non-streaming response
        const data = await response.json()
        if (data.text) {
          for (const char of data.text) {
            yield this.createTextDelta(char)
          }
        }
      }

      yield this.createDone()
    } catch (error) {
      yield this.createError(
        `MCP HTTP error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async *streamViaStdio(request: ChatRequest): AsyncIterable<ChatDelta> {
    if (!this.connectionId) {
      yield this.createError('MCP stdio connection not established')
      return
    }

    try {
      // Create JSON-RPC request for MCP server
      const rpcRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'chat',
          arguments: {
            messages: request.messages,
            system: request.system,
          },
        },
      }

      // Send request to MCP server
      await sendMCPMessage(this.connectionId, JSON.stringify(rpcRequest))

      // Read response
      const response = await readMCPResponse(this.connectionId)

      if (!response) {
        yield this.createError('Empty response from MCP server')
        return
      }

      try {
        const rpcResponse = JSON.parse(response)

        if (rpcResponse.error) {
          yield this.createError(
            `MCP error: ${rpcResponse.error.message || 'Unknown error'}`
          )
          return
        }

        // Parse MCP response and yield deltas
        if (rpcResponse.result) {
          const result = rpcResponse.result

          // Handle text response
          if (result.content) {
            for (const char of result.content) {
              yield this.createTextDelta(char)
            }
          }

          // Handle tool calls
          if (result.tool_calls) {
            for (const toolCall of result.tool_calls) {
              yield this.createToolCall(toolCall.name, toolCall.input)
            }
          }

          // Handle tool results
          if (result.tool_results) {
            for (const toolResult of result.tool_results) {
              yield this.createToolResult(
                toolResult.name,
                toolResult.result,
                toolResult.error
              )
            }
          }
        }

        yield this.createDone()
      } catch (parseError) {
        yield this.createError(
          `Failed to parse MCP response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        )
      }
    } catch (error) {
      yield this.createError(
        `MCP stdio error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
