# AI Settings Dialog Refactor

## Overview

Refactored the AI Assistant Settings dialog to eliminate duplicate tabs, properly organize agent types, and add default agent selection functionality.

## Changes Made

### 1. Removed Duplicate Content

**Before:**
- "Local Agents" tab: Empty placeholder with instructional text
- "Connections" tab: Showed ALL detected agents (Ollama, CLI, MCP)
- Confusing overlap between the two tabs

**After:**
- "Local LLMs" tab: Shows Ollama and other local LLM servers
- "CLI & MCP" tab: Shows CLI tools and MCP servers
- "Default Agent" tab: Select which agent is the default for AI Chat
- No more duplication or confusion

### 2. New Tab Structure

The AI Settings Dialog now has **4 tabs** organized by function:

```
┌─────────────────────────────────────────────────────┐
│  Cloud  │  Local LLMs  │  CLI & MCP  │  Default     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Tab Content...                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Tab 1: Cloud (unchanged)
- **Purpose:** Configure cloud AI providers (Anthropic, OpenAI, Google)
- **Features:**
  - Provider selection
  - Model selection (for Anthropic)
  - API key input
  - Save/Cancel buttons

#### Tab 2: Local LLMs (NEW - repurposed from "Connections")
- **Purpose:** Manage local LLM servers (Ollama, future: LM Studio, LocalAI)
- **Features:**
  - Auto-detection of Ollama
  - Shows available models
  - Connection testing
  - Disconnect capability
  - Refresh button

#### Tab 3: CLI & MCP (NEW - moved from "Local Agents")
- **Purpose:** Manage CLI tools and MCP servers
- **Features:**
  - Auto-detection of CLI tools (codex, geminicli, claudecode)
  - Auto-detection of MCP servers from config files
  - Connection status indicators
  - Test connection / Disconnect buttons
  - Refresh button

#### Tab 4: Default Agent (NEW)
- **Purpose:** Select which agent/model is the default for AI Chat
- **Features:**
  - Shows ALL available agents from all 3 sources (Cloud, Local LLMs, CLI/MCP)
  - Visual selection with icons (☁️ Cloud, 🦙 Ollama, ⚡ CLI, 🔌 MCP)
  - Displays availability status
  - Refresh agents button
  - Save default agent button
  - Confirmation message

### 3. New Components Created

#### `LocalAgentsSettings.tsx` (249 lines)
Manages CLI tools and MCP servers (extracted from ConnectionSettings).

**Features:**
- Detects CLI tools via Tauri `detectCLITools()`
- Detects MCP servers via Tauri `detectMCPServers()`
- Connection status tracking
- Test connection / Disconnect actions
- Refresh functionality

#### `LocalLLMSettings.tsx` (220 lines)
Manages local LLM servers (Ollama and future additions).

**Features:**
- Detects Ollama via Tauri `detectOllama()`
- Shows available models
- Connection status tracking
- Test connection / Disconnect actions
- Refresh functionality
- Link to download Ollama if not detected

#### `DefaultAgentSelector.tsx` (215 lines)
Allows selection of default agent from all available sources.

**Features:**
- Loads agents from all 3 sources (Cloud, Ollama, CLI/MCP)
- Visual cards with custom radio buttons
- Icons for each agent type:
  - ☁️ Cloud agents
  - 🦙 Ollama models
  - ⚡ CLI tools
  - 🔌 MCP servers
- Availability status indicators
- Saves selection to localStorage (`beak-default-agent`)
- Confirmation alert

### 4. Updated Components

#### `AISettingsDialog.tsx`
**Changes:**
- Imported 3 new components
- Changed tabs from 3 to 4
- Renamed tabs for clarity:
  - "Cloud/Remote" → "Cloud"
  - "Local Agents" → "CLI & MCP"
  - "Connections" → "Local LLMs"
  - Added "Default Agent"
- Replaced placeholder content in Local Agents tab
- Updated tab grid from `grid-cols-3` to `grid-cols-4`

#### `ConnectionSettings.tsx` (existing - kept for backward compatibility)
**Status:** Still exists but no longer used in AISettingsDialog
**Note:** Can be deprecated/removed in the future

### 5. Default Agent Selection Flow

```
User opens AI Settings
    ↓
Goes to "Default Agent" tab
    ↓
Sees all available agents:
    - Cloud agents (from saved configs)
    - Ollama models (from detection)
    - CLI tools (from detection)
    - MCP servers (from detection)
    ↓
Clicks on preferred agent card
    ↓
Clicks "Save Default Agent"
    ↓
Selection saved to localStorage as 'beak-default-agent'
    ↓
