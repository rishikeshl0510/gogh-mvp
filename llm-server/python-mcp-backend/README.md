# Electron MCP Backend

Local AI agent backend using mcp-agent with Ollama for Electron applications.

## Features

- **Local AI Agent**: Uses Ollama for 100% local, private AI processing
- **MCP Integration**: Connects to Model Context Protocol servers for tool calling
- **FastAPI Server**: RESTful API for easy integration with Electron
- **Agentic Workflows**: Autonomous task execution with tool usage
- **Multi-tool Support**: Filesystem operations, web fetching, and extensible

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Electron App                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │         MCPSettings.jsx (Frontend)               │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │ IPC                                │
│  ┌──────────────────▼───────────────────────────────┐   │
│  │         main.js (IPC Handlers)                   │   │
│  └──────────────────┬───────────────────────────────┘   │
└────────────────────┬┼──────────────────────────────────┘
                     ││ HTTP (localhost:8000)
         ┌───────────┘└────────────┐
         │                          │
┌────────▼──────────┐      ┌───────▼────────┐
│  Node.js MCP      │      │ Python MCP     │
│  SDK              │      │ Backend        │
│  (Direct)         │      │ (via FastAPI)  │
└────────┬──────────┘      └───────┬────────┘
         │                          │
         └───────────┬──────────────┘
                     │
         ┌───────────▼────────────┐
         │   MCP Servers          │
         │  - filesystem          │
         │  - fetch               │
         │  - custom servers      │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │   Ollama (Local LLM)   │
         │  - llama3.2:1b        │
         │  - llama3.2:1b         │
         │  - phi3:mini           │
         └────────────────────────┘
```

## Prerequisites

### 1. Install Python (3.10 or higher)
```bash
# Check Python version
python --version  # Should be 3.10+
```

### 2. Install Ollama
- **Windows**: Download from https://ollama.com
- **macOS/Linux**: `curl -fsSL https://ollama.com/install.sh | sh`

### 3. Pull Ollama Models
```bash
# Recommended lightweight model (500MB, fast)
ollama pull llama3.2:1b

# Alternative models
ollama pull llama3.2:1b      # 1.3GB, better quality
ollama pull phi3:mini        # 2.3GB, best quality
ollama pull mistral          # 4.1GB, production quality
```

### 4. Install Node.js (for MCP servers)
- Download from https://nodejs.org (LTS version recommended)

## Installation

### Step 1: Navigate to Backend Directory
```bash
cd llm-server/python-mcp-backend
```

### Step 2: Create Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Python Dependencies
```bash
# Option 1: Using pip
pip install -r requirements.txt

# Option 2: Using uv (faster)
pip install uv
uv pip install -r requirements.txt
```

### Step 4: Install MCP Servers
```bash
# Install filesystem server (for file operations)
npm install -g @modelcontextprotocol/server-filesystem

# uvx will auto-install fetch server when needed
```

### Step 5: Configure Settings
Edit [mcp_agent.config.yaml](mcp_agent.config.yaml) and update the filesystem path:
```yaml
mcp:
  servers:
    filesystem:
      args:
        [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "C:/Users/YourUsername",  # <-- Update this path
        ]
```

## Running the Server

### Development Mode (with auto-reload)
```bash
python agent_server.py
```

### Production Mode (using uvicorn)
```bash
uvicorn agent_server:app --host 127.0.0.1 --port 8000
```

The server will start on `http://localhost:8000`

### Verify Server is Running
```bash
# Check health
curl http://localhost:8000/health

# Get available tools
curl http://localhost:8000/tools
```

## API Endpoints

### GET `/`
Status check
```bash
curl http://localhost:8000/
```
Response:
```json
{
  "status": "running",
  "service": "MCP Agent Backend"
}
```

### GET `/health`
Health check
```bash
curl http://localhost:8000/health
```
Response:
```json
{
  "status": "healthy"
}
```

### GET `/tools`
List available MCP tools
```bash
curl http://localhost:8000/tools
```
Response:
```json
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read contents of a file",
      "serverName": "filesystem"
    },
    {
      "name": "fetch",
      "description": "Fetch content from a URL",
      "serverName": "fetch"
    }
  ]
}
```

### POST `/chat`
Send message to agent and get response
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Read the README.md file in the current directory",
    "model": "llama3.2:1b"
  }'
```
Response:
```json
{
  "response": "Here's the content of README.md...",
  "model_used": "llama3.2:1b"
}
```

## Integration with Electron

The Python MCP backend is integrated with your Electron app through IPC handlers in [main.js](../../electron/main.js):

### From Renderer Process (Frontend)
```javascript
// Check backend health
const health = await window.panelAPI.invoke('python-mcp-health');

// Send chat message
const result = await window.panelAPI.invoke('python-mcp-chat', {
  message: 'What files are in my Documents folder?',
  model: 'llama3.2:1b'
});

