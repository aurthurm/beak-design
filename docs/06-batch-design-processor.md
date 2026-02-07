# Batch Design Processor

## Overview

The Batch Design Processor is a specialized system for executing multiple design operations atomically. It parses JavaScript-like operation strings and executes them as a single transaction, making it ideal for AI agents creating complex designs.

## Purpose

- **Atomic Operations**: Multiple operations execute as one unit
- **AI-Friendly Syntax**: JavaScript-like syntax easy for AI to generate
- **Transaction Grouping**: All operations in single undo step
- **Error Handling**: Rollback on any failure
- **Streaming Support**: Partial updates for real-time feedback

## Architecture

```
Operation String (JavaScript-like)
    ↓
Parser (batch-design-processor.ts)
    ↓
Operation AST
    ↓
Validator
    ↓
Executor (via Command Bus)
    ↓
Transaction Commit
    ↓
Result with Created Nodes
```

## Operation Syntax

### Insert Operation (I)

**Syntax**: `binding = I("parentId", nodeData)`

**Example**:
```javascript
card = I("page1", {
  type: "frame",
  name: "Card",
  rect: { x: 0, y: 0, w: 300, h: 200 }
})
```

**Use Case**: Create new nodes

### Copy Operation (C)

**Syntax**: `binding = C("sourceId", "parentId", options)`

**Example**:
```javascript
card2 = C("card1", "page1", {
  name: "Card Copy",
  positionDirection: "right",
  positionPadding: 50
})
```

**Use Case**: Duplicate existing nodes

### Update Operation (U)

**Syntax**: `U("nodeId", patchData)` or `U(binding + "/childId", patchData)`

**Example**:
```javascript
U("card1", { rect: { w: 400 } })
U(card + "/title", { content: "New Title" })
```

**Use Case**: Modify existing node properties

### Replace Operation (R)

**Syntax**: `binding = R("nodeId", newNodeData)`

**Example**:
```javascript
newTitle = R("card1/title", {
  type: "text",
  content: "Replaced Title"
})
```

**Use Case**: Replace entire nodes or children

### Delete Operation (D)

**Syntax**: `D("nodeId")` or `D(binding)`

**Example**:
```javascript
D("card1")
D(oldCard)
```

**Use Case**: Remove nodes

### Move Operation (M)

**Syntax**: `M("nodeId", "newParentId", index?)`

**Example**:
```javascript
M("layer1", "group1", 0)
M("layer2", "frame2")
```

**Use Case**: Reorder or reparent nodes

## Complete Example

```javascript
// Create a card component
card = I("page1", {
  type: "frame",
  name: "Product Card",
  platform: "desktop",
  rect: { x: 100, y: 100, w: 300, h: 400 }
})

// Add title
title = I(card, {
  type: "text",
  name: "Title",
  content: "Product Name",
  rect: { x: 20, y: 20, w: 260, h: 30 },
  style: { fontSize: 24, fontWeight: "bold" }
})

// Add image
image = I(card, {
  type: "image",
  name: "Product Image",
  rect: { x: 20, y: 60, w: 260, h: 200 },
  assetId: "img123"
})

// Add description
description = I(card, {
  type: "text",
  name: "Description",
  content: "Product description text",
  rect: { x: 20, y: 270, w: 260, h: 100 },
  style: { fontSize: 14 }
})

// Add button
button = I(card, {
  type: "rect",
  name: "Button",
  rect: { x: 20, y: 380, w: 260, h: 40 },
  style: { fill: "#0066ff", cornerRadius: 8 }
})

buttonText = I(button, {
  type: "text",
  content: "Buy Now",
  rect: { x: 0, y: 0, w: 260, h: 40 },
  style: { fontSize: 16, textAlign: "center", fill: "#ffffff" }
})
```

## Binding System

**Purpose**: Reference created nodes in subsequent operations

**Rules**:
- Bindings are created with `binding = Operation(...)`
- Bindings can be used in later operations
- Bindings resolve to node IDs after creation
- Use `+` operator for paths: `binding + "/childId"`

**Example**:
```javascript
card = I("page1", { ... })           // Creates binding "card"
title = I(card, { ... })              // Uses binding
U(card + "/title", { ... })          // Uses binding with path
```

## Operation Execution

### Execution Order

Operations execute **sequentially** in the order they appear:

```javascript
card = I("page1", { ... })      // 1. Execute first
title = I(card, { ... })         // 2. Execute second (card exists)
U(title, { ... })                // 3. Execute third (title exists)
```

### Error Handling

If any operation fails, **all operations rollback**:

```javascript
card = I("page1", { ... })       // ✅ Success
title = I(card, { ... })         // ✅ Success
badOp = I("invalid", { ... })   // ❌ Fails - all rollback
```

### Transaction Grouping

All operations in a batch are grouped in a **single transaction**:

```javascript
// All operations = one undo step
card = I("page1", { ... })
title = I(card, { ... })
image = I(card, { ... })

// Undo once = removes all three
```

## Partial Updates (Streaming)

**Purpose**: Support real-time updates during AI generation

**Usage**:
```typescript
// First batch (partial)
await batchDesign.process(ctx, true, `
  card = I("page1", { ... })
`, "batch1")

// Second batch (partial, continues)
await batchDesign.process(ctx, true, `
  title = I(card, { ... })
`, "batch1")

// Final batch (complete)
await batchDesign.process(ctx, false, `
  image = I(card, { ... })
