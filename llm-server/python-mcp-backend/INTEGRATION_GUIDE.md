# Integration Guide: Python MCP Backend with Electron

This guide explains how the Python MCP backend integrates with your Electron AI Palette application.

## Overview

The integration consists of three main layers:

1. **Python MCP Backend** (Port 8000): FastAPI server with MCP agent
2. **Electron Main Process**: IPC handlers bridge frontend and backend
3. **React Frontend**: UI components to interact with the backend

## Architecture Flow

```
┌─────────────────────────────────────────────────────┐
│  Frontend: MCPSettings.jsx                          │
│  - Display backend status                           │
│  - Check health endpoint                            │
│  - Show available tools                             │
└─────────────────┬───────────────────────────────────┘
                  │ window.panelAPI.invoke()
┌─────────────────▼───────────────────────────────────┐
│  Main Process: electron/main.js                     │
│  - IPC Handlers (lines 2676-2709)                   │
│    * python-mcp-health                              │
│    * python-mcp-chat                                │
│    * python-mcp-get-tools                           │
└─────────────────┬───────────────────────────────────┘
                  │ HTTP (axios)
┌─────────────────▼───────────────────────────────────┐
│  Python Backend: agent_server.py                    │
│  - FastAPI server on localhost:8000                 │
│  - Endpoints:                                       │
│    * GET  /health                                   │
│    * POST /chat                                     │
│    * GET  /tools                                    │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│  MCP Agent: main.py                                 │
│  - ElectronMCPAgent class                           │
│  - Connects to MCP servers                          │
│  - Uses OllamaAugmentedLLM                         │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│  Ollama: Local LLM                                  │
│  - Runs on localhost:11434                          │
│  - Models: llama3.2:1b, llama3.2:1b, etc.         │
└─────────────────────────────────────────────────────┘
```

## Component Details

### 1. Frontend Integration (MCPSettings.jsx)

Location: [src/components/MCPSettings.jsx](../../src/components/MCPSettings.jsx)

**Added Features:**
- Python backend status indicator (lines 7, 60-99)
- Health check function (lines 15-26)
- Status badge with color coding (green/yellow/red)
- Check Status button
- Helpful startup command hint when offline

**Usage Example:**
```javascript
// Component automatically checks backend on mount
useEffect(() => {
  checkPythonBackend();
}, []);

// Manual health check
const checkPythonBackend = async () => {
  try {
    const response = await fetch('http://localhost:8000/health');
    if (response.ok) {
      setPythonBackendStatus('running');
    }
  } catch (error) {
    setPythonBackendStatus('offline');
  }
};
```

### 2. Main Process Integration (main.js)

Location: [electron/main.js](../../electron/main.js) (lines 2676-2709)

**IPC Handlers Added:**

