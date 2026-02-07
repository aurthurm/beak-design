# Tauri Backend API Documentation

This document describes the Tauri commands available for the Beak Design application.

## Ollama Integration

### `detect_ollama()`

Detects if Ollama is running locally and retrieves available models.

**Returns:**
```typescript
{
  available: boolean;
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
  }>;
  error?: string;
}
```

**Example:**
```typescript
const result = await invoke('detect_ollama');
if (result.available) {
  console.log('Available models:', result.models);
} else {
  console.error('Ollama not available:', result.error);
}
```

**Error Handling:**
- Returns `available: false` if Ollama is not running
- Includes error message in the `error` field
- Never throws - gracefully handles connection errors

---

## MCP Server Management

### `spawn_mcp_server(command: string, args: string[])`

Spawns an MCP server as a child process using stdio transport.

**Parameters:**
- `command`: The executable to run (e.g., "npx", "node", "python")
- `args`: Array of command-line arguments

**Returns:**
- `string`: Unique connection ID for the spawned process

**Example:**
```typescript
const connectionId = await invoke('spawn_mcp_server', {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir']
});
```

**Error Handling:**
- Throws error if process fails to spawn
- Returns descriptive error message on failure

---

### `send_mcp_message(connection_id: string, message: string)`

Sends a JSON-RPC message to an MCP server's stdin.

**Parameters:**
- `connection_id`: The connection ID returned from `spawn_mcp_server`
- `message`: JSON-RPC message as a string

**Returns:**
- `void`: Returns immediately (non-blocking)

**Example:**
```typescript
await invoke('send_mcp_message', {
  connectionId,
  message: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'beak-design', version: '0.1.0' }
    }
  })
});
```

**Error Handling:**
- Throws if connection ID not found
- Throws if stdin is not available
- Throws on write/flush errors

---

### `read_mcp_response(connection_id: string)`

Reads a line from the MCP server's stdout.

**Parameters:**
- `connection_id`: The connection ID returned from `spawn_mcp_server`

**Returns:**
- `string`: JSON-RPC response from the server (one line)

**Example:**
```typescript
const response = await invoke('read_mcp_response', { connectionId });
const data = JSON.parse(response);
console.log('Server response:', data);
```

**Error Handling:**
- Throws if connection ID not found
- Throws if stdout is not available
- Throws on read errors
- May block if no data is available

---

### `kill_process(connection_id: string)`

Terminates a spawned process.

**Parameters:**
- `connection_id`: The connection ID to terminate

**Returns:**
- `void`

**Example:**
```typescript
await invoke('kill_process', { connectionId });
```

**Error Handling:**
- Throws if connection ID not found
- Throws if process cannot be killed

---

### `list_processes()`

Lists all active spawned processes.

**Returns:**
```typescript
Array<{
  connection_id: string;
  process_type: string; // "mcp" or "cli"
  command: string;
  args: string[];
}>
```

**Example:**
```typescript
const processes = await invoke('list_processes');
processes.forEach(p => {
  console.log(`${p.process_type}: ${p.command} ${p.args.join(' ')}`);
});
```

---

### `get_process_info(connection_id: string)`

Gets information about a specific process.

**Parameters:**
- `connection_id`: The connection ID to query

**Returns:**
```typescript
{
  connection_id: string;
  process_type: string;
  command: string;
  args: string[];
}
```

**Example:**
```typescript
const info = await invoke('get_process_info', { connectionId });
console.log('Process info:', info);
```

**Error Handling:**
- Throws if connection ID not found

---

## CLI Agent Management

### `spawn_cli_agent(tool: string, args: string[])`

Spawns an interactive CLI tool (codex, geminicli, claudecode) as a child process.

**Parameters:**
- `tool`: The CLI tool name (e.g., "claudecode", "codex", "geminicli")
- `args`: Array of command-line arguments

**Returns:**
- `string`: Unique connection ID for the spawned process

**Example:**
```typescript
const connectionId = await invoke('spawn_cli_agent', {
  tool: 'claudecode',
  args: ['--model', 'claude-3-5-sonnet-20241022']
});
```

**Notes:**
- Uses the same message passing commands as MCP servers
- Use `send_mcp_message` to send input
- Use `read_mcp_response` to read output
- Use `kill_process` to terminate

---

## Usage Patterns

### MCP Server Lifecycle

```typescript
// 1. Spawn server
const connId = await invoke('spawn_mcp_server', {
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-memory']
});

// 2. Initialize
await invoke('send_mcp_message', {
  connectionId: connId,
  message: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { /* ... */ }
  })
});

// 3. Read initialization response
const initResponse = await invoke('read_mcp_response', { connectionId: connId });

// 4. Send requests
await invoke('send_mcp_message', {
  connectionId: connId,
  message: JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  })
});

// 5. Read responses
const toolsResponse = await invoke('read_mcp_response', { connectionId: connId });

// 6. Clean up
await invoke('kill_process', { connectionId: connId });
```

### Interactive CLI Session

```typescript
// 1. Spawn CLI agent
const connId = await invoke('spawn_cli_agent', {
  tool: 'claudecode',
  args: []
});

// 2. Send commands
await invoke('send_mcp_message', {
  connectionId: connId,
  message: 'help\n'
});

// 3. Read output (may need multiple reads)
const output = await invoke('read_mcp_response', { connectionId: connId });
console.log(output);

// 4. Clean up
await invoke('kill_process', { connectionId: connId });
```

---

## Implementation Details

### Process Management

- All processes are managed in a `HashMap<String, ManagedProcess>`
- Process state is protected by `tokio::sync::Mutex` for async safety
- Connection IDs are UUIDs generated with `uuid::v4()`
- Stdin/stdout are captured as pipes for bidirectional communication

### Async I/O

- Uses `tokio::process::Command` for async process spawning
- Uses `tokio::io::AsyncWriteExt` for async stdin writing
- Uses `tokio::io::AsyncBufReadExt` for async stdout reading
- All I/O operations are non-blocking

### Error Handling

- All commands return `Result<T, String>` for error handling
- Errors include descriptive messages
- Connection errors are handled gracefully
- Process spawning failures include the command and error details

---

## Testing

The commands can be tested using the Tauri dev tools console:

```javascript
// Test Ollama detection
invoke('detect_ollama').then(console.log);

// Test process management
invoke('spawn_mcp_server', {
  command: 'node',
  args: ['--version']
}).then(connId => {
  console.log('Connection ID:', connId);
  return invoke('read_mcp_response', { connectionId: connId });
}).then(console.log);
```

---

## Security Considerations

1. **Command Injection**: The backend does NOT sanitize commands - ensure the frontend validates all user input
2. **Resource Limits**: No limits on number of spawned processes - implement rate limiting in frontend
3. **Path Traversal**: MCP server arguments may contain paths - validate in frontend
4. **Process Cleanup**: Always call `kill_process` to avoid zombie processes
5. **Error Messages**: Error messages may expose system information - sanitize in frontend if needed
