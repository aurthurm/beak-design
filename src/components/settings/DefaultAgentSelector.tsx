/**
 * Default Agent Selector Component
 * Allows user to select which agent/model is the default for AI Chat
 */

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Alert } from '@/components/ui/alert'
import {
  getAgentConfigs,
  getDefaultAgentId,
  setDefaultAgentId,
} from '@/lib/ai/agent-config'
import {
  detectOllama,
  detectCLITools,
  detectMCPServers,
  isTauri,
} from '@/lib/tauri'

interface AgentOption {
  id: string
  name: string
  type: 'cloud' | 'ollama' | 'cli' | 'mcp'
  description: string
  available: boolean
  icon: string
}

export function DefaultAgentSelector() {
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAgents()
    // Load current default
    const defaultId = getDefaultAgentId()
    setSelectedAgent(defaultId)
  }, [])

  const loadAgents = async () => {
    setLoading(true)
    setError(null)

    try {
      const allAgents: AgentOption[] = []

      // Load saved cloud agents
      const savedConfigs = getAgentConfigs()
      const cloudAgents = savedConfigs.filter((c) => c.type === 'cloud' && c.enabled)

      cloudAgents.forEach((agent) => {
        const modelName = agent.metadata?.model || agent.model || 'Unknown'
        allAgents.push({
          id: agent.id,
          name: agent.name,
          type: 'cloud',
          description: `Cloud AI (${modelName})`,
          available: true,
          icon: '☁️',
        })
      })

      // Detect local agents (only in Tauri)
      if (isTauri()) {
        // Detect Ollama
        try {
          const ollamaResult = await detectOllama()
          if (ollamaResult.available) {
            // Add an option for each Ollama model
            ollamaResult.models.forEach((model) => {
              allAgents.push({
                id: `ollama-local:${model.name}`,
                name: `Ollama - ${model.name}`,
                type: 'ollama',
                description: `Local LLM (Ollama)`,
                available: true,
                icon: '🦙',
              })
            })
          }
        } catch (err) {
          console.error('Failed to detect Ollama:', err)
        }

        // Detect CLI tools
        try {
          const cliTools = await detectCLITools()
          cliTools.forEach((tool) => {
            allAgents.push({
              id: tool.id,
              name: tool.name,
              type: 'cli',
              description: `CLI Tool (${tool.type})`,
              available: tool.status === 'available',
              icon: '⚡',
            })
          })
        } catch (err) {
          console.error('Failed to detect CLI tools:', err)
        }

        // Detect MCP servers
        try {
          const mcpServers = await detectMCPServers()
          mcpServers.forEach((server) => {
            allAgents.push({
              id: server.id,
              name: server.name,
              type: 'mcp',
              description: `MCP Server`,
              available: server.status === 'available',
              icon: '🔌',
            })
          })
        } catch (err) {
          console.error('Failed to detect MCP servers:', err)
        }
      }

      setAgents(allAgents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    setSaving(true)
    try {
      setDefaultAgentId(selectedAgent)
      // Show success (you can add a toast notification here)
      setTimeout(() => setSaving(false), 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save default agent')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="h-6 w-6 mr-2" />
        <span className="text-sm text-muted-foreground">Loading agents...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        {error}
      </Alert>
    )
  }

  if (agents.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <p>No agents configured.</p>
        <p className="text-sm mt-2">
          Configure a cloud agent or install local agents to get started.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Default AI Agent</h3>
        <p className="text-sm text-muted-foreground">
          Select which agent/model to use by default in the AI Chat
        </p>
      </div>

      <div className="space-y-2">
        {agents.map((agent) => (
          <Card
            key={agent.id}
            className={`p-4 cursor-pointer transition-colors ${
              selectedAgent === agent.id
                ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2'
                : 'hover:border-primary/50'
            } ${!agent.available ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => agent.available && setSelectedAgent(agent.id)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedAgent === agent.id
                  ? 'border-primary bg-primary'
                  : 'border-gray-300 dark:border-gray-600'
              }`}>
                {selectedAgent === agent.id && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1 flex items-center gap-3">
                <span className="text-2xl">{agent.icon}</span>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {agent.name}
                    {!agent.available && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        Unavailable
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {agent.description}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={loadAgents} disabled={loading}>
          {loading ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Refreshing...
            </>
          ) : (
            'Refresh Agents'
          )}
        </Button>

        <Button onClick={handleSave} disabled={!selectedAgent || saving}>
          {saving ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Saving...
            </>
          ) : (
            'Save Default Agent'
          )}
        </Button>
      </div>

      {selectedAgent && (
        <Alert className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-baseline gap-1">
            <span className="font-semibold">Selected:</span>
            <span>
              {agents.find((a) => a.id === selectedAgent)?.name || selectedAgent}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            This agent will be used by default in new chat conversations.
          </p>
        </Alert>
      )}
    </div>
  )
}
