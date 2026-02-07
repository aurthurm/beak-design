/**
 * Connection Manager Tests
 * Basic tests to verify connection manager functionality
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { connectionManager } from '../connection-manager'
import type { AgentConfig } from '../agent-config'

describe('ConnectionManager', () => {
  beforeEach(() => {
    // Reset connections before each test
    connectionManager.disconnectAll()
  })

  it('should start with no connections', () => {
    const connections = connectionManager.getConnections()
    expect(connections).toHaveLength(0)
  })

  it('should return disconnected status for unknown agent', () => {
    const status = connectionManager.getConnectionStatus('unknown-agent')
    expect(status).toBe('disconnected')
  })

  it('should allow subscribing to connection changes', () => {
    let callCount = 0
    const unsubscribe = connectionManager.subscribe(() => {
      callCount++
    })

    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('should handle cloud agent connection', async () => {
    const config: AgentConfig = {
      id: 'test-cloud',
      name: 'Test Cloud',
      type: 'cloud',
      enabled: true,
    }

    await connectionManager.testConnection(config)
    const status = connectionManager.getConnectionStatus(config.id)
    expect(status).toBe('connected')

    await connectionManager.disconnect(config.id)
    const statusAfter = connectionManager.getConnectionStatus(config.id)
    expect(statusAfter).toBe('disconnected')
  })

  it('should track connection info', async () => {
    const config: AgentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      type: 'cloud',
      enabled: true,
    }

    await connectionManager.testConnection(config)
    const connection = connectionManager.getConnection(config.id)

    expect(connection).toBeDefined()
    expect(connection?.agentId).toBe(config.id)
    expect(connection?.status).toBe('connected')
    expect(connection?.connectedAt).toBeInstanceOf(Date)
  })

  it('should handle multiple connections', async () => {
    const config1: AgentConfig = {
      id: 'agent-1',
      name: 'Agent 1',
      type: 'cloud',
      enabled: true,
    }

    const config2: AgentConfig = {
      id: 'agent-2',
      name: 'Agent 2',
      type: 'cloud',
      enabled: true,
    }

    await connectionManager.testConnection(config1)
    await connectionManager.testConnection(config2)

    const connections = connectionManager.getConnections()
    expect(connections).toHaveLength(2)
  })

  it('should disconnect all connections', async () => {
    const configs: AgentConfig[] = [
      { id: 'agent-1', name: 'Agent 1', type: 'cloud', enabled: true },
      { id: 'agent-2', name: 'Agent 2', type: 'cloud', enabled: true },
      { id: 'agent-3', name: 'Agent 3', type: 'cloud', enabled: true },
    ]

    for (const config of configs) {
      await connectionManager.testConnection(config)
    }

    expect(connectionManager.getConnections()).toHaveLength(3)

    await connectionManager.disconnectAll()

    expect(connectionManager.getConnections()).toHaveLength(0)
  })
})
