# Tool Context Provider

## Overview

The Tool Context Provider bridges the AI system and MCP tools, providing a consistent interface for tool execution regardless of whether code runs on the client or server.

## Purpose

- **Unified Interface**: Single API for tools to access editor state
- **Client/Server Abstraction**: Handles differences between browser and server execution
- **Context Management**: Manages active document, selection, and editor state
- **Storage Integration**: Connects tools to document persistence layer

## Architecture

```
Tool Execution
    ↓
Tool Context Provider
    ↓
┌─────────────┬──────────────┐
│   Storage   │   Editor     │
│   Adapter    │   Runtime    │
└─────────────┴──────────────┘
    ↓              ↓
Database      Canvas Store
```

## Core Components

### ToolContextProvider (`src/lib/ai/tool-context-provider.ts`)

**Purpose**: Main provider class creating ToolContext instances

**Key Methods**:

```typescript
class ToolContextProvider {
  createToolContext(): ToolContext
  setActiveDocumentId(docId: DocumentId | null): void
  getActiveDocumentId(): DocumentId | null
  setActor(actor: Actor): void
}
```

### ToolContext Interface

```typescript
{
  activeDocumentId: DocumentId | null
  actor: Actor                    // { kind: 'user' | 'agent', agentName?: string }
  storage: StorageAdapter         // Document persistence
  editor: EditorRuntime           // Current editor state
  ids: IdFactory                  // ID generation
  nowISO: () => string            // Timestamp generation
}
```

## Storage Adapter

**Purpose**: Handles document persistence

**Methods**:

```typescript
interface StorageAdapter {
  createEmptyDocument(input: {
    name: string
    docId: DocumentId
    now: string
  }): Document
  
  loadDocument(docId: DocumentId): Promise<Document>
  
  saveDocument(doc: Document): Promise<void>
  
  listRecent(): Promise<Array<{
    id: DocumentId
    name: string
    updatedAt: string
  }>>
}
```

**Implementation**:
- Uses LowDB for browser storage
- Uses file system for server-side (Tauri)
- Falls back to canvas store on client

## Editor Runtime

**Purpose**: Provides access to current editor state

**Methods**:

```typescript
interface EditorRuntime {
  getDocument(docId: DocumentId): Document | null
  setDocument(doc: Document): void
  getSelection(): SelectionState
  setSelection(sel: SelectionState): void
  exportFramePng(input: ExportFramePngInput): Promise<{
    mimeType: 'image/png'
    bytesBase64: string
  }>
}
```

**Client/Server Handling**:
- **Client**: Uses canvas store for real-time state
- **Server**: Uses document cache and storage adapter
- **Export**: Only available on client-side (requires Konva)

## Usage Examples

### Basic Usage

```typescript
import { getToolContextProvider } from '@/lib/ai/tool-context-provider'

// Get singleton instance
const provider = getToolContextProvider()

// Set active document
provider.setActiveDocumentId('doc123')

// Create tool context
const ctx = provider.createToolContext()

// Use in tool handler
const doc = ctx.editor.getDocument('doc123')
const selection = ctx.editor.getSelection()
const newId = ctx.ids.layer()
```

### In Tool Handlers

```typescript
// Tool handler receives ToolContext
handler: async (input, ctx: ToolContext) => {
  // Get active document
  const docId = ctx.activeDocumentId
  if (!docId) {
    throw new Error('No active document')
  }
  
  // Load document
  const doc = ctx.editor.getDocument(docId) || 
              await ctx.storage.loadDocument(docId)
  
  // Generate IDs
  const layerId = ctx.ids.layer()
  const frameId = ctx.ids.frame()
  
  // Get current selection
  const selection = ctx.editor.getSelection()
  
  // Create timestamp
  const now = ctx.nowISO()
  
  // Save document
  await ctx.storage.saveDocument(updatedDoc)
  
  return { layerId }
}
```

### Setting Actor

```typescript
const provider = getToolContextProvider()

// Set actor for user actions
provider.setActor({ kind: 'user' })

// Set actor for AI agent
provider.setActor({ kind: 'agent', agentName: 'claude' })
```

## Client vs Server Differences

### Client-Side Execution

```typescript
// Canvas store is available
const state = canvasStore.state
const doc = state.document

// Editor runtime uses canvas store
ctx.editor.getDocument(docId)  // From canvas store
ctx.editor.getSelection()      // From canvas store

// Export available
await ctx.editor.exportFramePng({ frameId, scale: 2 })
```

### Server-Side Execution

