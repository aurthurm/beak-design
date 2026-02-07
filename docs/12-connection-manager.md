# Connection Manager

## Overview

The Connection Manager handles lifecycle management for AI agent connections including Ollama, CLI tools, and MCP servers. It provides auto-detection, connection pooling, status tracking, and event-based updates.

## Architecture

```
ConnectionManager (Singleton)
    ├── Detection Layer (Auto-detect agents)
    ├── Connection Pool (Active connections)
    ├── Status Tracking (Real-time updates)
    └── Event System (Subscribe to changes)
        ↓
Agent Adapters
    ├── Cloud (Anthropic API)
    ├── Ollama (HTTP)
    ├── CLI Tools (stdio)
    └── MCP Servers (stdio)
        ↓
Tauri Backend
    ├── detect_ollama()
    ├── detect_cli_tools()
    ├── detect_mcp_servers()
    ├── spawn_mcp_server()
    └── spawn_cli_agent()
```

## Key Features

- **Auto-Detection** - Automatically finds available agents on startup
- **Connection Pooling** - Reuses existing connections
- **Status Tracking** - Real-time connection status
- **Event System** - Subscribe to connection changes
- **Error Handling** - Graceful degradation
- **Type Safety** - Full TypeScript types

## API Reference

### ConnectionManager Class

Located in `src/lib/ai/connection-manager.ts`

#### Singleton Instance

```typescript
import { connectionManager } from '@/lib/ai/connection-manager'

// Single instance across app
const status = connectionManager.getConnectionStatus('ollama')
```

#### `detectAgents(): Promise<void>`

Auto-detect all available agents.

```typescript
await connectionManager.detectAgents()
// Detects: Ollama, CLI tools, MCP servers
```

**Detection Process:**
1. Calls `detect_ollama()` → Updates Ollama status
2. Calls `detect_cli_tools()` → Finds codex, geminicli, claudecode
3. Calls `detect_mcp_servers()` → Reads MCP config files
4. Emits 'detection_complete' event

#### `getConnectionStatus(agentId: string): ConnectionStatus`

Get current status for specific agent.

```typescript
const status = connectionManager.getConnectionStatus('ollama')

interface ConnectionStatus {
  connected: boolean
  lastChecked?: Date
  error?: string
  metadata?: {
    models?: string[]        // Ollama models
    version?: string         // CLI tool version
    connectionId?: string    // MCP/CLI connection ID
  }
}
```

#### `getAllStatuses(): Map<string, ConnectionStatus>`

Get status for all tracked agents.

```typescript
const statuses = connectionManager.getAllStatuses()
statuses.forEach((status, agentId) => {
  console.log(`${agentId}: ${status.connected ? 'online' : 'offline'}`)
})
```

#### `testConnection(config: AgentConfig): Promise<boolean>`

Test connection to specific agent.

```typescript
const config: AgentConfig = {
  id: 'ollama',
  name: 'Ollama',
  type: 'ollama',
  enabled: true
}

const success = await connectionManager.testConnection(config)
if (success) {
  console.log('Connection successful')
}
```

**Connection Tests:**
- **Ollama**: HTTP GET to localhost:11434/api/tags
- **CLI**: Spawn process with `--version` flag
- **MCP**: Spawn process and send `initialize` request

#### `addEventListener(event: string, callback: Function): void`

Subscribe to connection events.

```typescript
connectionManager.addEventListener('status_changed', (data) => {
  console.log(`Agent ${data.agentId} status: ${data.status.connected}`)
})

connectionManager.addEventListener('detection_complete', () => {
  console.log('All agents detected')
})
```

**Events:**
- `status_changed` - Connection status changed
- `detection_complete` - Auto-detection finished
- `connection_error` - Connection attempt failed

#### `removeEventListener(event: string, callback: Function): void`

Unsubscribe from events.

```typescript
const handler = (data) => console.log(data)

connectionManager.addEventListener('status_changed', handler)
// Later...
connectionManager.removeEventListener('status_changed', handler)
```

#### `disconnect(agentId: string): Promise<void>`

Disconnect from specific agent.

```typescript
await connectionManager.disconnect('mcp-filesystem')
// Kills process and cleans up resources
```

#### `disconnectAll(): Promise<void>`

Disconnect from all active agents.

```typescript
await connectionManager.disconnectAll()
// Cleanup on app shutdown
```

## Agent Configuration

