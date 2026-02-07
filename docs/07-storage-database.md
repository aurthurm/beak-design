# Storage & Database System

## Overview

The Storage & Database system handles document persistence using LowDB with browser localStorage for client-side storage and file system access for server-side (Tauri) operations.

## Architecture

```
Application Layer
    ↓
Storage Adapter (Tool Context Provider)
    ↓
┌──────────────┬──────────────┐
│  Client-Side │ Server-Side  │
│  localStorage │ File System  │
└──────────────┴──────────────┘
    ↓              ↓
LowDB (Browser)  LowDB (Node)
```

## Storage Locations

### Client-Side (Browser)
- **Storage**: Browser `localStorage`
- **Keys**: 
  - `'beak-users-db'` - User database
  - `'beak_metadata'` - Document metadata
- **Format**: JSON serialized LowDB data

### Server-Side (Tauri)
- **Storage**: File system (`db/data.json`)
- **Location**: `process.cwd()/db/data.json`
- **Format**: JSON file

## Database Schema

### Main Database Structure

```typescript
interface Database {
  documents: Record<string, Document>
  activeDocumentId: string | null
}
```

### Document Structure

See [Canvas System](./03-canvas-system.md) for full document schema.

## Core Components

### Database (`src/lib/db/index.server.ts`)

**Purpose**: Server-side database operations

**Key Functions**:

```typescript
// Initialize database
await initDb()

// Document operations
await saveDocument(document: Document): Promise<void>
await getDocument(documentId: string): Promise<Document | null>
await getAllDocuments(): Promise<Document[]>
await deleteDocument(documentId: string): Promise<void>

// Active document
await getActiveDocumentId(): Promise<string | null>
await setActiveDocumentId(documentId: string | null): Promise<void>
```

### Storage Adapter (`src/lib/ai/tool-context-provider.ts`)

**Purpose**: Unified storage interface for tools

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

## Usage Examples

### Saving a Document

```typescript
import { saveDocument } from '@/lib/db/index.server'

const document: Document = {
  id: 'doc123',
  name: 'My Design',
  schemaVersion: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  activePageId: 'page1',
  pages: { /* ... */ },
  frames: { /* ... */ },
  layers: { /* ... */ },
  // ... rest of document
}

await saveDocument(document)
```

### Loading a Document

```typescript
import { getDocument } from '@/lib/db/index.server'

const doc = await getDocument('doc123')
if (doc) {
  console.log('Loaded:', doc.name)
} else {
  console.log('Document not found')
}
```

### Listing Documents

```typescript
import { getAllDocuments } from '@/lib/db/index.server'

const docs = await getAllDocuments()
docs.forEach(doc => {
  console.log(`${doc.name} - ${doc.updatedAt}`)
})
```

### Using Storage Adapter

```typescript
import { getToolContextProvider } from '@/lib/ai/tool-context-provider'

const provider = getToolContextProvider()
const ctx = provider.createToolContext()

// Create empty document
const doc = ctx.storage.createEmptyDocument({
  name: 'New Design',
  docId: 'doc456',
  now: new Date().toISOString()
})

// Load document
const loaded = await ctx.storage.loadDocument('doc123')

// Save document
await ctx.storage.saveDocument(updatedDoc)

// List recent
const recent = await ctx.storage.listRecent()
```

## Document Lifecycle

### Creation

```typescript
// 1. Create empty document
const doc = createEmptyDocument('My Design')

// 2. Add content (via commands)
await commandBus.dispatch({
  type: 'page.create',
  payload: { docId: doc.id, pageId: 'page1', name: 'Page 1' }
}, ctx)

// 3. Save document
await ctx.storage.saveDocument(doc)
```

### Loading

```typescript
// 1. Load from storage
const doc = await ctx.storage.loadDocument('doc123')

// 2. Set in editor
ctx.editor.setDocument(doc)

// 3. Update canvas store (client-side)
canvasActions.setDocument(doc)
```

### Updating

```typescript
// 1. Load document
const doc = await ctx.storage.loadDocument('doc123')

// 2. Modify via commands
await commandBus.dispatch({
  type: 'layer.create',
  payload: { docId: doc.id, layerId: 'layer1', input }
}, ctx)

// 3. Get updated document
const updated = ctx.editor.getDocument(doc.id)

// 4. Save
await ctx.storage.saveDocument(updated)
```

### Deletion

```typescript
import { deleteDocument } from '@/lib/db/index.server'

await deleteDocument('doc123')
```

## Auto-Save System

### Auto-Save (`src/lib/beaki/auto-save.ts`)

**Purpose**: Automatically save documents periodically