```typescript
// Canvas store NOT available
// Editor runtime uses document cache
ctx.editor.getDocument(docId)  // From cache or storage

// Selection defaults to empty
ctx.editor.getSelection()      // { pageId: null, selectedIds: [] }

// Export throws error
await ctx.editor.exportFramePng(...)  // Error: Only on client
```

## Document Cache

**Purpose**: In-memory cache for server-side operations

**Behavior**:
- Documents loaded from storage are cached
- Cache persists for tool execution lifetime
- Cache is updated when documents are modified
- Cache is cleared on provider reset

**Usage**:
```typescript
// Document is cached after first load
const doc1 = await ctx.storage.loadDocument(docId)  // Loads from storage
const doc2 = ctx.editor.getDocument(docId)          // From cache

// Cache updated on setDocument
ctx.editor.setDocument(updatedDoc)                 // Updates cache
```

## ID Generation

**Purpose**: Consistent ID generation across system

**Available Generators**:
```typescript
ctx.ids.doc()         // Document ID
ctx.ids.page()        // Page ID
ctx.ids.frame()        // Frame ID
ctx.ids.layer()        // Layer ID
ctx.ids.component()    // Component ID
ctx.ids.token()        // Token ID
ctx.ids.tx()           // Transaction ID
```

**Implementation**: Uses nanoid for short, URL-safe IDs

## Timestamp Generation

**Purpose**: Consistent ISO timestamp generation

**Usage**:
```typescript
const now = ctx.nowISO()  // "2024-01-15T10:30:00.000Z"
```

**Use Cases**:
- Document creation/update timestamps
- Provenance tracking
- Audit logs

## Singleton Pattern

**Purpose**: Single instance across application

**Access**:
```typescript
// Always use getToolContextProvider()
const provider = getToolContextProvider()

// Don't create new instances
// ❌ const provider = new ToolContextProvider()
```

**Initialization**:
- Automatically initializes on first access
- Subscribes to canvas store changes (client-side)
- Updates active document ID when document changes

## Integration with Command Bus

```typescript
const commandBus = new CanvasCommandBus()
const ctx = provider.createToolContext()

// Commands use context
const result = await commandBus.dispatch({
  type: 'layer.create',
  payload: { docId: ctx.activeDocumentId!, layerId: ctx.ids.layer(), input }
}, ctx)
```

## Integration with MCP Tools

```typescript
// Tools receive context
const toolRegistry = buildMcpTools({ commands, tx })

// Tool handlers use context
registry.register({
  name: 'create_layer',
  handler: async (input, ctx: ToolContext) => {
    const docId = ctx.activeDocumentId!
    const layerId = ctx.ids.layer()
    // ... use context
  }
})
```

## Error Handling

### Missing Document

```typescript
const docId = ctx.activeDocumentId
if (!docId) {
  throw new Error('No active document')
}

const doc = ctx.editor.getDocument(docId)
if (!doc) {
  const loaded = await ctx.storage.loadDocument(docId)
  if (!loaded) {
    throw new Error(`Document ${docId} not found`)
  }
}
```

### Server-Side Export

```typescript
try {
  await ctx.editor.exportFramePng({ frameId, scale: 1 })
} catch (error) {
  if (error.message.includes('client-side')) {
    // Export not available on server
    return { error: 'Export requires client-side execution' }
  }
  throw error
}
```

## Best Practices

### 1. Always Check Active Document
```typescript
const docId = ctx.activeDocumentId
if (!docId) {
  throw new Error('No active document')
}
```

### 2. Use Storage for Loading
```typescript
const doc = ctx.editor.getDocument(docId) || 
            await ctx.storage.loadDocument(docId)
```

### 3. Save After Mutations
```typescript
// After modifying document
ctx.editor.setDocument(updatedDoc)
await ctx.storage.saveDocument(updatedDoc)
```

### 4. Use Context IDs
```typescript
// Always use context ID generator
const layerId = ctx.ids.layer()  // ✅
const layerId = generateId()     // ❌ Don't use directly
```

### 5. Handle Client/Server Differences
```typescript
if (typeof window !== 'undefined') {
  // Client-side code
  const state = canvasStore.state
} else {
  // Server-side code
  const doc = await ctx.storage.loadDocument(docId)
}
```

## Related Documentation

- [Command Bus](./04-command-bus.md) - How commands use context
- [MCP Tools](./02-mcp-tools.md) - How tools receive context
- [Agent Integration](./01-agent-integration.md) - How AI uses context
