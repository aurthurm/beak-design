import { useState, useEffect } from 'react'
import { NativeSelect } from '@/components/ui/native-select'
import { Button } from '@/components/ui/button'
import { Settings, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { detectAllAgents } from '@/lib/ai/agent-detector'
import {
  getAgentConfigs,
  getDefaultAgentId,
  setDefaultAgentId,
  mergeAgentsWithConfigs,
  type AgentConfig,
} from '@/lib/ai/agent-config'
import type { AgentInfo } from '@/lib/ai/agent-detector'

interface AgentSelectorProps {
  value?: string
  onValueChange?: (agentId: string, config: AgentConfig) => void
  onConfigure?: () => void
  disabled?: boolean
  selectClassName?: string
  modelSelectClassName?: string
  selectWrapperClassName?: string
  modelSelectWrapperClassName?: string
}

export function AgentSelector({
  value,
  onValueChange,
  onConfigure,
  disabled,
  selectClassName,
  selectWrapperClassName,
  modelSelectClassName,
  modelSelectWrapperClassName,
}: AgentSelectorProps) {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  useEffect(() => {
    if (value && agents.length > 0) {
      const agent = agents.find((a) => a.id === value)
      setSelectedAgent(agent || null)
    } else if (!value && agents.length > 0) {
      // Use default or first available
      const defaultId = getDefaultAgentId()
      const agent =
        agents.find((a) => a.id === defaultId) ||
        agents.find((a) => a.enabled) ||
        agents[0]
      if (agent) {
        setSelectedAgent(agent)
        onValueChange?.(agent.id, agent)
      }
    }
  }, [value, agents, onValueChange])

  const loadAgents = async () => {
    setLoading(true)
    try {
      const detected = await detectAllAgents()
      const configs = mergeAgentsWithConfigs(detected)
      setAgents(configs)

      // Set default if not set
      if (!value && configs.length > 0) {
        const defaultId = getDefaultAgentId()
        const agent =
          configs.find((a) => a.id === defaultId) ||
          configs.find((a) => a.enabled) ||
          configs[0]
        if (agent) {
          setSelectedAgent(agent)
          onValueChange?.(agent.id, agent)
        }
      }
    } catch (error) {
      console.error('[AgentSelector] Failed to load agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId)
    if (agent) {
      setSelectedAgent(agent)
      setDefaultAgentId(agentId)
      onValueChange?.(agentId, agent)
    }
  }

  const getAgentStatusIcon = (agent: AgentConfig) => {
    // For now, assume available if enabled
    // In future, could check actual availability
    if (!agent.enabled) {
      return <XCircle className="h-3 w-3 text-muted-foreground" />
    }
    // Show checkmark for available agents
    return <CheckCircle2 className="h-3 w-3 text-green-500" />
  }

  const getAgentDisplayName = (agent: AgentConfig) => {
    // For cloud agents, show provider if available, otherwise just "Cloud"
    if (agent.type === 'cloud') {
      const provider = agent.metadata?.provider || 'Anthropic'
      return provider === 'Anthropic' ? 'Cloud' : `${provider} (Cloud)`
    }
    
    // For other types, show clean name without type suffix
    if (agent.name.includes(`(${agent.type})`)) {
      return agent.name.replace(` (${agent.type})`, '').trim()
    }
    
    return agent.name
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Detecting agents...</span>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No agents available
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        value={selectedAgent?.id || ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className={cn('min-w-[120px] w-auto', selectClassName)}
        wrapperClassName={selectWrapperClassName}
      >
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {getAgentDisplayName(agent)}
          </option>
        ))}
      </NativeSelect>

      {onConfigure && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onConfigure}
          disabled={disabled}
          className="h-8 w-8"
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}

      {selectedAgent?.type === 'ollama' && selectedAgent.metadata?.models && (
        <NativeSelect
          value={selectedAgent.model || ''}
          onChange={(e) => {
            const updated = { ...selectedAgent, model: e.target.value }
            handleChange(updated.id)
            onValueChange?.(updated.id, updated)
          }}
          disabled={disabled}
          className={cn('w-[120px]', modelSelectClassName)}
          wrapperClassName={modelSelectWrapperClassName}
        >
          {selectedAgent.metadata.models.map((model: string) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  )
}