`, "batch1")
```

**Behavior**:
- `partial: true` - Operations execute but transaction not committed
- `partial: false` - Final batch, transaction commits
- Same `id` used for all batches in sequence

## Node Data Schema

### Frame Node
```typescript
{
  type: "frame"
  name: string
  platform: "mobile" | "tablet" | "desktop" | "custom"
  rect: { x: number, y: number, w: number, h: number }
}
```

### Layer Node
```typescript
{
  type: "rect" | "text" | "image" | "ellipse" | "line" | "group"
  name: string
  rect: { x: number, y: number, w: number, h: number }
  rotation?: number
  style?: {
    fill?: string
    stroke?: string
    strokeWidth?: number
    cornerRadius?: number
    // ... more style properties
  }
  // Type-specific properties
}
```

### Text Layer
```typescript
{
  type: "text"
  content: string
  typography?: {
    fontSize?: number
    fontWeight?: string
    fontFamily?: string
    lineHeight?: number
  }
  textAlign?: "left" | "center" | "right"
  verticalAlign?: "top" | "middle" | "bottom"
}
```

### Image Layer
```typescript
{
  type: "image"
  assetId: string
  crop?: { x: number, y: number, w: number, h: number }
}
```

## Result Format

### Success Result
```typescript
{
  success: true
  message: string
  createdNodes?: Array<{
    id: string
    type: string
    children?: Array<{ id: string }>
  }>
}
```

### Processing Result (Partial)
```typescript
{
  success: true
  message: "Processing..."
}
```

### Error Result
```typescript
{
  success: false
  message: string
  error?: {
    code: string
    message: string
    line?: number
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import { BatchDesignProcessor } from '@/lib/mcp/batch-design-processor'
import { CanvasCommandBus } from '@/lib/ai/command-bus'

const commandBus = new CanvasCommandBus()
const processor = new BatchDesignProcessor(commandBus)

const operations = `
  card = I("page1", {
    type: "frame",
    name: "Card",
    rect: { x: 0, y: 0, w: 300, h: 200 }
  })
  title = I(card, {
    type: "text",
    content: "Title",
    rect: { x: 10, y: 10, w: 280, h: 30 }
  })
`

const result = await processor.process(
  ctx,
  false,  // Not partial
  operations,
  "batch-123"
)

if (result?.success) {
  console.log('Created nodes:', result.createdNodes)
}
```

### In MCP Tool

```typescript
// In batch_design tool handler
handler: async (input, ctx) => {
  const { BatchDesignProcessor } = await import('./batch-design-processor')
  const processor = new BatchDesignProcessor(commands)
  
  const result = await processor.process(
    ctx,
    input.partial || false,
    input.operations,
    input.id
  )
  
  return result || { success: true, message: "Processing..." }
}
```

### AI Agent Usage

```typescript
// AI generates operations string
const operations = `
  header = I("page1", {
    type: "frame",
    name: "Header",
    rect: { x: 0, y: 0, w: 1440, h: 80 }
  })
  logo = I(header, {
    type: "image",
    assetId: "logo123",
    rect: { x: 20, y: 20, w: 40, h: 40 }
  })
  nav = I(header, {
    type: "rect",
    rect: { x: 100, y: 20, w: 800, h: 40 },
    style: { fill: "#f0f0f0" }
  })
`

// Send to batch_design tool
await invokeTool('batch_design', {
  operations,
  id: 'header-batch',
  partial: false
})
```

## Error Messages

### Parse Errors
```
"Syntax error at line 3: Expected '=' after binding"
```

### Validation Errors
```
"Invalid node type: 'invalid_type'"
"Missing required property: 'rect'"
```

### Execution Errors
```
"Parent node 'parent123' not found"
"Operation failed: Layer creation error"
```

## Best Practices

### 1. Use Descriptive Bindings
```javascript
// ✅ Good
productCard = I("page1", { ... })
cardTitle = I(productCard, { ... })

// ❌ Bad
a = I("page1", { ... })
b = I(a, { ... })
```

### 2. Group Related Operations
```javascript
// All card-related operations together
card = I("page1", { ... })
cardTitle = I(card, { ... })
cardImage = I(card, { ... })
cardButton = I(card, { ... })
```

### 3. Use Transactions for Complex Operations
```javascript
// Single transaction for entire component
component = I("page1", { ... })
// ... all component parts
// All undo together
```

### 4. Handle Errors
```typescript
const result = await processor.process(ctx, false, operations, id)
if (!result?.success) {
  console.error('Batch failed:', result.message)
  // Handle error
}
```

### 5. Use Partial Updates for Streaming
```typescript
// Stream operations as AI generates them
await processor.process(ctx, true, operations1, id)  // Partial
await processor.process(ctx, true, operations2, id)  // Partial
await processor.process(ctx, false, operations3, id)  // Final
```

## Limitations

1. **Sequential Execution**: Operations execute in order, no parallel execution
2. **No Conditionals**: No if/else or loops in operation strings
3. **No Variables**: Only bindings, no variables or expressions
4. **String Parsing**: Operations parsed as strings, not true JavaScript
5. **Error Recovery**: Full rollback on any error, no partial success

## Related Documentation

- [MCP Tools](./02-mcp-tools.md) - How batch_design tool uses processor
- [Command Bus](./04-command-bus.md) - How operations become commands
- [Agent Integration](./01-agent-integration.md) - How AI uses batch operations
