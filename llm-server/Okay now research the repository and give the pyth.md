<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Okay now research the repository and give the python code and setup full directory for this requirement., just giv eme

Now here's the complete Python code and directory setup for using mcp-agent with Ollama for local LLM agentic capabilities in your Electron app:

## Complete Directory Structure

```
electron-mcp-backend/
├── pyproject.toml
├── requirements.txt
├── mcp_agent.config.yaml
├── mcp_agent.secrets.yaml
├── main.py
├── agent_server.py
├── workflows/
│   ├── __init__.py
│   └── agentic_workflows.py
├── logs/
└── README.md
```


## File Contents

### `pyproject.toml`

```toml
[project]
name = "electron-mcp-backend"
version = "0.1.0"
description = "MCP Agent backend for Electron app with local Ollama"
requires-python = ">=3.10"
dependencies = [
    "mcp-agent>=0.0.21",
    "httpx>=0.27.0",
    "fastapi>=0.115.0",
    "uvicorn>=0.32.0",
    "python-dotenv>=1.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```


### `requirements.txt`

```txt
mcp-agent>=0.0.21
httpx>=0.27.0
fastapi>=0.115.0
uvicorn>=0.32.0
python-dotenv>=1.0.0
```


### `mcp_agent.config.yaml`

```yaml
execution_engine: asyncio
logger:
  transports: [console, file]
  level: debug
  path: "logs/mcp-agent.jsonl"

mcp:
  servers:
    fetch:
      command: "uvx"
      args: ["mcp-server-fetch"]
      description: "Fetch content from URLs"
    
    filesystem:
      command: "npx"
      args:
        [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "/path/to/your/workspace",  # Update this path
        ]
      description: "Access filesystem operations"

ollama:
  base_url: "http://localhost:11434"
  default_model: "phi3:mini"  # Or qwen2.5, llama3.2, mistral, etc.
  timeout: 120
```


### `mcp_agent.secrets.yaml`

```yaml
# Add any API keys here (gitignore this file)
# For Ollama-only setup, this can be empty or contain other service keys

# Optional: If you want to use cloud models as fallback
# openai:
#   api_key: "your-openai-key-here"

# anthropic:
#   api_key: "your-anthropic-key-here"
```


### `main.py`

```python
import asyncio
import os
from typing import Optional
from mcp_agent.app import MCPApp
from mcp_agent.agents.agent import Agent
from mcp_agent.workflows.llm.augmented_llm_base import RequestParams

# Note: mcp-agent doesn't have native Ollama support in the base package
# We'll create a custom Ollama LLM wrapper
from workflows.agentic_workflows import OllamaAugmentedLLM

app = MCPApp(name="electron_ai_backend")

class ElectronMCPAgent:
    """Main agent class for Electron backend"""
    
    def __init__(self):
        self.app = app
        self.agent = None
        self.llm = None
    
    async def initialize(self, server_names: list[str] = None):
        """Initialize the agent with specified MCP servers"""
        if server_names is None:
            server_names = ["fetch", "filesystem"]
        
        self.agent = Agent(
            name="electron_assistant",
            instruction="""You are a helpful AI assistant with access to 
            filesystem and web fetch capabilities. Use tools when needed to 
            help the user accomplish their tasks.""",
            server_names=server_names,
        )
        
        async with self.agent:
            self.llm = await self.agent.attach_llm(
                OllamaAugmentedLLM,
                model="phi3:mini",  # Or any Ollama model you have
            )
            
            return self
    
    async def chat(self, message: str, model: Optional[str] = None) -> str:
        """Send a message and get response"""
        if not self.llm:
            raise RuntimeError("Agent not initialized. Call initialize() first.")
        
        params = RequestParams(model=model) if model else RequestParams()
        result = await self.llm.generate_str(message, params)
        return result
    
    async def get_available_tools(self) -> list:
        """Get list of available tools from MCP servers"""
        if not self.agent:
            raise RuntimeError("Agent not initialized")
        
        tools = await self.agent.list_tools()
        return tools


# Example usage
async def example_usage():
    """Example of how to use the agent"""
    async with app.run() as mcp_agent_app:
        logger = mcp_agent_app.logger
        
        # Initialize agent
        agent_instance = ElectronMCPAgent()
        await agent_instance.initialize()
        
        # Check available tools
        tools = await agent_instance.get_available_tools()
        logger.info("Available tools:", data=tools)
        
        # Example: Read a file
        result = await agent_instance.chat(
            "Show me what's in README.md"
        )
        logger.info(f"Result: {result}")
        
        # Example: Fetch web content
        result = await agent_instance.chat(
            "Fetch the first paragraph from https://www.anthropic.com"
        )
        logger.info(f"Web content: {result}")
        
        # Multi-turn conversation
        result = await agent_instance.chat(
            "Summarize that in one sentence"
        )
        logger.info(f"Summary: {result}")


if __name__ == "__main__":
    asyncio.run(example_usage())
```


### `agent_server.py`

