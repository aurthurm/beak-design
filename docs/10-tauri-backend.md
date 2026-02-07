# Tauri Backend System

## Overview

The Tauri backend provides native system integration for Beak Design, including file I/O, process management, and agent detection. Built in Rust with async/await support via Tokio.

## Architecture

```
Frontend (TypeScript)
    ↓ (Tauri IPC)
Tauri Commands (Rust)
    ↓
Backend Services
    ├── File System (tokio::fs)
    ├── Process Manager (tokio::process)
    ├── HTTP Client (reqwest)
    └── Dialog Service (tauri-plugin-dialog)
```

## Commands

### File Operations

#### `read_file(path: String) -> Result<String, String>`
Read file contents asynchronously.

```typescript
import { invoke } from '@tauri-apps/api/core'

const content = await invoke<string>('read_file', {
  path: '/path/to/file.json'
})
```

#### `write_file(path: String, contents: String) -> Result<(), String>`
Write contents to file asynchronously.

```typescript
await invoke('write_file', {
  path: '/path/to/file.json',
  contents: JSON.stringify(data)
})
```

#### `file_exists(path: String) -> Result<bool, String>`
Check if file exists.

#### `is_directory(path: String) -> Result<bool, String>`
Check if path is a directory.

#### `read_directory(path: String) -> Result<Vec<String>, String>`
List directory contents.

#### `rename_file(old_path: String, new_path: String) -> Result<(), String>`
Rename or move a file.

#### `ensure_directory_exists(path: String) -> Result<(), String>`
Create directory recursively if it doesn't exist.

### Dialog Operations

#### `open_file_dialog() -> Result<Option<String>, String>`
Open native file picker dialog (filters: .beaki, .json).

```typescript
const path = await invoke<string | null>('open_file_dialog')
if (path) {
  const content = await invoke<string>('read_file', { path })
}
```

#### `save_file_dialog() -> Result<Option<String>, String>`
Open native save dialog (default: "untitled.beaki").

#### `open_directory_dialog() -> Result<Option<String>, String>`
Open native folder picker dialog.

### Agent Detection

#### `detect_cli_tools() -> Result<Vec<CliToolInfo>, String>`
Scan system PATH for AI CLI tools.

```typescript
interface CliToolInfo {
  name: string
  path: string
  tool_type: string
  version?: string
}

const tools = await invoke<CliToolInfo[]>('detect_cli_tools')
// Returns: codex, geminicli, claudecode if found
```

#### `detect_mcp_servers() -> Result<Vec<McpServerInfo>, String>`
Scan MCP config files for registered servers.

```typescript
interface McpServerInfo {
  id: string
  name: string
  command: string
  args: string[]
  enabled: boolean
}

const servers = await invoke<McpServerInfo[]>('detect_mcp_servers')
```

**Config Locations:**
- Unix: `~/.config/beak-design/mcp-servers.json`
- Windows: `%APPDATA%/beak-design/mcp-servers.json`

#### `detect_ollama() -> Result<OllamaDetectionResult, String>`
Detect Ollama server and available models.

```typescript
interface OllamaDetectionResult {
  available: boolean
  models?: string[]
  error?: string
}

const ollama = await invoke<OllamaDetectionResult>('detect_ollama')
if (ollama.available) {
  console.log('Models:', ollama.models)
}
```

**How it works:**
- HTTP GET to `http://localhost:11434/api/tags`
- Parses response for model list
- Returns connection status

### Process Management

#### `spawn_mcp_server(command: String, args: Vec<String>) -> Result<String, String>`
Spawn MCP server as child process with stdio capture.

```typescript
const connectionId = await invoke<string>('spawn_mcp_server', {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']
})
```

**Returns:** UUID connection ID

#### `spawn_cli_agent(tool: String, args: Vec<String>) -> Result<String, String>`
Spawn CLI agent tool as child process.

```typescript
const connectionId = await invoke<string>('spawn_cli_agent', {
  tool: 'codex',
  args: ['--model', 'gpt-4']
})
```

#### `send_mcp_message(connection_id: String, message: String) -> Result<(), String>`
Send JSON-RPC message to process stdin.

```typescript
await invoke('send_mcp_message', {
  connectionId,
  message: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  })
})
```

#### `read_mcp_response(connection_id: String) -> Result<String, String>`
Read JSON-RPC response from process stdout (blocking).

