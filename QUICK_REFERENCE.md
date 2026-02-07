# MCP Stdio Quick Reference

Quick reference for using MCP stdio transport in Beak Design.

## Setup (One Time)

### 1. Create MCP Config

**Location**: `~/.config/mcp/servers.json`

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
  }
}
```

### 2. Install MCP Server (Optional)

```bash
# Global install (faster startup)
npm install -g @modelcontextprotocol/server-filesystem

# Or use npx (no install needed)
# Already configured in JSON above
```

## Usage in UI

1. **Settings** → AI Assistant Settings → **Connections** tab
2. Click **Refresh** to detect agents
3. Click **Test Connection** to verify
4. Status shows: **connected** ✅

## Usage in Code

### Basic Usage

```typescript
import { getAgentAdapter } from '@/lib/ai/agent-adapters'

const config = {
  id: 'mcp-fs',
  name: 'Filesystem',
  type: 'mcp',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
  enabled: true
}

const adapter = await getAgentAdapter('mcp', config)

for await (const delta of adapter.stream({ messages })) {
  console.log(delta)
}
```

### With Connection Manager

```typescript
import { connectionManager } from '@/lib/ai/connection-manager'

// Test connection first
await connectionManager.testConnection(config)

// Check status
if (connectionManager.getConnectionStatus(config.id) === 'connected') {
  // Use adapter
}

// Cleanup
await connectionManager.disconnect(config.id)
```

### Auto-Detection

```typescript
import { detectAllAgents } from '@/lib/ai/agent-detector'

const agents = await detectAllAgents()
// Returns: Ollama, CLI tools, MCP servers

const mcpServers = agents.filter(a => a.type === 'mcp')
```

## Common Commands

### Tauri (Desktop Only)

```typescript
import {
  spawnMCPServer,
  sendMCPMessage,
  readMCPResponse,
  killProcess
} from '@/lib/tauri'

// Spawn
const id = await spawnMCPServer('npx', ['-y', 'server'])

// Send JSON-RPC
await sendMCPMessage(id, JSON.stringify({ jsonrpc: '2.0', ... }))

// Read
const response = await readMCPResponse(id)

// Cleanup
await killProcess(id)
```

### Connection Manager

```typescript
import { connectionManager } from '@/lib/ai/connection-manager'

// Test
await connectionManager.testConnection(config)

// Status
connectionManager.getConnectionStatus(agentId)
// Returns: 'disconnected' | 'connecting' | 'connected' | 'error'

// Subscribe
const unsub = connectionManager.subscribe(connections => {
  console.log(connections)
})

// Disconnect
await connectionManager.disconnect(agentId)
```

## Popular MCP Servers

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
  },
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_TOKEN": "token" }
  },
  "postgres": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres"],
    "env": { "POSTGRES_URL": "postgresql://..." }
  },
  "puppeteer": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
  }
}
```

## Environment Check

```typescript
import { isTauri } from '@/lib/tauri'

if (isTauri()) {
  // Desktop - stdio available
} else {
  // Web - HTTP only
}
```

## Error Handling

```typescript
try {
  await connectionManager.testConnection(config)
} catch (error) {
  // Check error message
  if (error.message.includes('Tauri context required')) {
    // Not in desktop app
  } else if (error.message.includes('timeout')) {
    // Server not responding
  }
}

// Or check status
const conn = connectionManager.getConnection(agentId)
if (conn?.status === 'error') {
  console.log(conn.error)
}
```

## Status Types

```typescript
type ConnectionStatus =
  | 'disconnected'  // Not connected
  | 'connecting'    // Connection in progress
  | 'connected'     // Successfully connected
  | 'error'         // Connection failed
```

## Agent Config Type

```typescript
interface AgentConfig {
  id: string
  name: string
  type: 'cloud' | 'ollama' | 'cli' | 'mcp'
  endpoint?: string      // For HTTP MCP
  command?: string       // For stdio MCP
  args?: string[]        // Command arguments
  enabled: boolean
  model?: string        // For Ollama
  metadata?: any
}
```

## React Hook Example

```typescript
import { useEffect, useState } from 'react'
import { connectionManager } from '@/lib/ai/connection-manager'

function useConnections() {
  const [connections, setConnections] = useState(
    connectionManager.getConnections()
  )

  useEffect(() => {
    return connectionManager.subscribe(setConnections)
  }, [])

  return connections
}

// Usage
function MyComponent() {
  const connections = useConnections()
  return (
    <div>
      {connections.map(c => (
        <div key={c.agentId}>{c.status}</div>
      ))}
    </div>
  )
}
```

## Debug

```typescript
// Enable debug logging
localStorage.setItem('debug', 'ai:*')

// View all processes
import { listProcesses } from '@/lib/tauri'
const processes = await listProcesses()
console.log(processes)

// View connections
console.log(connectionManager.getConnections())
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No agents detected | Check config file exists and is valid JSON |
| Connection timeout | Verify command is correct and server is installed |
| "Tauri context required" | Feature only works in desktop app |
| Process crashes | Check server dependencies and environment variables |
| Permission denied | Check directory/file permissions for filesystem server |

## File Locations

- Config: `~/.config/mcp/servers.json` or `~/.mcp/servers.json`
- Logs: Browser console (F12)
- Types: `src/lib/tauri.ts`
- Docs: `src/lib/ai/README.md`

## Resources

- Full docs: `src/lib/ai/README.md`
- Examples: `MCP_EXAMPLES.md`
- Implementation: `IMPLEMENTATION_SUMMARY.md`
- Overview: `MCP_STDIO_IMPLEMENTATION.md`

## Quick Test

```typescript
// Test if everything is working
import { detectAllAgents } from '@/lib/ai/agent-detector'
import { connectionManager } from '@/lib/ai/connection-manager'
import { createConfigFromAgentInfo } from '@/lib/ai/agent-config'

async function test() {
  const agents = await detectAllAgents()
  console.log('Detected:', agents)

  if (agents.length > 0) {
    const config = createConfigFromAgentInfo(agents[0])
    await connectionManager.testConnection(config)
    console.log('Status:', connectionManager.getConnectionStatus(config.id))
  }
}

test()
```
