# Local Agent Integration

## Overview

The Chat UI supports both cloud-based AI agents (Anthropic Claude) and local AI agents (Ollama, CLI tools, MCP servers). This allows users to work without cloud API keys and use locally installed AI tools.

## Tauri Support

**All local agent detection and communication works seamlessly in the Tauri desktop app:**

- **Ollama Detection**: Detected via HTTP probe (`detect_ollama` Tauri command)
- **CLI Tools Detection**: Scans system PATH (`detect_cli_tools` Tauri command)
- **MCP Servers Detection**: Reads MCP config files (`detect_mcp_servers` Tauri command)
- **Process Management**: Spawns and manages agent processes (`spawn_mcp_server`, `spawn_cli_agent`)
- **Stdio Communication**: Bidirectional JSON-RPC via stdin/stdout

**Tauri Commands Available:**
- `detect_ollama()` - Probe Ollama server and return available models
- `detect_cli_tools()` - Scan PATH for codex, geminicli, claudecode
- `detect_mcp_servers()` - Parse MCP server config files
- `spawn_mcp_server(command, args)` - Start MCP server with stdio capture
- `spawn_cli_agent(tool, args)` - Start CLI agent with stdio capture
- `send_mcp_message(connection_id, message)` - Send JSON-RPC to process
- `read_mcp_response(connection_id)` - Read JSON-RPC from process
- `kill_process(connection_id)` - Terminate process and cleanup

When running in Tauri, the frontend can directly detect and communicate with local agents without requiring server-side Node.js code. This provides a better user experience and enables full desktop app functionality.

See [Tauri Backend](./10-tauri-backend.md) for complete command reference.

## Supported Agent Types

### 1. Cloud Agent (Anthropic Claude)
- **Type**: `cloud`
- **Requires**: `ANTHROPIC_API_KEY` environment variable
- **Models**: Haiku, Sonnet, Opus
- **Features**: Full tool calling support, streaming responses

