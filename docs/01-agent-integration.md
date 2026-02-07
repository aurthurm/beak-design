# Agent Integration System

## Overview

The Agent Integration system connects AI agents (Cloud: Claude via Anthropic, Local: Ollama/CLI/MCP) to the design canvas through Model Context Protocol (MCP) tools. It enables real-time AI-powered design assistance with streaming responses and visual feedback.

## Architecture

```
Chat UI (useChat hook + AgentSelector)
    ↓
Agent Selection (Cloud/Local)
    ↓
Connection Manager (auto-detect, status tracking, pooling)
    ↓
API Route (/api/ai/chat) - SSE streaming
    ↓
Agent Adapter (routes to correct backend)
    ↓
┌─────────────────┬──────────────────┬─────────────────┐
│  Cloud Agent    │  Local Agents    │  MCP Servers    │
│  (Anthropic)    │  (Ollama/CLI)   │  (stdio/HTTP)   │
└─────────────────┴──────────────────┴─────────────────┘
    ↓                    ↓                    ↓
MCP Tools (batch_design, search_design_nodes, etc.)
    ↓
Command Bus → Document Updates → Canvas Re-render
    ↓
Animation System (visual feedback)
```

## Supported Agents

- **Cloud**: Anthropic Claude (Haiku, Sonnet, Opus)
- **Local**: Ollama (any installed model)
- **CLI**: codex, geminicli, claudecode
- **MCP**: Local MCP servers

See [Local Agent Integration](./08-local-agent-integration.md) for details on local agents.

## Components

### 1. API Route (`src/routes/api/ai/chat.ts`)

**Purpose**: Server-side endpoint for AI chat with SSE streaming

**Key Features**:
- Server-Sent Events (SSE) streaming
- Multi-agent support (cloud and local)
- Agent adapter routing
- Agent mode mapping (haiku/sonnet/opus → Claude models, for cloud only)
- MCP tool integration
- Document context in system prompt
- Error handling and user-friendly messages

**Usage**:
```typescript
POST /api/ai/chat
Body: {
  messages: Array<{ role: string, text: string }>,
  agentType: 'cloud' | 'ollama' | 'cli' | 'mcp',
  agentConfig: {
    id: string,
    type: string,
    endpoint?: string,
    command?: string,
    model?: string,
    // ... other config
  },
  agentMode?: 'haiku' | 'sonnet' | 'opus', // For cloud only
  selectedIDs: string[],
  conversationId: string
}
Response: SSE stream with text-delta, tool-call, tool-result, done events
```

**Agent Mode Mapping** (Cloud only):
- `haiku` → `claude-3-5-haiku-20241022`
- `sonnet` → `claude-3-5-sonnet-20241022`
- `opus` → `claude-3-opus-20240229`

### 2. useChat Hook (`src/hooks/useChat.ts`)

**Purpose**: Client-side hook managing chat conversations and streaming

**Key Features**:
- Conversation management (create, select, close)
- SSE streaming handling
- Tool call visualization
- Agent type and configuration support
- Abort support for canceling requests
- Error handling with user-friendly messages

**Usage**:
```typescript
const {
  conversations,
  activeConversationId,
  onSendMessage,
  onStopConversation,
  onChangeAgentMode,
} = useChat({ selectedIDs })

// Send a message with cloud agent
onSendMessage({
  prompt: "Create a red button",
  conversationId: activeConversationId,
  agentMode: 'sonnet',
  agentType: 'cloud'
})

// Send a message with Ollama
onSendMessage({
  prompt: "Create a red button",
  conversationId: activeConversationId,
  agentType: 'ollama',
  agentConfig: {
    id: 'ollama-local',
    type: 'ollama',
    endpoint: 'http://localhost:11434',
    model: 'llama3.2',
    enabled: true
  }
})

// Stop streaming
onStopConversation(activeConversationId)
```

**Message Format**:
```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  text: string
  createdAt: number
  status?: 'streaming' | 'final'
  toolUse?: {
    name: string
    input: any
    output?: any
    isError?: boolean
  }
}
```

### 3. ChatPanel Component (`src/components/chat/ChatPanel.tsx`)

**Purpose**: UI component for AI chat interface

**Key Features**:
- Message rendering (user, assistant, tool)
- Tool use display with expandable details
- Agent selector (cloud/local agents)
- Agent mode selector (for cloud agents)
- Agent configuration dialog
- Streaming indicators
- Collapsible panel with drag resize

**Agent Selection**:
- Dropdown to select agent type
- Shows detected agents with status indicators
- Model selection for Ollama
- Configuration button for manual setup