```typescript
const response = await invoke<string>('read_mcp_response', {
  connectionId
})
const data = JSON.parse(response)
```

#### `kill_process(connection_id: String) -> Result<(), String>`
Terminate process and clean up resources.

```typescript
await invoke('kill_process', { connectionId })
```

#### `list_processes() -> Result<Vec<ProcessInfo>, String>`
Get list of all active processes.

```typescript
interface ProcessInfo {
  connection_id: string
  command: string
  process_type: 'mcp' | 'cli'
}

const processes = await invoke<ProcessInfo[]>('list_processes')
```

#### `get_process_info(connection_id: String) -> Result<ProcessInfo, String>`
Get detailed info for specific process.

### System Paths

#### `get_documents_directory() -> Result<String, String>`
Get user's Documents folder path.

```typescript
const docsPath = await invoke<string>('get_documents_directory')
// Unix: /home/user/Documents
// Windows: C:\Users\user\Documents
```

## Implementation Details

### Dependencies

```toml
[dependencies]
tauri = { version = "2.0", features = [] }
tauri-plugin-dialog = "2.0"
tauri-plugin-fs = "2.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["fs", "rt", "sync"] }
dirs = "5.0"
reqwest = { version = "0.12", features = ["json"] }
uuid = { version = "1.0", features = ["v4"] }
```

### Process State Management

Processes are tracked in a global state using:
```rust
lazy_static! {
    static ref PROCESS_MAP: Arc<Mutex<HashMap<String, ManagedProcess>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

struct ManagedProcess {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: Option<BufReader<ChildStdout>>,
    command: String,
    process_type: ProcessType,
}
```

### Async Runtime

All I/O operations use Tokio's async runtime:
- File operations: `tokio::fs`
- Process spawning: `tokio::process::Command`
- HTTP requests: `reqwest` async client
- Blocking operations: `tokio::task::spawn_blocking`

### Error Handling

All commands return `Result<T, String>`:
- Success: Returns typed data
- Failure: Returns descriptive error message

```typescript
try {
  const result = await invoke('command_name', { params })
} catch (error) {
  console.error('Command failed:', error)
}
```

## Security Considerations

### File System Access
- No sandboxing by default
- Commands can access entire file system
- Consider adding path validation for production

### Process Spawning
- Spawns processes with current user permissions
- No resource limits enforced
- Monitor process count to prevent DoS

### Network Access
- Ollama detection connects to localhost only
- No outbound requests to external servers
- MCP servers may make their own network requests

## Best Practices

### File Operations
```typescript
// Always check if file exists
const exists = await invoke<boolean>('file_exists', { path })
if (exists) {
  const content = await invoke<string>('read_file', { path })
}

// Ensure directory exists before writing
await invoke('ensure_directory_exists', { path: '/path/to/dir' })
await invoke('write_file', { path: '/path/to/dir/file.json', contents })
```

### Process Management
```typescript
// Always clean up processes
const connectionId = await invoke<string>('spawn_mcp_server', {
  command, args
})

try {
  // Use process
  await invoke('send_mcp_message', { connectionId, message })
  const response = await invoke<string>('read_mcp_response', { connectionId })
} finally {
  // Clean up
  await invoke('kill_process', { connectionId })
}
```

### Error Handling
```typescript
// Wrap in try/catch with specific error messages
try {
  const result = await invoke('spawn_mcp_server', { command, args })
} catch (error) {
  if (error.includes('not found')) {
    console.error('MCP server not installed')
  } else if (error.includes('permission denied')) {
    console.error('Insufficient permissions')
  } else {
    console.error('Unknown error:', error)
  }
}
```

## Testing

### Manual Testing
```bash
# Build Tauri backend
cd src-tauri
cargo build

# Run tests
cargo test

# Check compilation
cargo check
```

### Frontend Testing
```typescript
import { invoke } from '@tauri-apps/api/core'

// Test file operations
await invoke('write_file', {
  path: '/tmp/test.txt',
  contents: 'Hello'
})
const content = await invoke<string>('read_file', {
  path: '/tmp/test.txt'
})
console.assert(content === 'Hello')

// Test detection
const tools = await invoke('detect_cli_tools')
console.log('Found tools:', tools)
```

## Related Documentation

- [Connection Manager](./12-connection-manager.md) - Frontend integration layer
- [Local Agent Integration](./08-local-agent-integration.md) - Agent setup guide
- [Agent Integration](./01-agent-integration.md) - AI agent system overview
