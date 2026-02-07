# Command Bus System

## Overview

The Command Bus is the **single source of truth** for all document mutations. It ensures consistent state management, enables undo/redo, supports transactions, and provides an audit trail.

## Architecture

```
Tool Handler / UI Action
    ↓
Command Bus (dispatch)
    ↓
Command Execution
    ↓
Document Mutation
    ↓
Storage Persistence
    ↓
Canvas Store Update
    ↓
UI Re-render
```

## Core Principles

### 1. **Single Mutation Path**
All document changes MUST go through the Command Bus. No direct mutations allowed.

### 2. **Immutable Updates**
Documents are updated immutably, creating new objects rather than mutating existing ones.

### 3. **Transaction Support**
Related commands can be grouped into transactions for atomic operations.

### 4. **Error Handling**
Commands return `CommandResult` indicating success or failure with error details.

## Command Types

### Document Commands

#### `doc.create`
Create a new document.

```typescript
{
  type: 'doc.create'
  payload: {
    name: string
    docId: DocumentId
  }
}
```

#### `doc.open`
Open an existing document.

```typescript
{
  type: 'doc.open'
  payload: {
    docId: DocumentId
  }
}
```

#### `doc.save`
Save document to storage.

```typescript
{
  type: 'doc.save'
  payload: {
    docId: DocumentId
  }
}
```

### Page Commands

#### `page.create`
Create a new page.

```typescript
{
  type: 'page.create'
  payload: {
    docId: DocumentId
    pageId: PageId
    name: string
  }
}
```

#### `page.delete`
Delete a page and all its frames/layers.

```typescript
{
  type: 'page.delete'
  payload: {
    docId: DocumentId
    pageId: PageId
  }
}
```

#### `page.rename`
Rename a page.

```typescript
{
  type: 'page.rename'
  payload: {
    docId: DocumentId
    pageId: PageId
    name: string
  }
}
```

#### `page.setActive`
Set the active page.

```typescript
{
  type: 'page.setActive'
  payload: {
    docId: DocumentId
    pageId: PageId
  }
}
```

### Frame Commands

#### `frame.create`
Create a new frame (artboard).

```typescript
{
  type: 'frame.create'
  payload: {
    docId: DocumentId
    frameId: FrameId
    input: {
      pageId: PageId
      name: string
      platform: 'mobile' | 'tablet' | 'desktop' | 'custom'
      rect: { x: number, y: number, w: number, h: number }
    }
  }
}
```

#### `frame.update`
Update frame properties.

```typescript
{
  type: 'frame.update'
  payload: {
    docId: DocumentId
    frameId: FrameId
    patch: Partial<Frame>
  }
}
```

#### `frame.delete`
Delete a frame and all its layers.

```typescript
{
  type: 'frame.delete'
  payload: {
    docId: DocumentId
    frameId: FrameId
  }
}
```

### Layer Commands

#### `layer.create`
Create a new layer.

```typescript
{
  type: 'layer.create'
  payload: {
    docId: DocumentId
    layerId: LayerId
    input: CreateLayerInput
  }
}
```

#### `layer.update`
Update layer properties.

```typescript
{
  type: 'layer.update'
  payload: {
    docId: DocumentId
    layerId: LayerId
    patch: Patch<Layer>
  }
}
```

**Note**: Patch is restricted to safe properties to prevent data corruption.

#### `layer.delete`
Delete a layer.

```typescript
{
  type: 'layer.delete'
  payload: {
    docId: DocumentId
    layerId: LayerId
  }
}
```

#### `layer.group`
Group layers into a group layer.

```typescript
{
  type: 'layer.group'
  payload: {
    docId: DocumentId
    groupId: LayerId
    layerIds: LayerId[]
    name: string
  }
}
```

#### `layer.ungroup`
Ungroup a group layer.

```typescript
{
  type: 'layer.ungroup'
  payload: {
    docId: DocumentId
    groupId: LayerId
  }
}
```

#### `layer.reorder`
Reorder layers within a frame.

```typescript
{
  type: 'layer.reorder'
  payload: {
    docId: DocumentId
    layerId: LayerId
    toIndex: number
  }
}
```

### Selection Commands

#### `selection.set`
Set the current selection.

```typescript
{
  type: 'selection.set'
  payload: {
    docId: DocumentId
    selection: SelectionState
  }
}
```

## Command Bus Implementation

### CanvasCommandBus (`src/lib/ai/command-bus.ts`)

**Purpose**: Executes commands and mutates documents

**Key Methods**:

```typescript
class CanvasCommandBus implements CommandBus {
  async dispatch(cmd: Command, ctx: ToolContext): Promise<CommandResult>
  
  private async executeCommand(
    cmd: Command,
    document: Document,
    ctx: ToolContext
  ): Promise<CommandResult & { document: Document }>
}
```

**Execution Flow**:
1. Extract document ID from command
2. Load document from editor or storage
3. Execute command (immutable update)
4. Save updated document to storage
5. Update editor runtime
6. Return result with changed IDs

**Error Handling**:
```typescript
// Returns CommandResult
{
  ok: true,
  changedIds?: string[]
} | {
  ok: false,
  error: {
    code: string
    message: string
    details?: any
  }
}
```

## Usage Examples

### Basic Command Execution

```typescript
import { CanvasCommandBus } from '@/lib/ai/command-bus'
import { getToolContextProvider } from '@/lib/ai/tool-context-provider'

const commandBus = new CanvasCommandBus()
const ctx = getToolContextProvider().createToolContext()

// Create a frame
const result = await commandBus.dispatch({
  type: 'frame.create',
  payload: {
    docId: 'doc123',
    frameId: 'frame456',
    input: {
      pageId: 'page1',
      name: 'Home Screen',
      platform: 'mobile',
      rect: { x: 0, y: 0, w: 390, h: 844 }
    }
  }
}, ctx)

if (result.ok) {
  console.log('Frame created:', result.changedIds)
} else {
  console.error('Error:', result.error.message)
}
```

