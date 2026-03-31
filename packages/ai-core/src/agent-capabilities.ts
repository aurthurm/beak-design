import type { AgentConfig } from './agent-config'

export type AgentCapabilitySummary = {
  id: string
  name: string
  type: AgentConfig['type']
  supportsTools: boolean
  streaming: boolean
  transport: 'cloud' | 'local' | 'stdio' | 'http'
}

export function getAgentCapabilitySummary(config: AgentConfig): AgentCapabilitySummary {
  switch (config.type) {
    case 'cloud':
      return {
        id: config.id,
        name: config.name,
        type: config.type,
        supportsTools: true,
        streaming: true,
        transport: 'cloud',
      }
    case 'ollama':
      return {
        id: config.id,
        name: config.name,
        type: config.type,
        supportsTools: true,
        streaming: true,
        transport: 'http',
      }
    case 'mcp':
      return {
        id: config.id,
        name: config.name,
        type: config.type,
        supportsTools: true,
        streaming: true,
        transport: config.command ? 'stdio' : 'http',
      }
    case 'cli':
      return {
        id: config.id,
        name: config.name,
        type: config.type,
        supportsTools: false,
        streaming: true,
        transport: 'stdio',
      }
    default:
      return {
        id: config.id,
        name: config.name,
        type: config.type,
        supportsTools: false,
        streaming: true,
        transport: 'local',
      }
  }
}

