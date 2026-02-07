/**
 * Local Agents Settings Component
 * Shows CLI tools and MCP servers (not Ollama - that's in LocalLLMSettings)
 */

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Alert } from '@/components/ui/alert'
import {
  detectCLITools,
  detectMCPServers,
  isTauri,
} from '@/lib/tauri'
import { connectionManager, type ConnectionInfo } from '@/lib/ai/connection-manager'
import { getAgentConfig } from '@/lib/ai/agent-config'

interface DetectedAgent {
  id: string
  name: string
  type: string
  status: 'available' | 'unavailable'
  endpoint?: string
  command?: string
  args?: string[]
  metadata?: any
}

export function LocalAgentsSettings() {
  const [loading, setLoading] = useState(false)
  const [cliTools, setCLITools] = useState<DetectedAgent[]>([])
  const [mcpServers, setMCPServers] = useState<DetectedAgent[]>([])
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [testingConnection, setTestingConnection] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load detected agents
  useEffect(() => {
    loadAgents()
  }, [])

  // Subscribe to connection changes
  useEffect(() => {
    const unsubscribe = connectionManager.subscribe((conns) => {
      setConnections(conns)
    })
    // Initial load
    setConnections(connectionManager.getConnections())
    return unsubscribe
  }, [])

  const loadAgents = async () => {
    if (!isTauri()) {
      setError('Local agent detection requires Tauri environment (desktop app)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Detect CLI tools
      const cliResult = await detectCLITools()
      setCLITools(
        cliResult.map((tool) => ({
          id: tool.id,
          name: tool.name,
          type: tool.type,
          status: tool.status as 'available',
          command: tool.command,
          metadata: tool.metadata,
        }))
      )

      // Detect MCP servers
      const mcpResult = await detectMCPServers()
      setMCPServers(
        mcpResult.map((server) => ({
          id: server.id,
          name: server.name,
          type: server.type,
          status: server.status as 'available',
          endpoint: server.endpoint,
          command: server.command,
          args: server.args,
          metadata: server.metadata,
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect agents')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async (agent: DetectedAgent) => {
    setTestingConnection(agent.id)
    setError(null)

    try {
      // Get or create agent config
      let config = getAgentConfig(agent.id)
      if (!config) {
        config = {
          id: agent.id,
          name: agent.name,
          type: agent.type as any,
          endpoint: agent.endpoint,
          command: agent.command,
          args: agent.args,
          enabled: true,
          metadata: agent.metadata,
        }
      }

      // Test connection
      await connectionManager.testConnection(config)
    } catch (err) {
      setError(
        `Connection test failed for ${agent.name}: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setTestingConnection(null)
    }
  }

  const disconnect = async (agentId: string) => {
    try {
      await connectionManager.disconnect(agentId)
    } catch (err) {
      setError(
        `Disconnect failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  const getConnectionStatus = (agentId: string) => {
    const conn = connections.find((c) => c.agentId === agentId)
    return conn?.status || 'disconnected'
  }

  const renderAgentCard = (agent: DetectedAgent) => {
    const status = getConnectionStatus(agent.id)
    const isTesting = testingConnection === agent.id

    return (
      <Card key={agent.id} className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{agent.name}</h4>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  status === 'connected'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : status === 'connecting'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : status === 'error'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                {status}
              </span>
            </div>

            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {agent.endpoint && (
                <div>
                  <span className="font-medium">Endpoint:</span> {agent.endpoint}
                </div>
              )}
              {agent.command && (
                <div>
                  <span className="font-medium">Command:</span> {agent.command}
                  {agent.args && agent.args.length > 0 && ` ${agent.args.join(' ')}`}
                </div>
              )}
              {agent.metadata?.version && (
                <div>
                  <span className="font-medium">Version:</span> {agent.metadata.version}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 ml-4">
            {status === 'connected' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => disconnect(agent.id)}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => testConnection(agent)}
                disabled={isTesting || status === 'connecting'}
              >
                {isTesting || status === 'connecting' ? (
                  <>
                    <Spinner className="mr-2 h-3 w-3" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  if (!isTauri()) {
    return (
      <Alert>
        <p className="font-medium">Desktop App Required</p>
        <p>Local agent detection is only available in the desktop app (Tauri).</p>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Local Agents (CLI & MCP)</h3>
          <p className="text-sm text-muted-foreground">
            CLI tools and MCP servers detected on your system
          </p>
        </div>
        <Button onClick={loadAgents} disabled={loading} variant="outline">
          {loading ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Detecting...
            </>
          ) : (
            'Refresh'
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      {/* CLI Tools */}
      {cliTools.length > 0 && (
        <div className="space-y-2">
          <Label>CLI Tools</Label>
          <div className="space-y-2">
            {cliTools.map((tool) => renderAgentCard(tool))}
          </div>
        </div>
      )}

      {/* MCP Servers */}
      {mcpServers.length > 0 && (
        <div className="space-y-2">
          <Label>MCP Servers</Label>
          <div className="space-y-2">
            {mcpServers.map((server) => renderAgentCard(server))}
          </div>
        </div>
      )}

      {/* No agents detected */}
      {!loading && cliTools.length === 0 && mcpServers.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">
          <p>No CLI tools or MCP servers detected.</p>
          <p className="text-sm mt-2">
            Install CLI tools (codex, geminicli, claudecode) or configure MCP servers to get started.
          </p>
        </Card>
      )}
    </div>
  )
}