**Features**:
- Saves after idle period
- Saves on document changes
- Debounced to avoid excessive saves
- Updates save status indicator

**Usage**:
```typescript
import { setupAutoSave } from '@/lib/beaki/auto-save'

// Setup auto-save for document
setupAutoSave(docId, {
  onSave: async (doc) => {
    await saveDocument(doc)
  },
  debounceMs: 1000
})
```

## File System Access (Tauri)

### File Handler (`src/lib/beaki/file-handler.ts`)

**Purpose**: Native file system operations (Tauri only)

**Features**:
- Open files from disk
- Save files to disk
- File picker dialogs
- File handle persistence

**Usage**:
```typescript
import { openFile, saveFile } from '@/lib/beaki/file-handler'

// Open file
const { document, fileHandle } = await openFile()

// Save file
await saveFile(document, fileHandle)
```

## Data Migration

### Schema Versioning

Documents include `schemaVersion` for migration:

```typescript
interface Document {
  schemaVersion: string
  // ... other fields
}
```

### Migration Strategy

1. Check document `schemaVersion`
2. Apply migrations if needed
3. Update `schemaVersion`
4. Save migrated document

**Example**:
```typescript
function migrateDocument(doc: Document): Document {
  if (doc.schemaVersion === '1.0.0') {
    // Apply migration
    return {
      ...doc,
      schemaVersion: '1.1.0',
      // ... migrated fields
    }
  }
  return doc
}
```

## Error Handling

### Storage Errors

```typescript
try {
  await saveDocument(doc)
} catch (error) {
  if (error instanceof StorageError) {
    // Handle storage-specific error
    console.error('Storage error:', error.message)
  } else {
    // Handle other errors
    throw error
  }
}
```

### Common Errors

- **Document Not Found**: Document ID doesn't exist
- **Storage Full**: localStorage quota exceeded (browser)
- **Permission Denied**: File system access denied (Tauri)
- **Corrupted Data**: Invalid JSON in storage

## Best Practices

### 1. Always Save After Mutations

```typescript
// After command execution
const result = await commandBus.dispatch(cmd, ctx)
if (result.ok) {
  const doc = ctx.editor.getDocument(docId)
  await ctx.storage.saveDocument(doc)
}
```

### 2. Handle Missing Documents

```typescript
const doc = await ctx.storage.loadDocument(docId)
if (!doc) {
  // Create new or show error
  throw new Error(`Document ${docId} not found`)
}
```

### 3. Use Transactions for Multiple Saves

```typescript
// Group related saves
await txManager.inTransaction('save_changes', ctx, async () => {
  await ctx.storage.saveDocument(doc1)
  await ctx.storage.saveDocument(doc2)
})
```

### 4. Check Storage Availability

```typescript
// Browser localStorage
if (typeof Storage !== 'undefined') {
  // localStorage available
} else {
  // Fallback to server storage
}

// Tauri file system
if (window.__TAURI__) {
  // File system available
}
```

### 5. Handle Large Documents

```typescript
// Check document size
const docSize = JSON.stringify(doc).length
if (docSize > MAX_DOCUMENT_SIZE) {
  // Warn user or split document
}
```

## Performance Considerations

### 1. Debounce Saves
Don't save on every keystroke:

```typescript
const debouncedSave = debounce(async (doc) => {
  await saveDocument(doc)
}, 1000)
```

### 2. Batch Operations
Group multiple document updates:

```typescript
// Update multiple documents
const updates = [doc1, doc2, doc3]
await Promise.all(updates.map(doc => saveDocument(doc)))
```

### 3. Lazy Loading
Load documents on demand:

```typescript
// Don't load all documents at once
const doc = await getDocument(docId)  // Load when needed
```

### 4. Indexed Access
Use document IDs for fast lookup:

```typescript
// Fast: O(1) lookup
const doc = database.documents[docId]

// Slow: O(n) search
const doc = documents.find(d => d.id === docId)
```

## Backup & Recovery

### Export Documents

```typescript
// Export to JSON
const json = JSON.stringify(doc, null, 2)
const blob = new Blob([json], { type: 'application/json' })

// Download
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `${doc.name}.json`
a.click()
```

### Import Documents

```typescript
// Read JSON file
const file = await readFile()
const doc = JSON.parse(file) as Document

// Validate and save
if (validateDocument(doc)) {
  await saveDocument(doc)
}
```

## Related Documentation

- [Tool Context Provider](./05-tool-context-provider.md) - How tools access storage
- [Command Bus](./04-command-bus.md) - How commands trigger saves
- [Canvas System](./03-canvas-system.md) - Document structure
