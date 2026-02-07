/**
 * Example: Using MCP Server commands from Tauri frontend
 *
 * This example demonstrates how to:
 * 1. Detect Ollama availability
 * 2. Spawn an MCP server
 * 3. Initialize the server
 * 4. Exchange JSON-RPC messages
 * 5. Clean up resources
 */

import { invoke } from '@tauri-apps/api/core';

// Type definitions
interface OllamaDetectionResult {
  available: boolean;
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
  }>;
  error?: string;
}

interface ProcessInfo {
  connection_id: string;
  process_type: 'mcp' | 'cli';
  command: string;
  args: string[];
}

// Example 1: Detect Ollama
async function detectOllama() {
  const result = await invoke<OllamaDetectionResult>('detect_ollama');

  if (result.available) {
    console.log('Ollama is available!');
    console.log('Models:', result.models.map(m => m.name));
  } else {
    console.log('Ollama is not available:', result.error);
  }

  return result;
}

// Example 2: Spawn and communicate with MCP server
async function useMcpServer() {
  let connectionId: string | null = null;

  try {
    // Spawn the server
    connectionId = await invoke<string>('spawn_mcp_server', {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory']
    });

    console.log('Spawned MCP server with ID:', connectionId);

    // Initialize the server
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true
          }
        },
        clientInfo: {
          name: 'beak-design',
          version: '0.1.0'
        }
      }
    };

    await invoke('send_mcp_message', {
      connectionId,
      message: JSON.stringify(initRequest)
    });

    // Read initialization response
    const initResponse = await invoke<string>('read_mcp_response', {
      connectionId
    });

    console.log('Initialization response:', JSON.parse(initResponse));

    // Send initialized notification
    const initializedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };

    await invoke('send_mcp_message', {
      connectionId,
      message: JSON.stringify(initializedNotification)
    });

    // List available tools
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };

    await invoke('send_mcp_message', {
      connectionId,
      message: JSON.stringify(listToolsRequest)
    });

    const toolsResponse = await invoke<string>('read_mcp_response', {
      connectionId
    });

    console.log('Available tools:', JSON.parse(toolsResponse));

    // Call a tool
    const callToolRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'store_memory',
        arguments: {
          key: 'example-key',
          value: 'example-value'
        }
      }
    };

    await invoke('send_mcp_message', {
      connectionId,
      message: JSON.stringify(callToolRequest)
    });

    const callResponse = await invoke<string>('read_mcp_response', {
      connectionId
    });

    console.log('Tool call response:', JSON.parse(callResponse));

  } catch (error) {
    console.error('Error using MCP server:', error);
  } finally {
    // Always clean up
    if (connectionId) {
      await invoke('kill_process', { connectionId });
      console.log('Cleaned up MCP server');
    }
  }
}

// Example 3: Spawn CLI agent
async function useCliAgent() {
  let connectionId: string | null = null;

  try {
    // Spawn claudecode CLI
    connectionId = await invoke<string>('spawn_cli_agent', {
      tool: 'claudecode',
      args: ['--version']
    });

    console.log('Spawned CLI agent with ID:', connectionId);

    // Read version output
    const output = await invoke<string>('read_mcp_response', {
      connectionId
    });

    console.log('CLI output:', output);

  } catch (error) {
    console.error('Error using CLI agent:', error);
  } finally {
    if (connectionId) {
      await invoke('kill_process', { connectionId });
    }
  }
}

// Example 4: List all active processes
async function listAllProcesses() {
  const processes = await invoke<ProcessInfo[]>('list_processes');

  console.log('Active processes:');
  processes.forEach(p => {
    console.log(`  [${p.process_type}] ${p.command} ${p.args.join(' ')}`);
    console.log(`    Connection ID: ${p.connection_id}`);
  });

  return processes;
}

// Example 5: MCP Server wrapper class
class McpServerConnection {
  private connectionId: string | null = null;
  private requestId = 0;

  async spawn(command: string, args: string[]) {
    this.connectionId = await invoke<string>('spawn_mcp_server', {
      command,
      args
    });

    // Initialize
    const initResponse = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'beak-design', version: '0.1.0' }
    });

    // Send initialized notification
    await this.sendNotification('notifications/initialized');

    return initResponse;
  }

  async sendRequest(method: string, params: any = {}) {
    if (!this.connectionId) {
      throw new Error('Not connected');
    }

    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };

    await invoke('send_mcp_message', {
      connectionId: this.connectionId,
      message: JSON.stringify(request)
    });

    const response = await invoke<string>('read_mcp_response', {
      connectionId: this.connectionId
    });

    return JSON.parse(response);
  }

  async sendNotification(method: string, params: any = {}) {
    if (!this.connectionId) {
      throw new Error('Not connected');
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };

    await invoke('send_mcp_message', {
      connectionId: this.connectionId,
      message: JSON.stringify(notification)
    });
  }

  async listTools() {
    return this.sendRequest('tools/list');
  }

  async callTool(name: string, args: any) {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  async listResources() {
    return this.sendRequest('resources/list');
  }

  async readResource(uri: string) {
    return this.sendRequest('resources/read', { uri });
  }

  async listPrompts() {
    return this.sendRequest('prompts/list');
  }

  async getPrompt(name: string, args: any = {}) {
    return this.sendRequest('prompts/get', { name, arguments: args });
  }

  async close() {
    if (this.connectionId) {
      await invoke('kill_process', { connectionId: this.connectionId });
      this.connectionId = null;
    }
  }
}

// Example 6: Using the wrapper class
async function useWrappedMcpServer() {
  const server = new McpServerConnection();

  try {
    // Connect to filesystem server
    await server.spawn('npx', [
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/path/to/directory'
    ]);

    // List available tools
    const { result } = await server.listTools();
    console.log('Available tools:', result.tools);

    // List resources
    const { result: resources } = await server.listResources();
    console.log('Available resources:', resources.resources);

    // Read a file
    if (resources.resources.length > 0) {
      const fileUri = resources.resources[0].uri;
      const content = await server.readResource(fileUri);
      console.log('File content:', content);
    }

  } finally {
    await server.close();
  }
}

// Export for use in application
export {
  detectOllama,
  useMcpServer,
  useCliAgent,
  listAllProcesses,
  McpServerConnection,
  useWrappedMcpServer
};
