# MCP Server Configuration Examples

This document provides example configurations for popular MCP servers that can be used with Beak Design.

## Configuration File Location

MCP servers are configured in JSON files at these locations (checked in order):

1. `~/.config/mcp/servers.json`
2. `~/.mcp/servers.json`
3. `./.mcp/servers.json` (project-local)

## Configuration Format

```json
{
  "server-id": {
    "command": "executable-or-script",
    "args": ["arg1", "arg2"],
    "endpoint": "http://localhost:port" // Optional, for HTTP servers
  }
}
```

## Example Configurations

### 1. Filesystem Server

Access local filesystem via MCP:

```json
{
  "filesystem": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/path/to/workspace"
    ]
  }
}
```

**Usage:**
- Allows AI to read/write files in the specified directory
- Replace `/path/to/workspace` with your actual workspace path
- On Windows: Use `"C:\\Users\\YourName\\Documents\\workspace"`

### 2. GitHub Server

Access GitHub repositories:

```json
{
  "github": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-github"
    ],
    "env": {
      "GITHUB_TOKEN": "your-github-token"
    }
  }
}
```

**Setup:**
1. Get a GitHub personal access token from https://github.com/settings/tokens
2. Replace `your-github-token` with your actual token
3. Grant appropriate permissions (repo, read:org, etc.)

### 3. PostgreSQL Server

Access PostgreSQL databases:

```json
{
  "postgres": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-postgres"
    ],
    "env": {
      "POSTGRES_URL": "postgresql://user:password@localhost:5432/database"
    }
  }
}
```

**Setup:**
- Replace connection string with your database credentials
- Ensure PostgreSQL is running and accessible

### 4. Brave Search Server

Web search via Brave Search API:

```json
{
  "brave-search": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-brave-search"
    ],
    "env": {
      "BRAVE_API_KEY": "your-brave-api-key"
    }
  }
}
```

**Setup:**
1. Get API key from https://brave.com/search/api/
2. Replace `your-brave-api-key` with your actual key

### 5. Puppeteer Server

Browser automation and web scraping:

```json
{
  "puppeteer": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-puppeteer"
    ]
  }
}
```

**Usage:**
- Allows AI to control a headless browser
- Can scrape websites, take screenshots, interact with pages

### 6. SQLite Server

Access SQLite databases:

```json
{
  "sqlite": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-sqlite",
      "/path/to/database.db"
    ]
  }
}
```

**Usage:**
- Replace `/path/to/database.db` with your database path
- Read-only mode by default

### 7. HTTP MCP Server

For MCP servers running as HTTP services:

```json
{
  "http-server": {
    "endpoint": "http://localhost:3000"
  }
}
```

**Usage:**
- No stdio communication, uses HTTP transport
- Useful for remote MCP servers or servers written in other languages

## Custom MCP Server

You can create your own MCP server. Here's a minimal example:

### Node.js MCP Server

**server.js:**
```javascript
#!/usr/bin/env node
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
})

rl.on('line', (line) => {
  try {
    const request = JSON.parse(line)

    const response = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content: `Echo: ${JSON.stringify(request.params)}`
      }
    }

    console.log(JSON.stringify(response))
  } catch (error) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error'
      }
    }))
  }
})
```

**Configuration:**
```json
{
  "custom-echo": {
    "command": "node",
    "args": ["/path/to/server.js"]
  }
}
```

### Python MCP Server

**server.py:**
```python
#!/usr/bin/env python3
import sys
import json

def main():
    for line in sys.stdin:
        try:
            request = json.loads(line)
            response = {
                "jsonrpc": "2.0",
                "id": request["id"],
                "result": {
                    "content": f"Echo: {request.get('params', {})}"
                }
            }
            print(json.dumps(response), flush=True)
        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": str(e)
                }
            }
            print(json.dumps(error_response), flush=True)

if __name__ == "__main__":
    main()
```

**Configuration:**
```json
{
  "custom-python": {
    "command": "python3",
    "args": ["/path/to/server.py"]
  }
}
```

## Complete Example Configuration

Here's a complete `~/.config/mcp/servers.json` with multiple servers:

```json
{
  "filesystem-workspace": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/home/user/workspace"
    ]
  },
  "filesystem-documents": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/home/user/Documents"
    ]
  },
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx"
    }
  },
  "brave-search": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-brave-search"],
    "env": {
      "BRAVE_API_KEY": "BSAxxxxxxxxxxxxxxxxxxxx"
    }
  },
  "puppeteer": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
  },
  "remote-server": {
    "endpoint": "http://localhost:8080"
  }
}
```

## Environment Variables

Some MCP servers require environment variables. You can set them in the configuration:

```json
{
  "server-with-env": {
    "command": "node",
    "args": ["server.js"],
    "env": {
      "API_KEY": "your-key",
      "DEBUG": "true",
      "PORT": "3000"
    }
  }
}
```

## Testing Your Configuration

1. **Save your configuration** to one of the supported locations
2. **Open Beak Design** (Tauri version)
3. **Go to Settings** → AI Assistant Settings → Connections tab
4. **Click "Refresh"** to detect MCP servers
5. **Click "Test Connection"** to verify the server works

## Troubleshooting

### Server not detected
- Check the JSON syntax (use a JSON validator)
- Verify file is in the correct location
- Check file permissions (should be readable)

### Connection fails
- Verify the command is in PATH (e.g., `npx`, `node`, `python3`)
- Check command and args are correct
- Look for error messages in the connection status
- Test the command manually in terminal

### Server crashes
- Check if required dependencies are installed
- Verify environment variables are set correctly
- Look at stderr output (if available)

### Permission errors
- Filesystem server: Check directory permissions
- Database servers: Verify connection credentials
- API servers: Confirm API keys are valid

## Popular MCP Server Packages

These are maintained by the MCP community:

- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-postgres` - PostgreSQL
- `@modelcontextprotocol/server-sqlite` - SQLite
- `@modelcontextprotocol/server-puppeteer` - Browser automation
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-everything` - Multi-purpose server

Install via npm:
```bash
npm install -g @modelcontextprotocol/server-filesystem
```

Or use with npx (no installation required):
```json
{
  "server": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
  }
}
```

## Security Best Practices

1. **Limit filesystem access** - Only grant access to necessary directories
2. **Use read-only mode** when possible
3. **Protect API keys** - Don't commit config files with keys to git
4. **Use environment variables** for sensitive data
5. **Restrict database permissions** - Use accounts with minimal required access
6. **Review server code** before running untrusted MCP servers

## Resources

- MCP Specification: https://github.com/anthropics/mcp
- MCP Server SDK: https://github.com/anthropics/mcp-sdk
- Community Servers: https://github.com/topics/mcp-server
- MCP Inspector: Tool for debugging MCP servers