### 2. Ollama (Local LLM Server)
- **Type**: `ollama`
- **Requires**: Ollama server running locally (`http://localhost:11434`)
- **Models**: Any model installed in Ollama (llama3.2, gemma, etc.)
- **Features**: Tool calling support, streaming responses
- **Installation**: [Ollama Installation Guide](https://ollama.com)

### 3. CLI Tools
- **Type**: `cli`
- **Requires**: CLI tool installed in PATH
- **Supported Tools**: `codex`, `geminicli`, `claudecode`
- **Features**: Basic text generation (tool calling may vary by tool)

### 4. MCP Servers
- **Type**: `mcp`
- **Requires**: MCP server running locally
- **Features**: Full MCP protocol support, tool calling
- **Configuration**: Via MCP server config files

## Architecture

```
Chat UI (AgentSelector)
    ↓
Connection Manager (auto-detect, status, pooling)
    ↓
Agent Selection (Cloud/Local)
    ↓
┌─────────────────┬──────────────────┬─────────────────┐
│  Cloud Agent    │  Ollama Server   │  CLI/MCP        │
│  (Anthropic)    │  (HTTP)          │  (stdio)        │
└─────────────────┴──────────────────┴─────────────────┘
    ↓                    ↓                    ↓
API Route (/api/ai/chat) | Tauri Backend (process spawning)
    ↓                          ↓
Agent Adapter (routes to correct backend)
    ↓
MCP Tools → Command Bus → Canvas
```

## Auto-Detection

The system automatically detects available agents on startup:

### Ollama Detection
- **Method**: HTTP fetch to `http://localhost:11434/api/tags`
- **Works in**: Browser, Tauri, and server-side
- **Features**:
  - Lists available models automatically
  - Shows status (available/unavailable)
  - No special setup required (just needs Ollama server running)

### CLI Tool Detection
- **Method**: 
  - **Tauri**: Uses Tauri command `detect_cli_tools` (Rust executes shell commands)
  - **Server-side**: Uses Node.js `child_process.exec`
- **Works in**: Tauri desktop app and server-side (Node.js)
- **Supported Tools**: `codex`, `geminicli`, `claudecode`
- **Detection Process**:
  1. Checks PATH for executables using `which` (Linux/Mac) or `where` (Windows)
  2. Verifies executables respond to `--version`
  3. Returns detected tools with version information

### MCP Server Detection
- **Method**:
  - **Tauri**: Uses Tauri command `detect_mcp_servers` (Rust reads config files)
  - **Server-side**: Uses Node.js `fs.readFileSync`
- **Works in**: Tauri desktop app and server-side (Node.js)
- **Config Locations** (checked in order):
  1. `~/.config/mcp/servers.json`
  2. `~/.mcp/servers.json`
  3. `./.mcp/servers.json`
- **Detection Process**:
  1. Reads JSON config files from common locations
  2. Parses server configurations (endpoint, command, args, version)
  3. Returns detected MCP servers

## Manual Configuration

Users can manually configure agents via the Agent Configuration Dialog:

1. Click the settings icon in AgentSelector
2. Click "Add Agent"
3. Fill in configuration:
   - **Name**: Display name
   - **Type**: Cloud/Ollama/CLI/MCP
   - **Endpoint**: For Ollama/MCP (e.g., `http://localhost:11434`)
   - **Command**: For CLI/MCP (e.g., `codex`)
   - **Arguments**: JSON array for CLI args
   - **Model**: For Ollama (select from available models)

## Usage

### Selecting an Agent

1. Open Chat Panel
2. Use AgentSelector dropdown
3. Select desired agent
4. For Ollama, select model if multiple available
5. Start chatting

### Switching Agents

Agents can be switched mid-conversation:
1. Select different agent from dropdown
2. Continue conversation with new agent
3. Previous messages remain in conversation history

### Default Agent

The system remembers your default agent selection:
- First available agent is auto-selected
- User selection is saved as default
- Default persists across sessions

## Configuration Examples

### Ollama Configuration

```typescript
{
  id: 'ollama-local',
  name: 'Ollama (Local)',
  type: 'ollama',
  endpoint: 'http://localhost:11434',
  enabled: true,
  model: 'llama3.2',
  metadata: {
    models: ['llama3.2', 'gemma', 'mistral']
  }
}
```

### CLI Tool Configuration

```typescript
{
  id: 'cli-codex',
  name: 'Codex (CLI)',
  type: 'cli',
  command: 'codex',
  args: ['--format', 'json'],
  enabled: true
}
```

### MCP Server Configuration

```typescript
{
  id: 'mcp-custom',
  name: 'Custom MCP Server',
  type: 'mcp',
  endpoint: 'http://localhost:3001',
  enabled: true
}
```

## Agent Adapters

### Cloud Adapter (`src/lib/ai/agent-adapters/cloud-adapter.ts`)
- Uses `@tanstack/ai-anthropic`
- Requires `ANTHROPIC_API_KEY`
- Supports all Claude models
- Full tool calling support

### Ollama Adapter (`src/lib/ai/agent-adapters/ollama-adapter.ts`)
- Uses `@tanstack/ai-ollama`
- Connects to local Ollama server
- Supports model selection
- Tool calling support (model-dependent)

### CLI Adapter (`src/lib/ai/agent-adapters/cli-adapter.ts`)
- Spawns CLI processes
- Parses CLI output
- Basic streaming support
- Limited tool calling

### MCP Adapter (`src/lib/ai/agent-adapters/mcp-adapter.ts`)
- Uses `@modelcontextprotocol/sdk`
- Supports HTTP and stdio transports
- Full MCP protocol support
- Tool calling via MCP

## API Integration

### Request Format

```typescript
POST /api/ai/chat
{
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
```

### Response Format

SSE stream with events:
- `text-delta`: Streaming text content
- `tool-call`: Tool execution request
- `tool-result`: Tool execution result
- `done`: Stream complete
- `error`: Error occurred

## Troubleshooting

### Ollama Not Detected

**Problem**: Ollama agent doesn't appear in list

**Solutions**:
1. Ensure Ollama server is running: `ollama serve`
2. Check if server is accessible: `curl http://localhost:11434/api/tags`
3. Verify port (default: 11434)
4. Check firewall settings

### CLI Tools Not Detected

**Problem**: CLI tools don't appear in list

**Solutions**:
1. Verify tool is in PATH: `which codex` (Linux/Mac) or `where codex` (Windows)
2. Check tool is executable: `chmod +x /path/to/tool`
3. Test tool manually: `codex --version`
4. **Tauri**: Detection works automatically via Tauri commands
5. **Server-side**: Requires Node.js environment
6. **Browser-only**: CLI detection not available (use Tauri app instead)

### MCP Server Not Detected

**Problem**: MCP server doesn't appear

**Solutions**:
1. Check config file exists in common locations:
   - `~/.config/mcp/servers.json`
   - `~/.mcp/servers.json`
   - `./.mcp/servers.json`
2. Verify config file format (valid JSON)
3. Ensure server configuration is correct in config file
4. **Tauri**: Detection works automatically via Tauri commands
5. **Server-side**: Requires Node.js environment with file system access
6. **Browser-only**: MCP detection not available (use Tauri app instead)

### Agent Connection Fails

**Problem**: Selected agent shows as unavailable

**Solutions**:
1. Check agent is running/accessible
2. Verify configuration (endpoint, command)
3. Check network connectivity (for HTTP endpoints)
4. Review server logs for errors
5. Test connection manually

### Tool Calling Not Working

**Problem**: Agent doesn't execute tools

**Solutions**:
1. **Ollama**: Ensure model supports tool calling (e.g., llama3.2)
2. **CLI**: Check if CLI tool supports tool calling
3. **MCP**: Verify MCP server exposes tools
4. **Cloud**: Should always work if API key valid

## Best Practices

### 1. Use Cloud for Production
- Cloud agents are more reliable
- Better tool calling support
- Consistent performance

### 2. Use Ollama for Development
- No API costs
- Privacy (data stays local)
- Good for testing

### 3. Configure Default Agent
- Set your preferred agent as default
- Saves time on each conversation
- Can be changed anytime

### 4. Test Agents Before Use
- Use "Test" button in config dialog
- Verify agent responds correctly
- Check tool calling works

### 5. Monitor Agent Status
- Check status indicators in selector
- Red = unavailable
- Green = available

## Performance Considerations

### Ollama
- **Pros**: No API costs, privacy, fast local inference
- **Cons**: Requires GPU/CPU resources, model size limits

### CLI Tools
- **Pros**: Simple, no server needed
- **Cons**: Limited features, no streaming (some tools)

### MCP Servers
- **Pros**: Full protocol support, extensible
- **Cons**: Requires server setup, more complex

### Cloud
- **Pros**: Best performance, full features
- **Cons**: API costs, requires internet, privacy concerns

## Related Documentation

- [Connection Manager](./12-connection-manager.md) - Connection lifecycle and status management
- [Tauri Backend](./10-tauri-backend.md) - Native system integration and Tauri commands
- [Agent Integration](./01-agent-integration.md) - General AI agent system
- [MCP Tools](./02-mcp-tools.md) - Tool system details
- [Architecture Overview](./00-architecture-overview.md) - System architecture