### AgentConfig Interface

```typescript
interface AgentConfig {
  id: string
  name: string
  type: 'cloud' | 'ollama' | 'cli' | 'mcp'
  enabled: boolean

  // Type-specific fields

  // Cloud agents
  apiKey?: string
  model?: string

  // Ollama
  baseUrl?: string  // Default: http://localhost:11434

  // CLI tools
  command?: string  // e.g., 'codex', 'geminicli'
  args?: string[]

  // MCP servers
  command?: string  // e.g., 'npx'
  args?: string[]   // e.g., ['-y', '@modelcontextprotocol/server-filesystem']
}
```

### MCP Server Configuration

MCP servers are configured in `~/.config/beak-design/mcp-servers.json`:

```json
{
  "mcpServers": [
    {
      "id": "mcp-filesystem",
      "name": "Filesystem MCP",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
      "enabled": true
    },
    {
      "id": "mcp-github",
      "name": "GitHub MCP",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "enabled": false
    }
  ]
}
```

## Usage Examples

### Basic Setup

```typescript
import { connectionManager } from '@/lib/ai/connection-manager'

// On app startup
async function initializeAgents() {
  // Auto-detect all agents
  await connectionManager.detectAgents()

  // Check what's available
  const statuses = connectionManager.getAllStatuses()

  console.log('Available agents:')
  statuses.forEach((status, agentId) => {
    if (status.connected) {
      console.log(`✓ ${agentId}`)
    }
  })
}

initializeAgents()
```

### React Hook Integration

```typescript
import { useEffect, useState } from 'react'
import { connectionManager } from '@/lib/ai/connection-manager'

function useConnectionStatus(agentId: string) {
  const [status, setStatus] = useState(
    connectionManager.getConnectionStatus(agentId)
  )

  useEffect(() => {
    const handler = (data) => {
      if (data.agentId === agentId) {
        setStatus(data.status)
      }
    }

    connectionManager.addEventListener('status_changed', handler)

    return () => {
      connectionManager.removeEventListener('status_changed', handler)
    }
  }, [agentId])

  return status
}

// Usage in component
function AgentStatus({ agentId }) {
  const status = useConnectionStatus(agentId)

  return (
    <div>
      {status.connected ? '🟢 Online' : '🔴 Offline'}
      {status.error && <span>Error: {status.error}</span>}
    </div>
  )
}
```

### Testing Connections

```typescript
import { connectionManager } from '@/lib/ai/connection-manager'

async function testAllConnections() {
  const configs: AgentConfig[] = [
    {
      id: 'ollama',
      name: 'Ollama',
      type: 'ollama',
      enabled: true
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      type: 'cli',
      command: 'codex',
      enabled: true
    },
    {
      id: 'mcp-filesystem',
      name: 'Filesystem MCP',
      type: 'mcp',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
      enabled: true
    }
  ]

  for (const config of configs) {
    const success = await connectionManager.testConnection(config)
    console.log(`${config.name}: ${success ? 'OK' : 'FAILED'}`)
  }
}
```

### Connection Status UI

```typescript
import { connectionManager } from '@/lib/ai/connection-manager'

function ConnectionStatusPanel() {
  const [statuses, setStatuses] = useState(
    connectionManager.getAllStatuses()
  )

  useEffect(() => {
    const handler = () => {
      setStatuses(new Map(connectionManager.getAllStatuses()))
    }

    connectionManager.addEventListener('status_changed', handler)
    connectionManager.addEventListener('detection_complete', handler)

    // Initial detection
    connectionManager.detectAgents()

    return () => {
      connectionManager.removeEventListener('status_changed', handler)
      connectionManager.removeEventListener('detection_complete', handler)
    }
  }, [])

  return (
    <div>
      <h3>Agent Connections</h3>
      {Array.from(statuses.entries()).map(([agentId, status]) => (
        <div key={agentId}>
          <strong>{agentId}</strong>
          <span>{status.connected ? '🟢' : '🔴'}</span>
          {status.metadata?.models && (
            <small>Models: {status.metadata.models.join(', ')}</small>
          )}
          {status.error && (
            <small style={{ color: 'red' }}>{status.error}</small>
          )}
        </div>
      ))}
    </div>
  )
}
```

## Connection Lifecycle

### 1. Detection Phase

