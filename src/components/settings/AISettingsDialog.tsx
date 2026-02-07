import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import {
  saveAgentConfig,
  setDefaultAgentId,
  getAgentConfig,
  DEFAULT_AGENT_ID,
  type AgentConfig,
} from '@/lib/ai/agent-config'

interface AISettingsDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const ANTHROPIC_STORAGE_KEY = 'ai-api-key-anthropic'

export function AISettingsDialog({
  open,
  onOpenChange,
}: AISettingsDialogProps) {
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    if (!open) return
    // Load saved API key from localStorage (masked)
    const savedKey = localStorage.getItem(ANTHROPIC_STORAGE_KEY)
    if (savedKey && savedKey.length > 8) {
      setApiKey(savedKey.substring(0, 8) + '...')
    } else if (savedKey) {
      setApiKey(savedKey)
    }
    // Load saved model from agent config if any
    const config = getAgentConfig(DEFAULT_AGENT_ID)
    if (config?.metadata?.model) {
      setSelectedModel(config.metadata.model)
    }
  }, [open])

  const handleSave = () => {
    const isNewKey = apiKey && !apiKey.includes('...')
    if (!apiKey) {
      alert('Please enter your API key')
      return
    }
    if (isNewKey) {
      localStorage.setItem(ANTHROPIC_STORAGE_KEY, apiKey)
    }

    const cloudConfig: AgentConfig = {
      id: DEFAULT_AGENT_ID,
      name: 'Cloud',
      type: 'cloud',
      enabled: true,
      metadata: {
        provider: 'anthropic',
        model: selectedModel,
        apiKey: isNewKey ? apiKey : undefined,
      },
    }
    saveAgentConfig(cloudConfig)
    setDefaultAgentId(DEFAULT_AGENT_ID)
    onOpenChange?.(false)
  }

  const anthropicModels = [
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Assistant Settings</DialogTitle>
          <DialogDescription>
            Configure Anthropic Claude (Cloud). Other providers will be added later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="anthropic-model">Model</Label>
            <NativeSelect
              id="anthropic-model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {anthropicModels.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="anthropic-api-key">API Key</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </Button>
            </div>
            <Input
              id="anthropic-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
            <p className="text-xs text-muted-foreground">
              Your API key is stored locally and never sent to our servers
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
