# MCP Tools System

## Overview

The Model Context Protocol (MCP) Tools system provides a standardized interface for AI agents to interact with the design canvas. Tools are defined once and can be used by any MCP-compatible agent.

## Architecture

```
MCP Tool Definition (mcp-tools.ts)
    ↓
Tool Registry (buildMcpTools)
    ↓
MCP Tool Adapter (mcp-tool-adapters.ts)
    ↓
TanStack AI Tool
    ↓
Tool Handler Execution
    ↓
Command Bus → Document Mutation
```

## Core Concepts

### Tool Definition

Each tool follows this structure:

```typescript
{
  name: string                    // Unique tool identifier
  description: string             // Human-readable description for AI
  inputSchema: JSONSchema          // Input validation schema
  outputSchema: JSONSchema        // Output validation schema
  handler: (input, ctx) => Promise<any>  // Execution function
}
```

### Tool Context

Tools receive a `ToolContext` providing:

```typescript
{
  activeDocumentId: DocumentId | null
  actor: Actor                    // Who is calling (user/agent)
  storage: StorageAdapter         // Document persistence
  editor: EditorRuntime           // Current editor state
  ids: IdFactory                  // ID generation
  nowISO: () => string            // Timestamp generation
}
```

## Available Tools

### Design Operations

#### `batch_design`
Execute multiple design operations in a single transaction.

**Input**:
```typescript
{
  operations: string    // JavaScript-like operations string
  id: string           // Unique batch ID
  partial?: boolean    // Streaming update flag
}
```

**Operations Format**:
```javascript
// Insert
foo=I("parent", { type: "frame", ... })

// Copy
bar=C("sourceId", "parent", { ... })

// Update
U("nodeId", { property: value })

// Replace
baz=R("nodeId", { type: "text", ... })

// Delete
D("nodeId")

// Move
M("nodeId", "newParent", index)
```

**Use Case**: Creating complex designs with multiple elements

#### `create_frame`
Create a new frame (artboard).

**Input**:
```typescript
{
  pageId: string
  name: string
  platform: 'mobile' | 'tablet' | 'desktop' | 'custom'
  rect: { x: number, y: number, w: number, h: number }
}
```

**Use Case**: Adding new artboards to a page

#### `update_frame`
Update frame properties.

**Input**:
```typescript
{
  frameId: string
  patch: Partial<Frame>  // Safe properties only
}
```

**Use Case**: Resizing, repositioning, or renaming frames

#### `delete_frame`
Delete a frame and all its layers.

**Input**:
```typescript
{
  frameId: string
}
```

**Use Case**: Removing unused artboards

### Layer Operations

#### `create_layer`
Create a new layer (shape, text, image, etc.).

**Input**:
```typescript
{
  frameId: string
  type: 'rect' | 'text' | 'image' | 'ellipse' | 'line' | 'group'
  name: string
  rect: { x: number, y: number, w: number, h: number }
  style?: StyleProperties
  // ... type-specific properties
}
```

**Use Case**: Adding design elements to frames

#### `update_layer`
Update layer properties.

**Input**:
```typescript
{
  layerId: string
  patch: Partial<Layer>  // Restricted to safe properties
}
```

**Safe Properties**:
- `name`, `rect`, `rotation`
- `style`, `layout`, `flags`
- `text`, `typography`, `color`
- `assetId`, `crop`, `points`

**Use Case**: Modifying existing elements

#### `delete_layer`
Delete a layer (and children if group).

**Input**:
```typescript
{
  layerId: string
}
```

**Use Case**: Removing unwanted elements

#### `group_layers`
Group multiple layers into a group layer.

**Input**:
```typescript
{
  layerIds: string[]
  name: string
}
```

**Use Case**: Organizing related elements

### Query Operations

#### `document_tree`
Get full document structure or filtered view.

**Input**:
```typescript
{
  documentId?: string
  pageId?: string
  frameId?: string
  selectionOnly?: boolean
}
```

**Use Case**: Understanding document structure before modifications

#### `search_design_nodes`
Search for nodes matching criteria.

**Input**:
```typescript
{
  query: string        // Search term
  type?: string       // Filter by node type
  pageId?: string     // Limit to page
}
```

**Use Case**: Finding specific elements

#### `selection_state`
Get current selection.

**Input**: `{}`

**Output**:
```typescript
{
  pageId: string | null
  selectedIds: string[]
}
```

**Use Case**: Understanding what user has selected

#### `get_editor_state`
Get current editor state.

**Input**: `{}`

**Output**: Full editor state including document, selection, viewport

**Use Case**: Getting complete context for operations

### Export Operations

#### `export_frame_png`
Export frame as PNG image.

**Input**:
```typescript
{
  frameId: string
  scale?: number      // Default: 1
  maxResolution?: number  // Default: 4096
}
```

**Output**:
```typescript
{
  mimeType: 'image/png'
  bytesBase64: string
}
```

**Use Case**: Generating previews or exports

### Transaction Operations

#### `begin_transaction`
Start a grouped transaction (one undo step).

**Input**:
```typescript
{
  name: string
}
```

**Output**:
```typescript
{
  txId: string
}
```

**Use Case**: Grouping related operations

#### `commit_transaction`
Commit a transaction.

**Input**:
```typescript
{
  txId: string
}
```