**Tool Message Display**:
- Shows tool name and status icon
- Expandable input/output sections
- Error highlighting
- JSON formatting for tool data

### 4. Agent Detection (`src/lib/ai/agent-detector.ts`)

**Purpose**: Auto-detects available local agents

**Key Features**:
- Detects Ollama server (via HTTP fetch)
- Detects CLI tools in PATH (via Tauri commands or Node.js)
- Detects MCP servers (via Tauri commands or Node.js)
- Returns agent metadata with status, endpoint, models, etc.

**Detection Methods**:
- **Ollama**: HTTP request to `http://localhost:11434/api/tags` (works everywhere)
- **CLI Tools**: 
  - **Tauri**: Uses `detect_cli_tools` Rust command
  - **Server-side**: Uses Node.js `child_process.exec`
- **MCP Servers**:
  - **Tauri**: Uses `detect_mcp_servers` Rust command
  - **Server-side**: Uses Node.js `fs.readFileSync`

**Usage**:
```typescript
import { detectAllAgents } from '@/lib/ai/agent-detector'

const agents = await detectAllAgents()
// Returns: Array of AgentInfo with status, endpoint, models, etc.
// Works in Tauri desktop app and server-side environments
```

### 5. Agent Configuration (`src/lib/ai/agent-config.ts`)

**Purpose**: Manages agent configurations

**Key Features**:
- Stores configurations in localStorage
- Manages default agent
- Validates configurations
- Merges detected with saved configs

**Usage**:
```typescript
import { getAgentConfig, saveAgentConfig } from '@/lib/ai/agent-config'

const config = getAgentConfig('ollama-local')
saveAgentConfig(newConfig)
```

### 6. Agent Adapters (`src/lib/ai/agent-adapters/`)

**Purpose**: Unified interface for all agent types

**Key Features**:
- Common adapter interface
- Cloud adapter (Anthropic)
- Ollama adapter
- CLI adapter
- MCP adapter

**Usage**:
```typescript
import { getAgentAdapter } from '@/lib/ai/agent-adapters'

const adapter = await getAgentAdapter('ollama', config)
const isAvailable = await adapter.isAvailable()
const stream = adapter.stream(request)
```

### 7. Tool Context Provider (`src/lib/ai/tool-context-provider.ts`)

**Purpose**: Bridges AI system and MCP tools

**Key Features**:
- Provides ToolContext to MCP tools
- Manages active document
- Handles client/server differences
- Connects to command bus and storage

**Usage**:
```typescript
const contextProvider = getToolContextProvider()
const ctx = contextProvider.createToolContext()

// Set active document
contextProvider.setActiveDocumentId(docId)

// Create tool context
const toolContext = contextProvider.createToolContext()
```

### 8. MCP Tool Adapters (`src/lib/ai/mcp-tool-adapters.ts`)

**Purpose**: Converts MCP tools to TanStack AI format

**Key Features**:
- JSON Schema to Zod conversion
- Tool execution wrapper
- Error handling
- Type-safe tool definitions

**Usage**:
```typescript
const toolRegistry = buildMcpTools({ commands, tx })
const mcpTools = getMcpToolsForAI(toolRegistry)

// Tools are automatically registered with TanStack AI
```

### 9. Agent Animations (`src/lib/ai/agent-animations.ts`)

**Purpose**: Visual feedback for agent operations

**Key Features**:
- Extracts node IDs from tool results
- Triggers flash/highlight animations
- Handles batch operations
- Error state handling

**Usage**:
```typescript
import { handleToolExecutionAnimation } from '@/lib/ai/agent-animations'

// Called when tool completes
handleToolExecutionAnimation(
  toolName,
  toolInput,
  toolOutput,
  isError
)
```

## Use Cases

### Use Case 1: Creating Design Elements

**User**: "Create a red button in the center"

**Flow**:
1. User sends message via ChatPanel
2. useChat hook sends to `/api/ai/chat`
3. TanStack AI processes with system prompt
4. AI decides to use `batch_design` tool
5. Tool executes via Command Bus
6. Document updates, canvas re-renders
7. Animation flashes new button
8. AI responds with confirmation

### Use Case 2: Modifying Existing Elements

**User**: "Make the selected frame blue"

**Flow**:
1. User selects frame (selectedIDs passed to API)
2. AI receives selection context
3. AI uses `update_frame` tool with frame ID
4. Command Bus updates frame style
5. Canvas updates visually
6. Animation highlights modified frame

### Use Case 3: Complex Batch Operations