#### `python-mcp-health`
Check if backend is running
```javascript
ipcMain.handle('python-mcp-health', async () => {
  try {
    const response = await axios.get(`${PYTHON_MCP_URL}/health`);
    return { success: true, status: response.data.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

#### `python-mcp-chat`
Send message to AI agent with tool calling
```javascript
ipcMain.handle('python-mcp-chat', async (_, { message, model }) => {
  try {
    const response = await axios.post(`${PYTHON_MCP_URL}/chat`, {
      message,
      model: model || 'llama3.2:1b'
    });
    return { success: true, response: response.data.response };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

#### `python-mcp-get-tools`
Get list of available MCP tools
```javascript
ipcMain.handle('python-mcp-get-tools', async () => {
  try {
    const response = await axios.get(`${PYTHON_MCP_URL}/tools`);
    return { success: true, tools: response.data.tools };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### 3. Python Backend (agent_server.py)

Location: [llm-server/python-mcp-backend/agent_server.py](agent_server.py)

**FastAPI Endpoints:**

#### `GET /health`
```python
@app.get("/health")
async def health():
    return {"status": "healthy"}
```

#### `POST /chat`
```python
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    response = await agent_instance.chat(
        request.message,
        model=request.model
    )
    return ChatResponse(
        response=response,
        model_used=request.model or "llama3.2:1b"
    )
```

#### `GET /tools`
```python
@app.get("/tools", response_model=ToolsResponse)
async def get_tools():
    tools = await agent_instance.get_available_tools()
    return ToolsResponse(tools=tools)
```

### 4. MCP Agent (main.py)

Location: [llm-server/python-mcp-backend/main.py](main.py)

**Key Class: ElectronMCPAgent**

```python
class ElectronMCPAgent:
    async def initialize(self, server_names: list[str] = None):
        """Connect to MCP servers and attach Ollama LLM"""
        self.agent = Agent(
            name="electron_assistant",
            instruction="You are a helpful AI assistant...",
            server_names=server_names or ["fetch", "filesystem"]
        )
        self.llm = await self.agent.attach_llm(
            OllamaAugmentedLLM,
            model="llama3.2:1b"
        )

    async def chat(self, message: str, model: Optional[str] = None):
        """Send message and get response with tool calling"""
        result = await self.llm.generate_str(message, params)
        return result

    async def get_available_tools(self):
        """List all tools from connected MCP servers"""
        tools = await self.agent.list_tools()
        return tools
```

### 5. Ollama Integration (agentic_workflows.py)

Location: [llm-server/python-mcp-backend/workflows/agentic_workflows.py](workflows/agentic_workflows.py)

**Custom Ollama LLM Wrapper:**

```python
class OllamaAugmentedLLM(AugmentedLLM):
    async def generate(self, message, params):
        """Generate response with tool calling support"""

        # 1. Get tools from MCP servers
        tools = await self._format_tools_for_ollama()

        # 2. Send to Ollama with tools
        response = await self.client.post(
            f"{self.base_url}/api/chat",
            json={"model": model, "messages": messages, "tools": tools}
        )

        # 3. Handle tool calls
        if "tool_calls" in assistant_message:
            tool_results = await self._execute_tool_calls(...)
            # Recursive call to get final answer
            return await self.generate("", params)

        return result
```

## Usage Examples

### Example 1: Check Backend Status from Frontend

```javascript
// In any React component with access to window.panelAPI
const checkStatus = async () => {
  const result = await window.panelAPI.invoke('python-mcp-health');

  if (result.success) {
    console.log('Backend is running!');
  } else {
    console.log('Backend is offline:', result.error);
  }
};
```

### Example 2: Send Chat Message with Tool Calling

```javascript
const sendMessage = async () => {
  const result = await window.panelAPI.invoke('python-mcp-chat', {
    message: 'Read the contents of my Documents folder',
    model: 'llama3.2:1b'
  });

  if (result.success) {
    console.log('AI Response:', result.response);
    // Response will include file listing from filesystem tool
  }
};
```

### Example 3: Get Available Tools

```javascript
const getTools = async () => {
  const result = await window.panelAPI.invoke('python-mcp-get-tools');

  if (result.success) {
    console.log('Available tools:', result.tools);
    /*
    [
      { name: 'read_file', description: 'Read file contents', serverName: 'filesystem' },
      { name: 'write_file', description: 'Write to file', serverName: 'filesystem' },
      { name: 'fetch', description: 'Fetch URL content', serverName: 'fetch' }
    ]
    */
  }
};
```

### Example 4: Advanced Tool Usage

```javascript
// Ask AI to fetch web content and save it to a file
const complexTask = async () => {
  const result = await window.panelAPI.invoke('python-mcp-chat', {
    message: 'Fetch the content from https://example.com and save it to example.txt',
    model: 'llama3.2:1b'
  });

  // AI will:
  // 1. Call fetch tool to get web content
  // 2. Call write_file tool to save content
  // 3. Return confirmation message

  console.log(result.response);
};
```

## Extending the Integration

### Add New IPC Handler (Main Process)

In [electron/main.js](../../electron/main.js):

```javascript
ipcMain.handle('python-mcp-custom-action', async (_, { param1, param2 }) => {
  try {
    const response = await axios.post(`${PYTHON_MCP_URL}/custom-endpoint`, {
      param1,
      param2
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### Add New Backend Endpoint

In [agent_server.py](agent_server.py):

```python
@app.post("/custom-endpoint")
async def custom_action(param1: str, param2: str):
    """Your custom logic here"""
    result = await agent_instance.chat(
        f"Do something with {param1} and {param2}"
    )
    return {"result": result}
```

### Add New MCP Server

In [mcp_agent.config.yaml](mcp_agent.config.yaml):

```yaml
mcp:
  servers:
    github:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-github"]
      description: "GitHub operations"
```

Then restart the Python backend.

## Comparison: Node.js MCP vs Python MCP

Your app now has **two MCP implementations**:

### Node.js MCP (Direct in Electron)
**Location**: [electron/main.js](../../electron/main.js) (lines 40-135)
- **Pros**:
  - Direct integration, no extra server needed
  - Lower latency
  - Same process as Electron
- **Cons**:
  - Limited to Node.js MCP SDK features
  - No agentic workflows
  - Less flexible for complex AI tasks

### Python MCP (Backend Server)
**Location**: [llm-server/python-mcp-backend/](.)
- **Pros**:
  - Full mcp-agent features with workflows
  - Better for complex agentic tasks
  - Easier to extend with Python libraries
  - Can use custom LLM wrappers
- **Cons**:
  - Requires separate server process
  - Slightly higher latency (HTTP)
  - More setup complexity

**Recommendation**: Use Python MCP backend for complex AI tasks with multiple tool calls, use Node.js MCP for simple tool invocations.

## Debugging

### Enable Debug Logging

In [mcp_agent.config.yaml](mcp_agent.config.yaml):
```yaml
logger:
  level: debug  # Change from info to debug
  transports: [console, file]
```

### View Logs

```bash
# Real-time log viewing
tail -f logs/mcp-agent.jsonl

# Windows
type logs\mcp-agent.jsonl
```

### Common Issues

**Issue**: Backend returns 503 "Agent not initialized"
**Solution**: Check that agent_instance initialized properly on startup

**Issue**: Tool calls fail
**Solution**: Verify MCP server is running and accessible

**Issue**: Slow responses
**Solution**: Use a lighter Ollama model (llama3.2:1b instead of llama3.2:1b)

## Security Considerations

1. **Localhost Only**: Backend runs on 127.0.0.1 (localhost) only
2. **No Authentication**: Suitable for local use only
3. **CORS**: Enabled for all origins (fine for local development)
4. **File Access**: Filesystem server has access to configured paths only
5. **Secrets**: Keep `mcp_agent.secrets.yaml` in `.gitignore`

For production deployment, add:
- Authentication (JWT tokens)
- Rate limiting
- Input validation
- CORS restrictions
- HTTPS

## Performance Optimization

### 1. Model Selection
```yaml
# Fast (500MB)
default_model: "llama3.2:1b"

# Balanced (1.3GB)
default_model: "llama3.2:1b"

# Best Quality (2.3GB)
default_model: "phi3:mini"
```

### 2. Concurrent Requests
FastAPI handles multiple requests concurrently by default.

### 3. Caching
Consider adding caching for frequent queries:
```python
from functools import lru_cache

@lru_cache(maxsize=100)
async def cached_chat(message: str):
    return await agent_instance.chat(message)
```

## Next Steps

1. ✅ Backend is set up and integrated
2. Add UI buttons to trigger Python MCP chat
3. Create specialized agents for different tasks
4. Add more MCP servers (GitHub, Brave Search, etc.)
5. Implement conversation history in the backend
6. Add streaming responses for better UX

## Support

For issues or questions:
1. Check the [main README](README.md)
2. Review [troubleshooting section](README.md#troubleshooting)
3. Check MCP logs: `logs/mcp-agent.jsonl`
4. Review Ollama logs: `ollama logs`

## References

- [Model Context Protocol](https://modelcontextprotocol.io)
- [mcp-agent Documentation](https://github.com/lastmile-ai/mcp-agent)
- [Ollama Documentation](https://ollama.com)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
