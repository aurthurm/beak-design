/**
 * Local LLM Settings Component
 * Shows Ollama and other local LLM servers
 */

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Alert } from '@/components/ui/alert'
import {
  detectOllama,
  isTauri,
} from '@/lib/tauri'
import { connectionManager, type ConnectionInfo } from '@/lib/ai/connection-manager'
import { getAgentConfig } from '@/lib/ai/agent-config'

interface DetectedLLM {
  id: string
  name: string
  type: string
  status: 'available' | 'unavailable'
  endpoint?: string
  metadata?: {
    models?: string[]
    version?: string
  }
}

export function LocalLLMSettings() {
  const [loading, setLoading] = useState(false)
  const [ollama, setOllama] = useState<DetectedLLM | null>(null)
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [testingConnection, setTestingConnection] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load detected LLMs
  useEffect(() => {
    loadLLMs()
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

  const loadLLMs = async () => {
    if (!isTauri()) {
      setError('Local LLM detection requires Tauri environment (desktop app)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Detect Ollama
      const ollamaResult = await detectOllama()
      if (ollamaResult.available) {
        setOllama({
          id: 'ollama-local',
          name: 'Ollama (Local)',
          type: 'ollama',
          status: 'available',
          endpoint: 'http://localhost:11434',
          metadata: {
            models: ollamaResult.models.map((m) => m.name),
          },
        })
      } else {
        setOllama(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect local LLMs')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async (llm: DetectedLLM) => {
    setTestingConnection(llm.id)
    setError(null)

    try {
      // Get or create agent config
      let config = getAgentConfig(llm.id)
      if (!config) {
        config = {
          id: llm.id,
          name: llm.name,
          type: llm.type as any,
          endpoint: llm.endpoint,
          enabled: true,
          metadata: llm.metadata,
        }
      }

      // Test connection
      await connectionManager.testConnection(config)
    } catch (err) {
      setError(
        `Connection test failed for ${llm.name}: ${err instanceof Error ? err.message : String(err)}`
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

  const renderLLMCard = (llm: DetectedLLM) => {
    const status = getConnectionStatus(llm.id)
    const isTesting = testingConnection === llm.id

    return (
      <Card key={llm.id} className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{llm.name}</h4>
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
              {llm.endpoint && (
                <div>
                  <span className="font-medium">Endpoint:</span> {llm.endpoint}
                </div>
              )}
              {llm.metadata?.version && (
                <div>
                  <span className="font-medium">Version:</span> {llm.metadata.version}
                </div>
              )}
              {llm.metadata?.models && llm.metadata.models.length > 0 && (
                <div>
                  <span className="font-medium">Models ({llm.metadata.models.length}):</span>{' '}
                  {llm.metadata.models.slice(0, 3).join(', ')}
                  {llm.metadata.models.length > 3 &&
                    ` (+${llm.metadata.models.length - 3} more)`}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 ml-4">
            {status === 'connected' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => disconnect(llm.id)}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => testConnection(llm)}
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
        <p>Local LLM detection is only available in the desktop app (Tauri).</p>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Local LLM Servers</h3>
          <p className="text-sm text-muted-foreground">
            Ollama and other local language models running on your machine
          </p>
        </div>
        <Button onClick={loadLLMs} disabled={loading} variant="outline">
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

      {/* Ollama */}
      {ollama && (
        <div className="space-y-2">
          <Label>Ollama</Label>
          {renderLLMCard(ollama)}
        </div>
      )}

      {/* TODO: Add support for other local LLMs here */}
      {/* e.g., LM Studio, LocalAI, etc. */}

      {/* No LLMs detected */}
      {!loading && !ollama && (
        <Card className="p-6 text-center text-muted-foreground">
          <p>No local LLM servers detected.</p>
          <p className="text-sm mt-2">
            Install and run Ollama to use local language models.
          </p>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://ollama.com', '_blank')}
            >
              Download Ollama
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