**User**: "Create a card component with title, image, and description"

**Flow**:
1. AI uses `batch_design` with multiple operations
2. Creates frame, then layers for each element
3. Groups layers into component
4. All operations in single transaction
5. Single undo step for entire operation
6. Visual feedback for all created nodes

## Error Handling

### API Key Missing
- **Error**: `ANTHROPIC_API_KEY not configured`
- **User Message**: "API key not configured. Please set ANTHROPIC_API_KEY in your environment."
- **Solution**: Add API key to `.env` file

### Network Errors
- **Error**: Network/fetch failures
- **User Message**: "Network error. Please check your connection."
- **Solution**: Check internet connection, retry

### Rate Limiting
- **Error**: 429 status code
- **User Message**: "Rate limit exceeded. Please wait a moment."
- **Solution**: Wait before retrying

### Tool Execution Errors
- **Error**: Tool execution failures
- **User Message**: Shows tool name and error details
- **Solution**: Check tool input, document state

## Configuration

### Environment Variables

```bash
# Optional: Required only for cloud agent
ANTHROPIC_API_KEY=your_api_key_here
```

**Note**: `ANTHROPIC_API_KEY` is optional. If not set, users can use local agents (Ollama, CLI, MCP).

### Agent Configuration

Agents can be configured via:
1. **Auto-detection**: System automatically detects available agents
2. **Manual configuration**: Use Agent Configuration Dialog in UI
3. **Default selection**: System remembers your preferred agent

### System Prompt Customization

Edit `buildSystemPrompt()` in `src/routes/api/ai/chat.ts` to customize:
- Available tools description
- Design guidelines
- Context instructions
- Tool usage patterns

## Best Practices

1. **Always use Command Bus**: Never mutate documents directly
2. **Group operations**: Use transactions for related changes
3. **Provide context**: Include selectedIDs and document state
4. **Handle errors gracefully**: Show user-friendly messages
5. **Visual feedback**: Use animations for agent operations
6. **Stream responses**: Use SSE for real-time updates

## Troubleshooting

### Chat not responding
- **Cloud agent**: Check API key configuration
- **Local agents**: Verify agent is running/accessible
- Verify network connection (for cloud/HTTP agents)
- Check browser console for errors
- Verify document is loaded

### Agent not detected
- **Ollama**: Ensure server is running (`ollama serve`)
- **CLI tools**: 
  - Verify tool is in PATH (`which codex` or `where codex` on Windows)
  - **Tauri**: Detection works automatically via Tauri commands
  - **Server-side**: Requires Node.js environment
- **MCP servers**: 
  - Check config file exists in common locations (`~/.config/mcp/servers.json`, etc.)
  - Verify config file format (valid JSON)
  - **Tauri**: Detection works automatically via Tauri commands
  - **Server-side**: Requires Node.js environment
- See [Local Agent Integration](./08-local-agent-integration.md) for detailed troubleshooting

### Tools not executing
- Check tool context provider initialization
- Verify document is active
- Check command bus implementation
- Review tool adapter errors
- **Note**: Some local agents may have limited tool calling support

### Streaming not working
- Verify SSE endpoint is accessible
- Check response headers
- Review browser SSE support
- Check network proxy settings
- **Local agents**: Verify agent supports streaming

## Connection Management

The Connection Manager handles lifecycle management for all agent connections. See [Connection Manager](./12-connection-manager.md) for details.

**Key Features:**
- **Auto-Detection** - Automatically finds available agents on startup
- **Connection Pooling** - Reuses existing connections for efficiency
- **Status Tracking** - Real-time connection status updates
- **Event System** - Subscribe to connection state changes

**Quick Usage:**
```typescript
import { connectionManager } from '@/lib/ai/connection-manager'

// Auto-detect all agents
await connectionManager.detectAgents()

// Check status
const status = connectionManager.getConnectionStatus('ollama')
console.log(status.connected) // true/false

// Test connection
await connectionManager.testConnection(config)

// Subscribe to events
connectionManager.addEventListener('status_changed', (data) => {
  console.log(`${data.agentId}: ${data.status.connected}`)
})
```

## Related Documentation

- [Connection Manager](./12-connection-manager.md) - Connection lifecycle management
- [Tauri Backend](./10-tauri-backend.md) - Backend system commands
- [Local Agent Integration](./08-local-agent-integration.md) - Local agent setup and usage
- [MCP Tools](./02-mcp-tools.md) - Tool system details
- [Command Bus](./04-command-bus.md) - Mutation system
- [Canvas System](./03-canvas-system.md) - Rendering system