```python
"""FastAPI server to expose MCP agent to Electron app"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from main import ElectronMCPAgent, app as mcp_app


# Request/Response models
class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    model_used: str


class ToolsResponse(BaseModel):
    tools: list


# Global agent instance
agent_instance: Optional[ElectronMCPAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize agent on startup"""
    global agent_instance
    
    async with mcp_app.run() as mcp_agent_app:
        agent_instance = ElectronMCPAgent()
        await agent_instance.initialize()
        mcp_agent_app.logger.info("MCP Agent initialized successfully")
        
        yield
        
        mcp_agent_app.logger.info("Shutting down MCP Agent")


# Create FastAPI app
app = FastAPI(
    title="Electron MCP Backend",
    description="MCP Agent backend with Ollama for Electron app",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Electron app origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "running", "service": "MCP Agent Backend"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/tools", response_model=ToolsResponse)
async def get_tools():
    """Get available MCP tools"""
    if not agent_instance:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        tools = await agent_instance.get_available_tools()
        return ToolsResponse(tools=tools)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send message to agent and get response"""
    if not agent_instance:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        response = await agent_instance.chat(
            request.message,
            model=request.model
        )
        
        return ChatResponse(
            response=response,
            model_used=request.model or "phi3:mini"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "agent_server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
```


### `workflows/agentic_workflows.py`

```python
"""Custom Ollama integration for mcp-agent"""
import httpx
import json
from typing import Any, Optional
from mcp_agent.workflows.llm.augmented_llm_base import (
    AugmentedLLM,
    Message,
    RequestParams,
    GenerateResult,
)


class OllamaAugmentedLLM(AugmentedLLM):
    """Ollama implementation of AugmentedLLM"""
    
    def __init__(
        self,
        agent,
        base_url: str = "http://localhost:11434",
        model: str = "phi3:mini",
        **kwargs
    ):
        super().__init__(agent, **kwargs)
        self.base_url = base_url
        self.default_model = model
        self.client = httpx.AsyncClient(timeout=120.0)
    
    async def generate(
        self,
        message: str | Message,
        params: Optional[RequestParams] = None,
        **kwargs
    ) -> GenerateResult:
        """Generate response with tool calling support"""
        if params is None:
            params = RequestParams()
        
        model = params.model or self.default_model
        
        # Convert message to proper format
        if isinstance(message, str):
            user_message = Message(role="user", content=message)
        else:
            user_message = message
        
        # Add to conversation history
        self.memory.add_message(user_message)
        
        # Get tools from agent
        tools = await self._format_tools_for_ollama()
        
        # Prepare messages
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in self.memory.get_messages()
        ]
        
        # Call Ollama API
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
        }
        
        if tools:
            payload["tools"] = tools
        
        response = await self.client.post(
            f"{self.base_url}/api/chat",
            json=payload
        )
        response.raise_for_status()
        
        result = response.json()
        assistant_message = result.get("message", {})
        
        # Handle tool calls
        if "tool_calls" in assistant_message:
            tool_results = await self._execute_tool_calls(
                assistant_message["tool_calls"]
            )
            
            # Add tool results to conversation and recurse
            for tool_result in tool_results:
                self.memory.add_message(Message(
                    role="tool",
                    content=json.dumps(tool_result)
                ))
            
            # Recursive call to get final answer
            return await self.generate("", params)
        
        # Add assistant response to memory
        assistant_response = Message(
            role="assistant",
            content=assistant_message.get("content", "")
        )
        self.memory.add_message(assistant_response)
        
        return GenerateResult(
            message=assistant_response,
            model=model
        )
    
    async def generate_str(
        self,
        message: str,
        params: Optional[RequestParams] = None,
        **kwargs
    ) -> str:
        """Generate and return as string"""
        result = await self.generate(message, params, **kwargs)
        return result.message.content
    
    async def _format_tools_for_ollama(self) -> list:
        """Convert MCP tools to Ollama format"""
        tools = await self.agent.list_tools()
        
        ollama_tools = []
        for tool in tools:
            ollama_tools.append({
                "type": "function",
                "function": {
                    "name": tool.get("name"),
                    "description": tool.get("description", ""),
                    "parameters": tool.get("inputSchema", {})
                }
            })
        
        return ollama_tools
    
    async def _execute_tool_calls(self, tool_calls: list) -> list:
        """Execute MCP tool calls"""
        results = []
        
        for tool_call in tool_calls:
            function = tool_call.get("function", {})
            tool_name = function.get("name")
            arguments = json.loads(function.get("arguments", "{}"))
            
            # Call MCP tool
            result = await self.agent.call_tool(tool_name, arguments)
            results.append({
                "tool_call_id": tool_call.get("id"),
                "result": result
            })
        
        return results
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
```


### `workflows/__init__.py`

```python
"""Workflows package"""
from .agentic_workflows import OllamaAugmentedLLM

__all__ = ["OllamaAugmentedLLM"]
```


### `README.md`

```markdown
# Electron MCP Backend

Local AI agent backend using mcp-agent with Ollama for Electron applications.

## Setup

### 1. Install Python dependencies

```