AI Chat now uses this agent by default
```

**Integration Points:**
- `getDefaultAgentId()` - Retrieves saved default
- `setDefaultAgentId(agentId)` - Saves default selection
- Used by `AgentSelector` component in Chat Panel
- Used when creating new conversations

## User Experience Improvements

### Before
1. ❌ Confusing duplicate tabs
2. ❌ "Local Agents" tab was empty
3. ❌ No way to set default agent in settings
4. ❌ Ollama mixed with CLI/MCP tools

### After
1. ✅ Clear, organized tabs by function
2. ✅ All tabs have meaningful content
3. ✅ Dedicated "Default Agent" tab
4. ✅ Logical separation: Local LLMs vs CLI/MCP

## Technical Details

### Tab Organization Logic

| Agent Type | Old Location | New Location | Reason |
|------------|--------------|--------------|---------|
| Cloud (Anthropic, OpenAI, Google) | Cloud/Remote | Cloud | Simplified name |
| Ollama | Connections | Local LLMs | Grouped with LLM servers |
| CLI Tools | Connections | CLI & MCP | Grouped with agent tools |
| MCP Servers | Connections | CLI & MCP | Grouped with agent tools |

### Default Agent Selection

**Storage:**
- Key: `beak-default-agent`
- Value: Agent ID (e.g., `cloud-anthropic`, `ollama-local:llama3.2`, `codex`)

**Agent ID Format:**
- Cloud: `cloud-{provider}` (e.g., `cloud-anthropic`)
- Ollama: `ollama-local:{model}` (e.g., `ollama-local:llama3.2`)
- CLI: Tool name (e.g., `codex`, `geminicli`)
- MCP: Server ID from config (e.g., `mcp-filesystem`)

**Selection Priority** (fallback if no default set):
1. Stored default agent ID
2. First enabled agent
3. First available agent

### File Structure

```
src/components/settings/
├── AISettingsDialog.tsx          ✅ UPDATED (4 tabs, new imports)
├── ConnectionSettings.tsx         ⚠️  DEPRECATED (kept for compatibility)
├── LocalAgentsSettings.tsx        ✅ NEW (CLI & MCP)
├── LocalLLMSettings.tsx          ✅ NEW (Ollama & local LLMs)
└── DefaultAgentSelector.tsx      ✅ NEW (Default agent selection)
```

## Migration Notes

### For Users
- No migration needed - all existing settings are preserved
- Default agent will be auto-selected based on first available agent
- Users can now explicitly set their preferred default agent

### For Developers
- `ConnectionSettings` component still exists but is no longer used
- Can be safely removed after verifying no other code imports it
- New components follow the same patterns as existing code
- All Tauri detection functions are reused

## Testing Checklist

### Cloud Agents Tab
- [ ] Can select provider (Anthropic, OpenAI, Google)
- [ ] Can input API key
- [ ] Can select model (for Anthropic)
- [ ] Save button works
- [ ] Settings persist after refresh

### Local LLMs Tab
- [ ] Ollama detected if running
- [ ] Shows available models
- [ ] Test connection works
- [ ] Disconnect works
- [ ] Refresh re-detects
- [ ] Shows "No LLMs detected" if Ollama not running
- [ ] Download Ollama link opens

### CLI & MCP Tab
- [ ] CLI tools detected (codex, geminicli, claudecode)
- [ ] MCP servers detected from config files
- [ ] Connection status indicators work
- [ ] Test connection works
- [ ] Disconnect works
- [ ] Refresh re-detects
- [ ] Shows "No agents detected" if none found

### Default Agent Tab
- [ ] Shows all cloud agents
- [ ] Shows all Ollama models (if detected)
- [ ] Shows all CLI tools (if detected)
- [ ] Shows all MCP servers (if detected)
- [ ] Can select an agent (visual feedback)
- [ ] Save button enabled only when agent selected
- [ ] Saves to localStorage
- [ ] Refresh agents button works
- [ ] Confirmation message shows selected agent
- [ ] Unavailable agents are disabled/grayed out

### Integration
- [ ] AI Chat uses default agent on startup
- [ ] AgentSelector shows correct default
- [ ] Default agent persists across sessions
- [ ] Switching default works immediately

## Known Issues / Future Enhancements

### Known Issues
- None currently

### Future Enhancements
1. **Auto-detect more local LLM servers**
   - LM Studio
   - LocalAI
   - text-generation-webui

2. **Per-conversation default override**
   - Allow setting different defaults for different contexts

3. **Agent groups/favorites**
   - Star frequently used agents
   - Create agent presets

4. **Connection health monitoring**
   - Auto-reconnect on connection loss
   - Health check indicators

5. **Deprecate ConnectionSettings**
   - Remove after migration period
   - Update any legacy references

## Summary

This refactor eliminates confusion, provides better organization, and adds highly requested functionality (default agent selection). The new structure is more intuitive and scalable for future agent types.

**Impact:**
- ✅ Better UX - Clear, logical organization
- ✅ New Feature - Default agent selection
- ✅ No Breaking Changes - All existing functionality preserved
- ✅ Extensible - Easy to add new agent types
- ✅ Clean Code - Separated concerns, reusable components
