/**
 * Agent Configuration Management
 * Stores and manages agent configurations with localStorage persistence
 */

import type { AgentInfo } from './agent-detector'

export interface AgentConfig {
  id: string
  name: string
  type: 'cloud' | 'ollama' | 'cli' | 'mcp'
  endpoint?: string
  command?: string
  args?: string[]
  enabled: boolean
  model?: string // For Ollama
  metadata?: Record<string, any>
}

const STORAGE_KEY = 'beak-agent-configs'
const DEFAULT_CONFIG_KEY = 'beak-default-agent'

/** Single supported cloud provider for now; others added later */
export const DEFAULT_AGENT_ID = 'cloud-anthropic'
export const DEFAULT_CLOUD_MODEL = 'claude-3-5-sonnet-20241022'

/**
 * Get all agent configurations
 */
export function getAgentConfigs(): AgentConfig[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('[Agent Config] Failed to load configs:', error)
  }

  return []
}

/**
 * Save agent configurations
 */
export function saveAgentConfigs(configs: AgentConfig[]): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  } catch (error) {
    console.error('[Agent Config] Failed to save configs:', error)
  }
}

/**
 * Get a specific agent configuration
 */
export function getAgentConfig(id: string): AgentConfig | null {
  const configs = getAgentConfigs()
  return configs.find((c) => c.id === id) || null
}

/**
 * Save or update an agent configuration
 */
export function saveAgentConfig(config: AgentConfig): void {
  const configs = getAgentConfigs()
  const index = configs.findIndex((c) => c.id === config.id)

  if (index >= 0) {
    configs[index] = config
  } else {
    configs.push(config)
  }

  saveAgentConfigs(configs)
}

/**
 * Delete an agent configuration
 */
export function deleteAgentConfig(id: string): void {
  const configs = getAgentConfigs()
  const filtered = configs.filter((c) => c.id !== id)
  saveAgentConfigs(filtered)
}

/**
 * Get default agent ID. Always returns cloud-anthropic for now.
 */
export function getDefaultAgentId(): string | null {
  if (typeof window === 'undefined') {
    return DEFAULT_AGENT_ID
  }

  try {
    const stored = localStorage.getItem(DEFAULT_CONFIG_KEY)
    return stored || DEFAULT_AGENT_ID
  } catch {
    return DEFAULT_AGENT_ID
  }
}

/**
 * Set default agent ID
 */
export function setDefaultAgentId(agentId: string | null): void {
  if (typeof window === 'undefined') {
    return
  }

  if (agentId) {
    localStorage.setItem(DEFAULT_CONFIG_KEY, agentId)
  } else {
    localStorage.removeItem(DEFAULT_CONFIG_KEY)
  }
}

/**
 * Create configuration from detected agent info
 */
export function createConfigFromAgentInfo(agent: AgentInfo): AgentConfig {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    endpoint: agent.endpoint,
    command: agent.command,
    args: agent.args,
    enabled: true,
    model: agent.metadata?.models?.[0], // Default to first model for Ollama
    metadata: agent.metadata,
  }
}

/**
 * Merge detected agents with saved configurations
 * Saved configs override detected agents
 */
export function mergeAgentsWithConfigs(
  detectedAgents: AgentInfo[]
): AgentConfig[] {
  const savedConfigs = getAgentConfigs()
  const configs: AgentConfig[] = []

  // Start with detected agents
  for (const agent of detectedAgents) {
    const saved = savedConfigs.find((c) => c.id === agent.id)
    if (saved) {
      // Use saved config but update with current detection status
      configs.push({
        ...saved,
        enabled: saved.enabled && agent.status === 'available',
      })
    } else {
      // Create new config from detected agent
      configs.push(createConfigFromAgentInfo(agent))
    }
  }

  // Add saved configs that weren't detected (manual configs)
  for (const saved of savedConfigs) {
    if (!configs.find((c) => c.id === saved.id)) {
      configs.push(saved)
    }
  }

  return configs
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: AgentConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!config.id) {
    errors.push('Agent ID is required')
  }

  if (!config.name) {
    errors.push('Agent name is required')
  }

  if (!['cloud', 'ollama', 'cli', 'mcp'].includes(config.type)) {
    errors.push('Invalid agent type')
  }

  if (config.type === 'ollama' && !config.endpoint) {
    errors.push('Ollama agent requires endpoint')
  }

  if (config.type === 'cli' && !config.command) {
    errors.push('CLI agent requires command')
  }

  if (config.type === 'mcp' && !config.endpoint && !config.command) {
    errors.push('MCP agent requires endpoint or command')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
