/**
 * Agent Detection System
 * Detects available local AI agents (Ollama, CLI tools, MCP servers)
 */

export interface AgentInfo {
  id: string
  name: string
  type: 'cloud' | 'ollama' | 'cli' | 'mcp'
  status: 'available' | 'unavailable' | 'unknown'
  endpoint?: string
  command?: string
  args?: string[]
  metadata?: {
    model?: string
    version?: string
    models?: string[]
    [key: string]: any
  }
}

/**
 * Detect Ollama server running locally
 */
export async function detectOllama(): Promise<AgentInfo | null> {
  // Try Tauri command first
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { detectOllama: detectOllamaTauri } = await import('@/lib/tauri')
      const result = await detectOllamaTauri()

      if (result.available) {
        return {
          id: 'ollama-local',
          name: 'Ollama (Local)',
          type: 'ollama',
          status: 'available',
          endpoint: 'http://localhost:11434',
          metadata: {
            models: result.models.map((m) => m.name),
          },
        }
      }
      return null
    } catch (error) {
      console.warn('[Agent Detector] Tauri Ollama detection failed:', error)
    }
  }

  // Fall back to direct fetch
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const models = data.models?.map((m: any) => m.name) || []

    return {
      id: 'ollama-local',
      name: 'Ollama (Local)',
      type: 'ollama',
      status: 'available',
      endpoint: 'http://localhost:11434',
      metadata: {
        models,
        version: data.version || 'unknown',
      },
    }
  } catch (error) {
    // Ollama not running or not accessible
    return null
  }
}

/**
 * Detect CLI tools in PATH
 * Uses Tauri command when available, falls back to Node.js child_process on server-side
 */
export async function detectCLITools(): Promise<AgentInfo[]> {
  const tools: AgentInfo[] = []

  // Try Tauri command first (works in browser when running Tauri app)
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const detected = await invoke<Array<{
        id: string
        name: string
        type: string
        status: string
        command: string
        metadata?: {
          version?: string
        }
      }>>('detect_cli_tools')

      return detected.map((tool) => ({
        id: tool.id,
        name: tool.name,
        type: tool.type as 'cli',
        status: tool.status as 'available',
        command: tool.command,
        metadata: tool.metadata,
      }))
    } catch (error) {
      console.warn('[Agent Detector] Tauri CLI detection failed:', error)
      // Fall through to server-side detection
    }
  }

  // Server-side detection (Node.js)
  if (typeof window === 'undefined') {
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      const cliTools = ['codex', 'geminicli', 'claudecode']

      for (const toolName of cliTools) {
        try {
          // Check if tool exists in PATH
          const { stdout } = await execAsync(`which ${toolName}`, {
            timeout: 1000,
          })
          const commandPath = stdout.trim()

          if (commandPath) {
            // Try to get version
            let version = 'unknown'
            try {
              const { stdout: versionOutput } = await execAsync(
                `${toolName} --version`,
                { timeout: 1000 }
              )
              version = versionOutput.trim()
            } catch {
              // Version check failed, continue anyway
            }

            tools.push({
              id: `cli-${toolName}`,
              name: `${toolName} (CLI)`,
              type: 'cli',
              status: 'available',
              command: commandPath,
              metadata: {
                version,
              },
            })
          }
        } catch {
          // Tool not found, skip
        }
      }
    } catch (error) {
      // Detection failed (might be browser environment)
      console.warn('[Agent Detector] Server-side CLI detection failed:', error)
    }
  }

  return tools
}

/**
 * Detect MCP servers
 * Uses Tauri command when available, falls back to Node.js fs on server-side
 */
export async function detectMCPServers(): Promise<AgentInfo[]> {
  const servers: AgentInfo[] = []

  // Try Tauri command first (works in browser when running Tauri app)
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const detected = await invoke<Array<{
        id: string
        name: string
        type: string
        status: string
        endpoint?: string
        command?: string
        args?: string[]
        metadata?: {
          version?: string
        }
      }>>('detect_mcp_servers')

      return detected.map((server) => ({
        id: server.id,
        name: server.name,
        type: server.type as 'mcp',
        status: server.status as 'available',
        endpoint: server.endpoint,
        command: server.command,
        args: server.args,
        metadata: server.metadata,
      }))
    } catch (error) {
      console.warn('[Agent Detector] Tauri MCP detection failed:', error)
      // Fall through to server-side detection
    }
  }

  // Server-side detection (Node.js)
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')

      // Common MCP server config locations
      const configPaths = [
        path.join(os.homedir(), '.config', 'mcp', 'servers.json'),
        path.join(os.homedir(), '.mcp', 'servers.json'),
        path.join(process.cwd(), '.mcp', 'servers.json'),
      ]

      for (const configPath of configPaths) {
        try {
          if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf-8')
            const config = JSON.parse(configContent)

            // Parse MCP server configs
            if (typeof config === 'object') {
              for (const [serverId, serverConfig] of Object.entries(config)) {
                const configObj = serverConfig as any
                if (configObj && typeof configObj === 'object') {
                  servers.push({
                    id: `mcp-${serverId}`,
                    name: `${serverId} (MCP)`,
                    type: 'mcp',
                    status: 'available',
                    endpoint: configObj.endpoint,
                    command: configObj.command,
                    args: configObj.args,
                    metadata: {
                      version: configObj.version,
                    },
                  })
                }
              }
            }
          }
        } catch {
          // Config file doesn't exist or invalid, skip
        }
      }
    } catch (error) {
      console.warn('[Agent Detector] Server-side MCP detection failed:', error)
    }
  }

  return servers
}

/**
 * Detect all available agents
 */
export async function detectAllAgents(): Promise<AgentInfo[]> {
  const agents: AgentInfo[] = []

  // Add cloud agent if API key is available
  if (typeof window === 'undefined') {
    // Server-side: check env
    const env = await import('@/env')
    if (env.env.ANTHROPIC_API_KEY) {
      agents.push({
        id: 'cloud-anthropic',
        name: 'Claude (Cloud)',
        type: 'cloud',
        status: 'available',
        metadata: {
          provider: 'anthropic',
        },
      })
    }
  } else {
    // Client-side: assume available if we're using it
    agents.push({
      id: 'cloud-anthropic',
      name: 'Claude (Cloud)',
      type: 'cloud',
      status: 'available',
      metadata: {
        provider: 'anthropic',
      },
    })
  }

  // Detect Ollama
  const ollama = await detectOllama()
  if (ollama) {
    agents.push(ollama)
  }

  // Detect CLI tools
  const cliTools = await detectCLITools()
  agents.push(...cliTools)

  // Detect MCP servers
  const mcpServers = await detectMCPServers()
  agents.push(...mcpServers)

  return agents
}

/**
 * Check if a specific agent is available
 */
export async function checkAgentAvailability(
  agentId: string
): Promise<boolean> {
  const agents = await detectAllAgents()
  const agent = agents.find((a) => a.id === agentId)
  return agent?.status === 'available' || false
}
