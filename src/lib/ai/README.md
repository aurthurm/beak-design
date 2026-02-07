# AI Agent System

This directory contains the AI agent system for Beak Design, supporting multiple agent types including cloud APIs, local Ollama, CLI tools, and MCP servers.

## Architecture

### Agent Adapters (`agent-adapters/`)

Agent adapters provide a unified interface for different AI providers:

- **CloudAdapter** - Cloud API providers (Anthropic, OpenAI, Google)
- **OllamaAdapter** - Local Ollama server
- **CLIAdapter** - Command-line AI tools (codex, geminicli, claudecode)
- **MCPAdapter** - Model Context Protocol servers (HTTP and stdio transport)

All adapters implement the `AgentAdapter` interface:

```typescript
interface AgentAdapter {
  name: string
  config: AgentConfig
  stream(request: ChatRequest): AsyncIterable<ChatDelta>
  supportsTools(): boolean
  getAvailableModels(): Promise<string[]>
  isAvailable(): Promise<boolean>
}
```

### Connection Manager (`connection-manager.ts`)

The `ConnectionManager` singleton manages active connections to agents:

- Tracks connection status (disconnected, connecting, connected, error)
- Handles connection lifecycle (connect, disconnect, reconnect)
- Supports both HTTP and stdio transports
- Emits events for connection state changes

**Usage:**

```typescript
import { connectionManager } from '@/lib/ai/connection-manager'

// Test connection
await connectionManager.testConnection(agentConfig)

// Get connection status
const status = connectionManager.getConnectionStatus(agentId)

// Subscribe to changes
const unsubscribe = connectionManager.subscribe((connections) => {
  console.log('Connections updated:', connections)
})
```

### Agent Detection (`agent-detector.ts`)

Auto-detects available local agents:

- **Ollama** - Checks localhost:11434
- **CLI Tools** - Searches PATH for supported tools
- **MCP Servers** - Reads config files from standard locations

**Usage:**

```typescript
import { detectAllAgents } from '@/lib/ai/agent-detector'

const agents = await detectAllAgents()
// Returns AgentInfo[] with detected agents
```

### Agent Configuration (`agent-config.ts`)

Manages agent configurations with localStorage persistence:

```typescript
interface AgentConfig {
  id: string
  name: string
  type: 'cloud' | 'ollama' | 'cli' | 'mcp'
  endpoint?: string
  command?: string
  args?: string[]
  enabled: boolean
  model?: string
  metadata?: Record<string, any>
}
```

## MCP Stdio Transport (Tauri)

The MCP adapter supports both HTTP and stdio transports. Stdio transport requires Tauri and uses process management commands.

### Tauri Commands

Located in `src-tauri/src/process_manager.rs`:

- `spawn_mcp_server(command, args)` - Spawns MCP server process
- `send_mcp_message(connection_id, message)` - Sends JSON-RPC to stdin
- `read_mcp_response(connection_id)` - Reads JSON-RPC from stdout
- `kill_process(connection_id)` - Terminates process
- `list_processes()` - Lists active processes

### TypeScript Wrapper

Located in `src/lib/tauri.ts`:

```typescript
import { spawnMCPServer, sendMCPMessage, readMCPResponse, killProcess } from '@/lib/tauri'

// Spawn MCP server
const connectionId = await spawnMCPServer('npx', ['-y', '@modelcontextprotocol/server-filesystem'])

// Send JSON-RPC request
await sendMCPMessage(connectionId, JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
}))

// Read response
const response = await readMCPResponse(connectionId)
const result = JSON.parse(response)

// Cleanup
await killProcess(connectionId)
```

### Auto-Detection

The system automatically detects:

1. **MCP Servers from config files:**
   - `~/.config/mcp/servers.json`
   - `~/.mcp/servers.json`
   - `./.mcp/servers.json`

2. **CLI Tools in PATH:**
   - codex
   - geminicli
   - claudecode

3. **Ollama Server:**
   - Checks http://localhost:11434

## UI Components

### ConnectionSettings Component

Located in `src/components/settings/ConnectionSettings.tsx`:

Shows detected agents and allows testing connections:

```tsx
import { ConnectionSettings } from '@/components/settings/ConnectionSettings'

<ConnectionSettings />
```

Features:
- Lists all detected agents
- Shows real-time connection status
- Test connection button
- Disconnect button
- Auto-refresh on mount

### AISettingsDialog

Updated to include ConnectionSettings in a new "Connections" tab:

```tsx
import { AISettingsDialog } from '@/components/settings/AISettingsDialog'

<AISettingsDialog open={open} onOpenChange={setOpen} />
```

## Usage Examples

### Using an MCP Server

```typescript
import { getAgentAdapter } from '@/lib/ai/agent-adapters'
import { connectionManager } from '@/lib/ai/connection-manager'

// Create config for stdio MCP server
const config: AgentConfig = {
  id: 'mcp-filesystem',
  name: 'Filesystem MCP',
  type: 'mcp',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/workspace'],
  enabled: true
}

// Connect to server
await connectionManager.testConnection(config)

// Create adapter
const adapter = await getAgentAdapter('mcp', config)

// Stream chat
for await (const delta of adapter.stream({
  messages: [{ role: 'user', content: 'List files in the workspace' }]
})) {
  if (delta.type === 'text-delta') {
    console.log(delta.content)
  }
}

// Cleanup
await connectionManager.disconnect(config.id)
```

### Using Ollama

```typescript
const config: AgentConfig = {
  id: 'ollama-local',
  name: 'Ollama',
  type: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'llama2',
  enabled: true
}

await connectionManager.testConnection(config)
const adapter = await getAgentAdapter('ollama', config)

for await (const delta of adapter.stream({
  messages: [{ role: 'user', content: 'Hello!' }]
})) {
  // Handle deltas
}
```

### Auto-Detection and Connection

```typescript
import { detectAllAgents } from '@/lib/ai/agent-detector'
import { connectionManager } from '@/lib/ai/connection-manager'
import { createConfigFromAgentInfo } from '@/lib/ai/agent-config'

// Detect all available agents
const agents = await detectAllAgents()

// Connect to first available agent
if (agents.length > 0) {
  const config = createConfigFromAgentInfo(agents[0])
  await connectionManager.testConnection(config)
}

// Subscribe to connection changes
connectionManager.subscribe((connections) => {
  console.log('Active connections:', connections.length)
})
```

## Error Handling

All adapters and the connection manager provide detailed error messages:

```typescript
try {
  await connectionManager.testConnection(config)
} catch (error) {
  if (error.message.includes('Tauri context required')) {
    // Not running in Tauri environment
  } else if (error.message.includes('Connection timeout')) {
    // Server not responding
  } else {
    // Other errors
  }
}
```

## Testing

The connection manager provides a test method to verify connectivity:

```typescript
// Test connection without persisting
await connectionManager.testConnection(config)

// Check status
const status = connectionManager.getConnectionStatus(config.id)
// 'disconnected' | 'connecting' | 'connected' | 'error'
```

## Environment Detection

The system automatically detects the runtime environment:

```typescript
import { isTauri } from '@/lib/tauri'

if (isTauri()) {
  // Tauri-specific features available
  // - Stdio process spawning
  // - File system access
  // - Native dialogs
} else {
  // Web-only features
  // - HTTP-only MCP servers
  // - Cloud APIs
}
```

## Best Practices

1. **Always check availability before using an adapter:**
   ```typescript
   if (await adapter.isAvailable()) {
     // Use adapter
   }
   ```

2. **Use connection manager for persistent connections:**
   ```typescript
   await connectionManager.testConnection(config)
   // Connection is now managed and can be reused
   ```

3. **Clean up connections when done:**
   ```typescript
   await connectionManager.disconnect(agentId)
   ```

4. **Subscribe to connection changes for real-time updates:**
   ```typescript
   const unsubscribe = connectionManager.subscribe((connections) => {
     updateUI(connections)
   })
   // Don't forget to unsubscribe when component unmounts
   return () => unsubscribe()
   ```

5. **Handle errors gracefully:**
   ```typescript
   try {
     await connectionManager.testConnection(config)
   } catch (error) {
     // Show error to user
     // Maybe try fallback adapter
   }
   ```
