import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, TestTube } from 'lucide-react'
import {
  getAgentConfigs,
  saveAgentConfig,
  deleteAgentConfig,
  validateAgentConfig,
  type AgentConfig,
} from '@/lib/ai/agent-config'
import { detectAllAgents } from '@/lib/ai/agent-detector'

interface AgentConfigDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onConfigChange?: () => void
}

export function AgentConfigDialog({
  open,
  onOpenChange,
  onConfigChange,
}: AgentConfigDialogProps) {
  const [configs, setConfigs] = useState<AgentConfig[]>([])
  const [editingConfig, setEditingConfig] = useState<AgentConfig | null>(null)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    const saved = getAgentConfigs()
    const detected = await detectAllAgents()
    // Merge logic handled by mergeAgentsWithConfigs in selector
    setConfigs(saved)
  }

  const handleSave = () => {
    if (!editingConfig) return

    const validation = validateAgentConfig(editingConfig)
    if (!validation.valid) {
      alert(`Validation errors: ${validation.errors.join(', ')}`)
      return
    }

    saveAgentConfig(editingConfig)
    loadConfigs()
    setEditingConfig(null)
    setIsNew(false)
    onConfigChange?.()
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this agent configuration?')) {
      deleteAgentConfig(id)
      loadConfigs()
      onConfigChange?.()
    }
  }

  const handleNew = () => {
    setEditingConfig({
      id: `agent-${Date.now()}`,
      name: '',
      type: 'ollama',
      enabled: true,
    })
    setIsNew(true)
  }

  const handleTest = async (config: AgentConfig) => {
    // Test agent availability
    try {
      // This would call the adapter's isAvailable method
      // For now, just show a message
      alert(`Testing ${config.name}...`)
    } catch (error) {
      alert(`Test failed: ${error}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agent Configurations</DialogTitle>
          <DialogDescription>
            Configure and manage AI agent connections
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Configured Agents</h3>
            <Button onClick={handleNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </div>

          <div className="space-y-2">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{config.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {config.type} {config.endpoint && `• ${config.endpoint}`}
                    {config.command && `• ${config.command}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleTest(config)}
                  >
                    <TestTube className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingConfig(config)
                      setIsNew(false)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(config.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {configs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No agent configurations. Click "Add Agent" to create one.
              </div>
            )}
          </div>

          {editingConfig && (
            <div className="mt-6 p-4 border rounded-lg space-y-4">
              <h4 className="font-medium">
                {isNew ? 'New Agent' : 'Edit Agent'}
              </h4>

              <div className="space-y-2">
                <Label htmlFor="agent-name">Name</Label>
                <Input
                  id="agent-name"
                  value={editingConfig.name}
                  onChange={(e) =>
                    setEditingConfig({ ...editingConfig, name: e.target.value })
                  }
                  placeholder="Agent name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-type">Type</Label>
                <NativeSelect
                  id="agent-type"
                  value={editingConfig.type}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      type: e.target.value as AgentConfig['type'],
                    })
                  }
                >
                  <option value="cloud">Cloud (Anthropic)</option>
                  <option value="ollama">Ollama</option>
                  <option value="cli">CLI Tool</option>
                  <option value="mcp">MCP Server</option>
                </NativeSelect>
              </div>

              {editingConfig.type === 'ollama' && (
                <div className="space-y-2">
                  <Label htmlFor="agent-endpoint">Endpoint</Label>
                  <Input
                    id="agent-endpoint"
                    value={editingConfig.endpoint || ''}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        endpoint: e.target.value,
                      })
                    }
                    placeholder="http://localhost:11434"
                  />
                </div>
              )}

              {editingConfig.type === 'cli' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="agent-command">Command</Label>
                    <Input
                      id="agent-command"
                      value={editingConfig.command || ''}
                      onChange={(e) =>
                        setEditingConfig({
                          ...editingConfig,
                          command: e.target.value,
                        })
                      }
                      placeholder="codex"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-args">Arguments (JSON array)</Label>
                    <Textarea
                      id="agent-args"
                      value={JSON.stringify(editingConfig.args || [])}
                      onChange={(e) => {
                        try {
                          const args = JSON.parse(e.target.value)
                          setEditingConfig({ ...editingConfig, args })
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      placeholder='["--flag", "value"]'
                    />
                  </div>
                </>
              )}

              {editingConfig.type === 'mcp' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="agent-endpoint">Endpoint (optional)</Label>
                    <Input
                      id="agent-endpoint"
                      value={editingConfig.endpoint || ''}
                      onChange={(e) =>
                        setEditingConfig({
                          ...editingConfig,
                          endpoint: e.target.value,
                        })
                      }
                      placeholder="http://localhost:3001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-command">Command (optional)</Label>
                    <Input
                      id="agent-command"
                      value={editingConfig.command || ''}
                      onChange={(e) =>
                        setEditingConfig({
                          ...editingConfig,
                          command: e.target.value,
                        })
                      }
                      placeholder="mcp-server"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingConfig(null)
                    setIsNew(false)
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