```
App Startup
    ↓
connectionManager.detectAgents()
    ↓
Tauri Commands (detect_ollama, detect_cli_tools, detect_mcp_servers)
    ↓
Update Connection Statuses
    ↓
Emit 'detection_complete' Event
```

### 2. Connection Phase

```
User Selects Agent
    ↓
connectionManager.testConnection(config)
    ↓
Agent Adapter Factory
    ↓
Create/Reuse Connection
    ↓
Update Status (connected: true)
    ↓
Emit 'status_changed' Event
```

### 3. Communication Phase

```
Agent Adapter (active)
    ↓
Send Request (via Tauri or HTTP)
    ↓
Receive Response
    ↓
Stream to Frontend
```

### 4. Disconnection Phase

```
connectionManager.disconnect(agentId)
    ↓
Kill Process (if stdio)
    ↓
Clean Up Resources
    ↓
Update Status (connected: false)
    ↓
Emit 'status_changed' Event
```

## Error Handling

### Connection Errors

```typescript
try {
  await connectionManager.testConnection(config)
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Agent not installed')
  } else if (error.message.includes('refused')) {
    console.error('Connection refused (is server running?)')
  } else if (error.message.includes('timeout')) {
    console.error('Connection timeout')
  } else {
    console.error('Unknown error:', error)
  }
}
```

### Status Checking

```typescript
const status = connectionManager.getConnectionStatus('ollama')

if (!status.connected) {
  if (status.error) {
    console.error('Connection error:', status.error)
  } else {
    console.log('Not connected')
  }
} else {
  console.log('Connected!')
  if (status.metadata?.models) {
    console.log('Available models:', status.metadata.models)
  }
}
```

## Best Practices

### Auto-Detection on Startup

```typescript
// In App.tsx or main entry point
useEffect(() => {
  connectionManager.detectAgents()
}, [])
```

### Connection Cleanup on Unmount

```typescript
useEffect(() => {
  return () => {
    connectionManager.disconnectAll()
  }
}, [])
```

### Retry Logic

```typescript
async function connectWithRetry(config: AgentConfig, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const success = await connectionManager.testConnection(config)
      if (success) return true
    } catch (error) {
      console.log(`Retry ${i + 1}/${maxRetries}`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  return false
}
```

### Status Polling

```typescript
// Poll connection status every 30 seconds
useEffect(() => {
  const interval = setInterval(() => {
    connectionManager.detectAgents()
  }, 30000)

  return () => clearInterval(interval)
}, [])
```

## Security Considerations

### API Key Storage
- Never commit API keys to version control
- Store in localStorage or environment variables
- Clear on logout

### Process Spawning
- Validate commands before spawning
- Use allowlist of trusted commands
- Monitor resource usage

### Network Requests
- Only connect to localhost for Ollama
- Validate URLs before HTTP requests
- Timeout long-running requests

## Performance Optimization

### Connection Pooling
```typescript
// Connections are reused automatically
const adapter1 = await getAgentAdapter('ollama', config)
const adapter2 = await getAgentAdapter('ollama', config)
// adapter1 === adapter2 (same connection)
```

### Lazy Loading
```typescript
// Only connect when needed
const config = getAgentConfig('ollama')
if (!connectionManager.getConnectionStatus('ollama').connected) {
  await connectionManager.testConnection(config)
}
```

### Event Throttling
```typescript
import { debounce } from 'lodash'

const handleStatusChange = debounce((data) => {
  console.log('Status changed:', data)
}, 500)

connectionManager.addEventListener('status_changed', handleStatusChange)
```

## Troubleshooting

### Ollama Not Detected
- Check if Ollama is running: `curl http://localhost:11434/api/tags`
- Verify Ollama installation
- Check firewall settings

### CLI Tools Not Found
- Verify tool is in PATH: `which codex`
- Install missing tools
- Restart application after installation

### MCP Server Fails to Start
- Check command is correct: `npx -y @modelcontextprotocol/server-filesystem`
- Verify npm/npx is installed
- Check process permissions
- View process logs

### Connection Timeout
- Increase timeout in Tauri backend
- Check network connectivity
- Verify server is responding

## Related Documentation

- [Tauri Backend](./10-tauri-backend.md) - Backend commands and process management
- [Agent Integration](./01-agent-integration.md) - Agent adapter system
- [Local Agent Integration](./08-local-agent-integration.md) - Setup guide for local agents
- [MCP Tools](./02-mcp-tools.md) - MCP tool system