### Updating a Layer

```typescript
const result = await commandBus.dispatch({
  type: 'layer.update',
  payload: {
    docId: 'doc123',
    layerId: 'layer789',
    patch: {
      style: {
        fill: '#FF0000',
        stroke: '#000000',
        strokeWidth: 2
      }
    }
  }
}, ctx)
```

### Batch Operations

```typescript
// Group multiple operations in a transaction
const txId = await txManager.begin('create_card', ctx)

await commandBus.dispatch({
  type: 'layer.create',
  payload: { docId, layerId: id1, input: titleInput }
}, ctx)

await commandBus.dispatch({
  type: 'layer.create',
  payload: { docId, layerId: id2, input: imageInput }
}, ctx)

await commandBus.dispatch({
  type: 'layer.group',
  payload: { docId, groupId: id3, layerIds: [id1, id2], name: 'Card' }
}, ctx)

await txManager.commit(txId, ctx)
// All operations are now one undo step
```

## Transaction Manager

### SimpleTransactionManager (`src/lib/ai/transaction-manager.ts`)

**Purpose**: Groups commands into transactions

**Methods**:
```typescript
class SimpleTransactionManager {
  async begin(name: string, ctx: ToolContext): Promise<TransactionId>
  async commit(txId: TransactionId, ctx: ToolContext): Promise<void>
  async rollback(txId: TransactionId, ctx: ToolContext): Promise<void>
  async inTransaction<T>(
    name: string,
    ctx: ToolContext,
    fn: () => Promise<T>
  ): Promise<T>
}
```

**Usage**:
```typescript
const txManager = new SimpleTransactionManager()

// Manual transaction
const txId = await txManager.begin('create_component', ctx)
try {
  // ... commands
  await txManager.commit(txId, ctx)
} catch (error) {
  await txManager.rollback(txId, ctx)
}

// Automatic transaction
await txManager.inTransaction('create_component', ctx, async () => {
  await commandBus.dispatch(cmd1, ctx)
  await commandBus.dispatch(cmd2, ctx)
  await commandBus.dispatch(cmd3, ctx)
})
```

## Command Result

### Success Result
```typescript
{
  ok: true
  changedIds?: string[]  // IDs of created/modified nodes
}
```

### Error Result
```typescript
{
  ok: false
  error: {
    code: string        // Error code (e.g., 'NOT_FOUND', 'INVALID')
    message: string     // Human-readable message
    details?: any       // Additional error context
  }
}
```

## Error Codes

- `MISSING_DOC_ID`: Command requires document ID but none provided
- `DOCUMENT_NOT_FOUND`: Document doesn't exist
- `NOT_FOUND`: Resource (page/frame/layer) not found
- `INVALID`: Invalid operation (e.g., ungrouping non-group)
- `COMMAND_ERROR`: General command execution error
- `UNKNOWN_COMMAND`: Command type not recognized

## Best Practices

### 1. Always Check Results
```typescript
const result = await commandBus.dispatch(cmd, ctx)
if (!result.ok) {
  throw new Error(result.error.message)
}
```

### 2. Use Transactions for Groups
Group related operations:
```typescript
await txManager.inTransaction('create_card', ctx, async () => {
  // Multiple related commands
})
```

### 3. Provide Context
Include document ID and all required IDs:
```typescript
{
  type: 'layer.update',
  payload: {
    docId: ctx.activeDocumentId!,  // Required
    layerId: layerId,                // Required
    patch: { ... }                   // Required
  }
}
```

### 4. Handle Errors Gracefully
```typescript
try {
  const result = await commandBus.dispatch(cmd, ctx)
  if (!result.ok) {
    // Handle specific error codes
    if (result.error.code === 'NOT_FOUND') {
      // Handle not found
    }
  }
} catch (error) {
  // Handle unexpected errors
}
```

### 5. Return Changed IDs
Use `changedIds` for animations and updates:
```typescript
if (result.ok && result.changedIds) {
  result.changedIds.forEach(id => {
    flashNodeOnAgentOperation(id)
  })
}
```

## Integration with Tools

Commands are executed by MCP tools:

```typescript
// In tool handler
handler: async (input, ctx) => {
  const docId = requireActiveDocId(ctx)
  
  const result = await commands.dispatch({
    type: 'layer.create',
    payload: { docId, layerId: ctx.ids.layer(), input }
  }, ctx)
  
  if (!result.ok) {
    throw new Error(result.error.message)
  }
  
  return { layerId: input.layerId }
}
```

## Undo/Redo Integration

Commands are automatically tracked for undo/redo:

```typescript
// Commands executed
await commandBus.dispatch(cmd1, ctx)  // Undo step 1
await commandBus.dispatch(cmd2, ctx)  // Undo step 2

// Transaction groups commands
await txManager.inTransaction('group', ctx, async () => {
  await commandBus.dispatch(cmd3, ctx)  // All in one undo step
  await commandBus.dispatch(cmd4, ctx)
})

// Undo
undoRedoActions.undo()  // Undoes transaction (cmd3 + cmd4)
undoRedoActions.undo()  // Undoes cmd2
undoRedoActions.undo()  // Undoes cmd1
```

## Related Documentation

- [MCP Tools](./02-mcp-tools.md) - How tools use commands
- [Canvas System](./03-canvas-system.md) - How commands affect canvas
- [Tool Context Provider](./05-tool-context-provider.md) - Context for commands
