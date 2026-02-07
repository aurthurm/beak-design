# Quick Start Guide

## Getting Started with AI Agents

This guide helps you get started with AI-powered design assistance in Beak Design.

## Prerequisites

- Beak Design application installed
- At least one AI agent available (cloud or local)

## Option 1: Using Cloud Agent (Anthropic Claude)

### Setup

1. **Get API Key**
   - Sign up at [Anthropic Console](https://console.anthropic.com)
   - Create an API key
   - Copy the API key

2. **Configure Environment**
   - Create `.env` file in project root
   - Add: `ANTHROPIC_API_KEY=your_api_key_here`
   - Restart the application

3. **Start Chatting**
   - Open Chat Panel
   - Cloud agent is automatically selected
   - Choose model (Haiku/Sonnet/Opus)
   - Start designing!

### Usage Example

```
You: Create a red button in the center
AI: I'll create a red button for you...
[Tool: batch_design] Creating button...
✓ Button created
AI: I've created a red button in the center of your canvas.
```

## Option 2: Using Local Ollama Agent

### Setup

1. **Install Ollama**
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Or download from https://ollama.com
   ```

2. **Start Ollama Server**
   ```bash
   ollama serve
   ```

3. **Install a Model**
   ```bash
   ollama pull llama3.2
   # Or: ollama pull gemma
   # Or: ollama pull mistral
   ```

4. **Verify Installation**
   ```bash
   curl http://localhost:11434/api/tags
   # Should return list of installed models
   ```

5. **Use in Beak Design**
   - Open Chat Panel
   - Ollama agent should auto-detect
   - Select Ollama from agent dropdown
   - Choose model from model dropdown
   - Start chatting!

### Usage Example

```
You: Create a blue card with title and description
AI: I'll create a card component for you...
[Tool: batch_design] Creating card...
✓ Card created
AI: Created a blue card with title and description fields.
```

## Option 3: Using CLI Tools

### Setup

1. **Install CLI Tool**
   ```bash
   # Example: Install codex
   npm install -g @anthropic-ai/codex-cli
   # Or install geminicli, claudecode, etc.
   ```

2. **Verify Installation**
   ```bash
   which codex
   codex --version
   ```

3. **Configure in Beak Design**
   - Open Chat Panel
   - Click settings icon (⚙️)
   - Click "Add Agent"
   - Select type: "CLI Tool"
   - Enter command: `codex`
   - Add arguments if needed: `["--format", "json"]`
   - Save

4. **Use Agent**
   - Select CLI agent from dropdown
   - Start chatting

**Note**: CLI tools work best in Tauri (desktop) mode, not browser mode.

## Option 4: Using MCP Servers

### Setup

1. **Install MCP Server**
   - Follow MCP server installation instructions
   - Ensure server is running

2. **Create MCP Config**
   ```json
   // ~/.config/mcp/servers.json
   {
     "my-mcp-server": {
       "command": "node",
       "args": ["/path/to/mcp-server.js"],
       "env": {}
     }
   }
   ```

3. **Use in Beak Design**
   - MCP server should auto-detect
   - Select from agent dropdown
   - Start using!

## Common Workflows

### Creating Design Elements

1. Open Chat Panel
2. Select agent
3. Type: "Create a [element type] with [properties]"
4. AI creates element using tools
5. Element appears on canvas with animation

### Modifying Existing Elements

1. Select element(s) on canvas
2. Type: "Make selected [property] [value]"
3. AI updates element(s)
4. Changes animate on canvas

### Complex Designs

1. Describe your design: "Create a dashboard with header, sidebar, and main content"
2. AI uses batch_design to create multiple elements
3. All elements created in single transaction
4. One undo step for entire operation

## Agent Selection Tips

### When to Use Cloud Agent
- ✅ Best performance and reliability
- ✅ Full tool calling support
- ✅ Production work
- ✅ Need latest models

### When to Use Ollama
- ✅ Privacy concerns (data stays local)
- ✅ No API costs
- ✅ Development/testing
- ✅ Offline work

### When to Use CLI Tools
- ✅ Simple text generation
- ✅ Custom tool integration
- ✅ Scripting workflows

### When to Use MCP Servers
- ✅ Custom integrations
- ✅ Enterprise setups
- ✅ Advanced tool calling

## Troubleshooting

### Agent Not Appearing

**Cloud Agent**:
- Check `.env` file exists
- Verify `ANTHROPIC_API_KEY` is set
- Restart application

**Ollama**:
- Run `ollama serve` in terminal
- Check `http://localhost:11434/api/tags`
- Verify port 11434 is not blocked

**CLI Tools**:
- Verify tool is in PATH: `which codex`
- Check tool is executable
- Note: Only works in Tauri mode

**MCP Servers**:
- Check config file exists
- Verify JSON is valid
- Ensure server is running

### Agent Not Responding

1. Check agent status (green = available, red = unavailable)
2. Verify agent is running/accessible
3. Check browser console for errors
4. Try different agent
5. Review agent logs

### Tools Not Working

1. Verify document is loaded
2. Check agent supports tool calling
3. Review tool execution errors in chat
4. Try simpler request first

## Next Steps

- Read [Agent Integration](./01-agent-integration.md) for detailed system docs
- Read [Local Agent Integration](./08-local-agent-integration.md) for local agent details
- Read [MCP Tools](./02-mcp-tools.md) to understand available tools
- Experiment with different agents and models