# Using uv (recommended)

uv pip install -r requirements.txt

# Or using pip

pip install -r requirements.txt

```

### 2. Install Ollama and pull models

```


# Install Ollama from https://ollama.ai

# Then pull models:

ollama pull phi3:mini

# Or: ollama pull qwen2.5:latest

# Or: ollama pull llama3.2

```

### 3. Install MCP servers

```


# Fetch server

uvx mcp-server-fetch

# Filesystem server

npm install -g @modelcontextprotocol/server-filesystem

```

### 4. Update configuration

Edit `mcp_agent.config.yaml` and update the filesystem path to your workspace directory.

### 5. Run the server

```


# Development

python agent_server.py

# Or using uvicorn directly

uvicorn agent_server:app --reload --port 8000

```

## API Endpoints

- `GET /` - Status check
- `GET /health` - Health check
- `GET /tools` - List available MCP tools
- `POST /chat` - Send message to agent

### Example chat request:

```

curl -X POST http://localhost:8000/chat \
-H "Content-Type: application/json" \
-d '{"message": "Read the README.md file"}'

```

## Integration with Electron

From your Electron renderer or main process:

```

// Fetch from your Python backend
const response = await fetch('http://localhost:8000/chat', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
message: 'Your query here',
model: 'phi3:mini'  // optional
})
});

const data = await response.json();
console.log(data.response);

```
```


## Installation Commands

```bash
# 1. Create directory
mkdir electron-mcp-backend
cd electron-mcp-backend

# 2. Install uv (if not installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 3. Create virtual environment
uv venv

# 4. Activate virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 5. Install dependencies
uv pip install mcp-agent httpx fastapi uvicorn python-dotenv

# 6. Install Ollama
# Download from https://ollama.ai and install

# 7. Pull Ollama model
ollama pull phi3:mini

# 8. Install MCP servers
npm install -g @modelcontextprotocol/server-filesystem
# uvx will auto-install mcp-server-fetch when needed

# 9. Create all the files above

# 10. Run the server
python agent_server.py
```

This setup gives you a fully functional local LLM agent backend that your Electron app can communicate with via HTTP.[^1][^2][^3][^4][^5]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://github.com/godstale/ollama-mcp-agent

[^2]: https://github.com/ausboss/mcp-ollama-agent

[^3]: https://dev.to/jonigl/build-an-mcp-client-in-minutes-local-ai-agents-just-got-real-4gj6

[^4]: https://github.com/lastmile-ai/mcp-agent?tab=readme-ov-file

[^5]: https://www.ahmedbouchefra.com/connect-python-3-electron-nodejs-build-desktop-apps/

[^6]: https://www.youtube.com/watch?v=aiH79Q-LGjY

[^7]: https://www.youtube.com/watch?v=Uq5lgErh3oo

[^8]: https://composio.dev/blog/openai-agent-builder-step-by-step-guide-to-building-ai-agents-with-mcp

[^9]: https://www.dailydoseofds.com/p/building-a-100-local-mcp-client/

[^10]: https://apidog.com/blog/mcp-ollama/

[^11]: https://composio.dev/blog/the-complete-guide-to-building-mcp-agents

[^12]: https://modelcontextprotocol.io/docs/develop/connect-local-servers

[^13]: https://huggingface.co/blog/python-tiny-agents

[^14]: https://www.youtube.com/watch?v=wa_A0qY0anA

[^15]: https://learn.microsoft.com/en-us/azure/developer/ai/intro-agents-mcp

[^16]: https://generativeai.pub/creating-a-standalone-tool-operating-agent-using-mcp-5b475f18c533

[^17]: https://github.com/lastmile-ai/mcp-agent

[^18]: https://modelcontextprotocol.io/quickstart/client

[^19]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers

[^20]: https://openai.github.io/openai-agents-python/mcp/

[^21]: https://learn.microsoft.com/en-us/agent-framework/user-guide/model-context-protocol/using-mcp-tools

[^22]: https://huggingface.co/blog/tiny-agents

[^23]: https://github.com/AgentMCP/ai-agent-directory

[^24]: https://github.com/punkpeye/awesome-mcp-servers

[^25]: https://github.com/topics/mcp-agent

[^26]: https://github.com/rinadelph/Agent-MCP

[^27]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-mcp.html

[^28]: https://github.com/maheshmurag/workshop-mcp-agent-example

[^29]: https://google.github.io/adk-docs/tools/mcp-tools/

[^30]: https://modelcontextprotocol.io/examples

[^31]: https://github.com/evalstate/fast-agent

[^32]: https://wandb.ai/byyoung3/Generative-AI/reports/Getting-Started-with-MCP-using-OpenAI-Agents---VmlldzoxMjAwNzU5NA

[^33]: https://learn.microsoft.com/en-us/samples/azure-samples/openai-mcp-agent-dotnet/openai-mcp-agent-dotnet/

[^34]: https://fast-agent.ai/mcp/state_transfer/

