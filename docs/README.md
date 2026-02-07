# Beak Design Documentation

Welcome to the Beak Design documentation. This documentation covers the architecture, modules, and workflows of the design tool.

## Documentation Index

### Core Architecture
- **[Architecture Overview](./00-architecture-overview.md)** - System architecture, data flow, and design patterns
- **[Agent Integration](./01-agent-integration.md)** - AI chat system with streaming and MCP tools
- **[Local Agent Integration](./08-local-agent-integration.md)** - Local agent setup (Ollama, CLI, MCP)
- **[Connection Manager](./12-connection-manager.md)** - Agent connection lifecycle management
- **[MCP Tools](./02-mcp-tools.md)** - Model Context Protocol tool system
- **[Canvas System](./03-canvas-system.md)** - Rendering, state management, and interactions
- **[Command Bus](./04-command-bus.md)** - Document mutation system
- **[Tool Context Provider](./05-tool-context-provider.md)** - Bridge between AI and tools
- **[Batch Design Processor](./06-batch-design-processor.md)** - Atomic batch operations
- **[Storage & Database](./07-storage-database.md)** - Document persistence and storage system

### Platform Integration
- **[Tauri Backend](./10-tauri-backend.md)** - Native system integration (file I/O, processes, detection)
- **[Template System](./11-template-system.md)** - Design system templates and tokens

## Quick Start

### For Users

1. **Getting Started**: See [Quick Start Guide](./09-quick-start-guide.md)
2. **Setting Up Agents**: See [Local Agent Integration](./08-local-agent-integration.md)
3. **Using AI Chat**: See [Agent Integration](./01-agent-integration.md)

### For Developers

1. **Understanding the System**: Start with [Architecture Overview](./00-architecture-overview.md)
2. **Adding Features**: Read relevant module docs (Canvas, Command Bus, etc.)
3. **AI Integration**: See [Agent Integration](./01-agent-integration.md)
4. **Local Agents**: See [Local Agent Integration](./08-local-agent-integration.md)
5. **Tool Development**: See [MCP Tools](./02-mcp-tools.md)

### For AI Agents

1. **Available Tools**: See [MCP Tools](./02-mcp-tools.md) for tool list
2. **Batch Operations**: See [Batch Design Processor](./06-batch-design-processor.md) for syntax
3. **Context**: See [Tool Context Provider](./05-tool-context-provider.md) for available context
4. **Agent Setup**: See [Local Agent Integration](./08-local-agent-integration.md) for local agent details

## Key Concepts

### Command Pattern
All document mutations go through the Command Bus for consistency and undo/redo support.

### Tool Context
Tools receive a ToolContext providing document access, storage, and editor state.

### Transactions
Related operations can be grouped into transactions for atomic execution.

### Streaming
AI responses stream in real-time via Server-Sent Events (SSE).

## Module Relationships

```
Agent Integration
    ↓ uses
MCP Tools
    ↓ uses
Tool Context Provider
    ↓ uses
Command Bus
    ↓ updates
Canvas System
    ↓ renders
UI Components
```

## Common Workflows

### Creating a Design Element

1. User/AI sends request
2. Tool handler receives ToolContext
3. Tool uses Command Bus to create element
4. Document updates immutably
5. Canvas store updates
6. UI re-renders
7. Animation provides feedback

### AI Agent Modifying Design

1. User sends chat message
2. AI processes with system prompt
3. AI decides to use tool(s)
4. Tool executes via Command Bus
5. Document updates
6. Result returned to AI
7. AI responds with confirmation
8. Visual feedback via animations

### Batch Operations

1. AI generates operation string
2. Batch processor parses operations
3. Operations execute sequentially
4. All grouped in transaction
5. Single undo step for all
6. Result with created node IDs

## Contributing

When adding new features:

1. **Document the Module**: Create or update relevant doc file
2. **Update Architecture**: Update architecture overview if needed
3. **Add Examples**: Include usage examples
4. **Document Workflows**: Explain how it fits into existing workflows

## Questions?

- Check the relevant module documentation
- Review code examples in documentation
- See [Architecture Overview](./00-architecture-overview.md) for system-wide concepts