// Get available tools
const tools = await window.panelAPI.invoke('python-mcp-get-tools');
```

### From Main Process (Backend)
The IPC handlers are already set up in [main.js:2676-2709](../../electron/main.js#L2676-L2709)

## Configuration

### Update Ollama Model
Edit [mcp_agent.config.yaml](mcp_agent.config.yaml):
```yaml
ollama:
  base_url: "http://localhost:11434"
  default_model: "llama3.2:1b"  # Change to your preferred model
  timeout: 120
```

### Add More MCP Servers
Edit [mcp_agent.config.yaml](mcp_agent.config.yaml):
```yaml
mcp:
  servers:
    github:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-github"]
      description: "GitHub operations"

    brave-search:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-brave-search"]
      description: "Web search using Brave"
```

### Add API Keys
Edit [mcp_agent.secrets.yaml](mcp_agent.secrets.yaml):
```yaml
# GitHub token for private repos
github:
  api_key: "ghp_your_github_token_here"

# Brave Search API key
brave:
  api_key: "your_brave_api_key_here"
```

**Important**: Add `mcp_agent.secrets.yaml` to `.gitignore`!

## Troubleshooting

### Server won't start
**Error**: `ModuleNotFoundError: No module named 'mcp_agent'`
- **Solution**: Activate virtual environment and install dependencies
  ```bash
  venv\Scripts\activate  # Windows
  pip install -r requirements.txt
  ```

### Ollama not accessible
**Error**: `Connection refused to http://localhost:11434`
- **Solution**: Start Ollama service
  ```bash
  # Windows: Ollama should auto-start, or run from Start menu
  # macOS/Linux:
  ollama serve
  ```

### MCP server fails to connect
**Error**: `Failed to connect to filesystem server`
- **Solution**: Install MCP server globally
  ```bash
  npm install -g @modelcontextprotocol/server-filesystem
  ```
- **Windows users**: Make sure `npx.cmd` is in PATH

### Model not found
**Error**: `model 'llama3.2:1b' not found`
- **Solution**: Pull the model
  ```bash
  ollama pull llama3.2:1b
  ```

### Port already in use
**Error**: `Address already in use: 8000`
- **Solution**: Kill process on port 8000 or change port in [agent_server.py:319](agent_server.py#L319)
  ```bash
  # Windows
  netstat -ano | findstr :8000
  taskkill /PID <PID> /F

  # macOS/Linux
  lsof -ti:8000 | xargs kill -9
  ```

## Performance Tips

### Choose the Right Model
| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| llama3.2:1b | 500MB | ⚡⚡⚡⚡⚡ | ⭐⭐⭐ | Quick tasks, low-end hardware |
| llama3.2:1b | 1.3GB | ⚡⚡⚡⚡ | ⭐⭐⭐⭐ | Balanced performance |
| phi3:mini | 2.3GB | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | Complex reasoning |
| mistral | 4.1GB | ⚡⚡ | ⭐⭐⭐⭐⭐ | Production use |

### Adjust Context Window
In [mcp_agent.config.yaml](mcp_agent.config.yaml):
```yaml
ollama:
  context_size: 2048  # Smaller = faster, less memory
```

### Enable GPU Acceleration
Ollama automatically uses GPU if available. Verify:
```bash
ollama ps  # Check if GPU is being used
```

## Project Structure

```
python-mcp-backend/
├── agent_server.py              # FastAPI server (entry point)
├── main.py                      # ElectronMCPAgent class
├── workflows/
│   ├── __init__.py
│   └── agentic_workflows.py    # OllamaAugmentedLLM implementation
├── mcp_agent.config.yaml        # MCP configuration
├── mcp_agent.secrets.yaml       # API keys (gitignore!)
├── requirements.txt             # Python dependencies
├── pyproject.toml              # Project metadata
├── logs/                        # Log files
│   └── mcp-agent.jsonl
└── README.md                    # This file
```

## Next Steps

1. **Test the Backend**:
   ```bash
   python agent_server.py
   ```

2. **Open Electron App**:
   - Navigate to Settings → MCP Servers
   - Check Python MCP Backend status (should show green)

3. **Try a Chat**:
   ```javascript
   // In browser console or renderer
   const result = await window.panelAPI.invoke('python-mcp-chat', {
     message: 'List files in my Documents folder'
   });
   console.log(result);
   ```

4. **Add Custom MCP Servers**:
   - Edit [mcp_agent.config.yaml](mcp_agent.config.yaml)
   - Restart the backend

## Additional Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [Ollama Models](https://ollama.com/library)
- [mcp-agent GitHub](https://github.com/lastmile-ai/mcp-agent)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [MCP Servers List](https://github.com/modelcontextprotocol/servers)

## License

MIT
