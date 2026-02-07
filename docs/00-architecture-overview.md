# Architecture Overview

## System Architecture

Beak Design is a canvas-based design tool built with React, TanStack Router, Konva.js, and Tauri. The application follows a modular architecture with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface Layer                     │
│  (React Components, Chat Panel, Canvas Viewport, etc.)      │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    State Management Layer                     │
│  (TanStack Store, Canvas Store, Conversation State)          │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    Business Logic Layer                       │
│  (Command Bus, MCP Tools, AI Agents, Animations)             │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                      Data Layer                               │
│  (LowDB Storage, Document Schema, File System)                │
└───────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. **Canvas System** (`src/lib/canvas/`)
- Konva.js-based rendering engine
- Document model (pages, frames, layers)
- Selection and transformation system
- Viewport management (pan, zoom)
- Undo/redo functionality

### 2. **AI Agent System** (`src/lib/ai/`)
- TanStack AI integration with multiple backends
- Cloud agent: Anthropic Claude (Haiku, Sonnet, Opus)
- Local agents: Ollama, CLI tools (codex, geminicli, claudecode), MCP servers
- Connection manager for lifecycle and status tracking
- Agent detection and configuration system
- Agent adapters for unified interface (Cloud, Ollama, CLI, MCP stdio/HTTP)
- MCP tool adapters for AI tool calling
- Tool context provider bridging AI and MCP
- Command bus for state mutations
- Transaction manager for undo/redo grouping

### 3. **MCP Tools** (`mcp-tools.ts`, `src/lib/mcp/`)
- Model Context Protocol tool definitions
- Batch design operations processor
- Design node search and manipulation
- Export and import functionality

### 4. **Chat System** (`src/components/chat/`, `src/hooks/useChat.ts`)
- Real-time AI chat interface
- Server-Sent Events (SSE) streaming
- Tool use visualization
- Conversation management

### 5. **Storage System** (`src/lib/db/`)
- LowDB-based document storage
- Browser localStorage persistence
- Server-side file system access (Tauri)

### 6. **Tauri Backend** (`src-tauri/`)
- Rust-based native system integration
- File I/O operations (async with Tokio)
- Process spawning and management (MCP servers, CLI tools)
- Agent detection (Ollama HTTP probe, CLI PATH scan, MCP config parsing)
- Dialog services (file picker, save dialog)
- HTTP client for Ollama communication

### 7. **Template System** (`src/lib/templates/`)
- Pre-configured design system templates
- Built-in templates: Blank, Shadcn UI, Lunaris, Halo, Nitro
- Token/variable definitions (color, typography, spacing)
- Sample component frames
- LocalStorage caching for custom templates

## Data Flow

### Document Editing Flow
```
User Action → Canvas Handler → Command Bus → Document Mutation → Canvas Store Update → Re-render
```

### AI Agent Flow
```
User Message → useChat Hook → AgentSelector → API Route (/api/ai/chat) 
    ↓
Agent Adapter (Cloud/Local) → TanStack AI/Ollama/CLI/MCP → MCP Tools 
    ↓
Command Bus → Document Update → Animation Feedback
```

### Tool Execution Flow
```
AI Tool Call → MCP Tool Adapter → Tool Registry → Tool Handler → Command Bus → Document Mutation → Result Return → AI Response
```

## Key Design Patterns

### 1. **Command Pattern**
All document mutations go through the Command Bus, ensuring:
- Consistent state management
- Undo/redo support
- Transaction grouping
- Audit trail

### 2. **Adapter Pattern**
MCP tools are adapted to TanStack AI format, allowing:
- Seamless integration between AI and design tools
- Type-safe tool definitions
- Consistent error handling

### 3. **Provider Pattern**
Tool Context Provider bridges:
- AI system and MCP tools
- Client-side and server-side execution
- Canvas store and document storage

### 4. **Observer Pattern**
Canvas store uses TanStack Store for:
- Reactive state updates
- Component re-rendering
- State synchronization

## Technology Stack

- **Frontend Framework**: React 19 with TanStack Router
- **Canvas Rendering**: Konva.js
- **State Management**: TanStack Store
- **AI Integration**: TanStack AI + Anthropic Claude
- **Storage**: LowDB + localStorage
- **Desktop**: Tauri (Rust + WebView)
- **Build Tool**: Vite
- **Type Safety**: TypeScript

## File Structure

```
beak-design/
├── src/
│   ├── components/          # React UI components
│   ├── hooks/              # React hooks
│   ├── lib/
│   │   ├── ai/             # AI agent system
│   │   │   ├── agent-adapters/  # Cloud, Ollama, CLI, MCP
│   │   │   ├── connection-manager.ts
│   │   │   ├── command-bus.ts
│   │   │   └── tool-context-provider.ts
│   │   ├── canvas/         # Canvas rendering & state
│   │   ├── db/             # Database & storage
│   │   ├── mcp/            # MCP tool processors
│   │   ├── export/         # Export functionality
│   │   ├── templates/      # Template system
│   │   │   └── content/    # Template content files
│   │   └── tauri.ts        # Tauri command wrappers
│   ├── routes/             # TanStack Router routes
│   └── utils/              # Utility functions
├── src-tauri/              # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs         # Command registration
│   │   ├── ollama.rs       # Ollama detection
│   │   └── process_manager.rs  # Process management
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── mcp-tools.ts            # MCP tool definitions
├── schema.ts               # Document schema
└── docs/                   # Documentation
```

## Next Steps

- Read [Agent Integration](./01-agent-integration.md) for AI chat system details
- Read [Connection Manager](./12-connection-manager.md) for agent connection management
- Read [Tauri Backend](./10-tauri-backend.md) for native system integration
- Read [Template System](./11-template-system.md) for design system templates
- Read [Local Agent Integration](./08-local-agent-integration.md) for local agent setup
- Read [MCP Tools](./02-mcp-tools.md) for tool system documentation
- Read [Canvas System](./03-canvas-system.md) for rendering and state management
- Read [Command Bus](./04-command-bus.md) for mutation system details