**Use Case**: Finalizing grouped operations

#### `rollback_transaction`
Rollback a transaction.

**Input**:
```typescript
{
  txId: string
}
```

**Use Case**: Undoing grouped operations

## Tool Registration

### Building Tool Registry

```typescript
import { buildMcpTools } from '@/mcp-tools'
import { CanvasCommandBus } from '@/lib/ai/command-bus'
import { SimpleTransactionManager } from '@/lib/ai/transaction-manager'

const commandBus = new CanvasCommandBus()
const txManager = new SimpleTransactionManager()

const toolRegistry = buildMcpTools({
  commands: commandBus,
  tx: txManager,
})
```

### Adding Custom Tools

```typescript
// In mcp-tools.ts
registry.register({
  name: 'custom_tool',
  description: 'Does something custom',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string' }
    },
    required: ['param']
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'string' }
    }
  },
  handler: async (input, ctx) => {
    // Implementation
    return { result: 'success' }
  }
})
```

## Tool Execution Flow

1. **AI Agent** decides to use a tool
2. **Tool Call** sent to API route
3. **MCP Adapter** converts to tool registry format
4. **Tool Handler** executes with ToolContext
5. **Command Bus** dispatches mutations
6. **Document** updates via commands
7. **Result** returned to AI agent
8. **AI** continues with result context

## Best Practices

### 1. Always Use Command Bus
Never mutate documents directly in tool handlers:

```typescript
// ✅ Good
await commands.dispatch({
  type: 'layer.update',
  payload: { docId, layerId, patch }
}, ctx)

// ❌ Bad
doc.layers[layerId].style.fill = 'red'
```

### 2. Validate Inputs
Use inputSchema to validate:

```typescript
inputSchema: {
  type: 'object',
  properties: {
    layerId: { type: 'string', minLength: 1 }
  },
  required: ['layerId']
}
```

### 3. Handle Errors Gracefully
Return meaningful error messages:

```typescript
handler: async (input, ctx) => {
  const doc = ctx.editor.getDocument(docId)
  if (!doc) {
    throw new Error(`Document ${docId} not found`)
  }
  // ...
}
```

### 4. Use Transactions for Groups
Group related operations:

```typescript
const txId = await tx.begin('create_card', ctx)
// ... multiple operations
await tx.commit(txId, ctx)
```

### 5. Provide Context in Descriptions
Help AI understand when to use tools:

```typescript
description: `
  Create a new frame (artboard) on the specified page.
  Use this when user asks to create a new screen or artboard.
  Required: pageId, name, platform, rect dimensions.
`
```

## Batch Design Processor

The `batch_design` tool uses a specialized processor (`src/lib/mcp/batch-design-processor.ts`) that:

1. Parses JavaScript-like operation strings
2. Validates operations
3. Executes in order
4. Groups in transaction
5. Returns created node IDs

**Example**:
```javascript
operations = `
  card=I("page1", { type: "frame", name: "Card", rect: { x: 0, y: 0, w: 300, h: 200 } })
  title=I(card, { type: "text", content: "Title", rect: { x: 10, y: 10, w: 280, h: 30 } })
  body=I(card, { type: "text", content: "Body text", rect: { x: 10, y: 50, w: 280, h: 140 } })
`
```

## Error Handling

Tools should throw errors with clear messages:

```typescript
if (!layer) {
  throw new Error(`Layer ${layerId} not found`)
}
```

Errors are caught and returned to AI agent with context.

## Testing Tools

Test tools independently:

```typescript
const ctx = getToolContextProvider().createToolContext()
const result = await toolRegistry.invoke('create_frame', {
  pageId: 'page1',
  name: 'Test Frame',
  platform: 'desktop',
  rect: { x: 0, y: 0, w: 1440, h: 900 }
}, ctx)
```

## MCP Transport

The MCP tool system supports multiple transport mechanisms:

### HTTP Transport
Standard HTTP-based MCP server communication.

```typescript
const adapter = new MCPAdapter({
  id: 'mcp-http',
  type: 'mcp',
  transport: 'http',
  url: 'http://localhost:3000/mcp'
})
```

### Stdio Transport (Tauri)
Process-based stdio communication via Tauri backend.

```typescript
const adapter = new MCPAdapter({
  id: 'mcp-filesystem',
  type: 'mcp',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']
})
```

**Stdio Features:**
- Spawns MCP server as child process
- JSON-RPC communication via stdin/stdout
- Automatic process lifecycle management
- Connection pooling and reuse
- Error handling and cleanup

**Tauri Commands Used:**
- `spawn_mcp_server()` - Start server process
- `send_mcp_message()` - Send JSON-RPC request
- `read_mcp_response()` - Read JSON-RPC response
- `kill_process()` - Terminate process

See [Tauri Backend](./10-tauri-backend.md) for command details and [Connection Manager](./12-connection-manager.md) for connection lifecycle.

## Related Documentation

- [Connection Manager](./12-connection-manager.md) - Connection lifecycle and status
- [Tauri Backend](./10-tauri-backend.md) - Process spawning and stdio communication
- [Agent Integration](./01-agent-integration.md) - How tools are used by AI
- [Command Bus](./04-command-bus.md) - Mutation system
- [Tool Context Provider](./05-tool-context-provider.md) - Context management
