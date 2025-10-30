# Complete Setup Guide: Python MCP Backend with RAG

This guide will walk you through setting up the Python MCP backend with RAG (Retrieval Augmented Generation) capabilities for your Electron app.

## Prerequisites

### 1. Python 3.10+
```bash
python --version  # Should be 3.10 or higher
```

### 2. Ollama
Download and install from https://ollama.com

### 3. Node.js (for MCP servers)
Download from https://nodejs.org

## Step-by-Step Setup

### Step 1: Navigate to Backend Directory
```bash
cd llm-server/python-mcp-backend
```

### Step 2: Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**Note**: This will install:
- FastAPI and Uvicorn (web server)
- MCP Agent SDK
- LlamaIndex (RAG framework)
- ChromaDB (vector database)
- Document processors (PDF, DOCX)
- Sentence Transformers (embeddings)

### Step 4: Install Ollama Models

#### For Chat (Required)
```bash
ollama pull llama3.2:1b
# OR
ollama pull llama3.2:1b
```

#### For Embeddings (Required for RAG)
```bash
ollama pull nomic-embed-text
```

Verify models are installed:
```bash
ollama list
```

### Step 5: Install MCP Servers
```bash
# Filesystem server
npm install -g @modelcontextprotocol/server-filesystem

# Fetch server (auto-installed via uvx when needed)
```

### Step 6: Configure MCP Servers

Edit `mcp_agent.config.yaml`:
```yaml
mcp:
  servers:
    filesystem:
      command: "npx"
      args:
        [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "C:/Users/YourUsername/Documents",  # <-- UPDATE THIS
        ]
```

**Windows users**: Use forward slashes `/` in paths.

### Step 7: Test the Installation

#### Test Ollama
```bash
curl http://localhost:11434/api/tags
```

#### Test Python
```bash
python -c "import llama_index; print('LlamaIndex OK')"
python -c "import chromadb; print('ChromaDB OK')"
python -c "import fastapi; print('FastAPI OK')"
```

### Step 8: Start the Server
```bash
python agent_server.py
```

You should see:
```
✅ LlamaIndex configured with LLM: llama3.2:1b, Embeddings: nomic-embed-text
✅ ChromaDB initialized at ./chroma_db
✅ MCP Agent initialized successfully
✅ RAG Service initialized successfully
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 9: Verify Server is Running
```bash
# Health check
curl http://localhost:8000/health

# RAG stats
curl http://localhost:8000/rag/stats
```

## Using RAG Features

### 1. Index Documents

#### Via API
```bash
curl -X POST http://localhost:8000/rag/index \
  -H "Content-Type: application/json" \
  -d '{
    "file_paths": [
      "C:/Users/YourName/Documents/document.pdf",
      "C:/Users/YourName/Documents/notes.txt"
    ]
  }'
```

#### Via File Upload
```bash
curl -X POST http://localhost:8000/rag/upload \
  -F "file=@document.pdf"
```

### 2. Query with RAG
```bash
curl -X POST http://localhost:8000/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the key points in the document?"
  }'
```

### 3. Chat with RAG
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Summarize the documents",
    "use_rag": true
  }'
```

### 4. Get RAG Statistics
```bash
curl http://localhost:8000/rag/stats
```

### 5. Clear Index
```bash
curl -X DELETE http://localhost:8000/rag/clear
```

## Integration with Electron

The Electron app can now use these features through IPC handlers.

### From Renderer (React)
```javascript
// Index documents
const result = await window.panelAPI.ragIndexFiles([
  'C:/path/to/document.pdf'
]);

// Query with RAG
const answer = await window.panelAPI.ragQuery('What is this about?');

// Chat with RAG enabled
const response = await window.panelAPI.pythonMCPChat(
  'Explain the key concepts',
  'llama3.2:1b',
  true  // use_rag = true
);
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Electron App                           │
│  ┌──────────────────────────────────────────────┐   │
│  │         React UI (MCPSettings, Chat)         │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │ IPC                            │
│  ┌──────────────────▼───────────────────────────┐   │
│  │         main.js (IPC Handlers)               │   │
│  └──────────────────┬───────────────────────────┘   │
└────────────────────┬┼──────────────────────────────┘
                     ││ HTTP (localhost:8000)
         ┌───────────┘└────────────┐
         │                          │
┌────────▼──────────────────────────▼────────┐
│   Python MCP Backend (agent_server.py)     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  FastAPI Endpoints                  │   │
│  │  - /chat (with optional RAG)        │   │
│  │  - /rag/index                       │   │
│  │  - /rag/query                       │   │
│  │  - /rag/upload                      │   │
│  └─────────────┬───────────────────────┘   │
│                │                            │
│  ┌─────────────▼───────────────────────┐   │
│  │  ElectronMCPAgent (main.py)         │   │
│  │  - Connects to MCP servers          │   │
│  │  - Handles tool calling             │   │
│  └─────────────┬───────────────────────┘   │
│                │                            │
│  ┌─────────────▼───────────────────────┐   │
│  │  RAGService (rag_service.py)        │   │
│  │  - LlamaIndex integration           │   │
│  │  - ChromaDB vector store            │   │
│  │  - Document indexing                │   │
│  │  - Semantic search                  │   │
│  └─────────────┬───────────────────────┘   │
└────────────────┼──────────────────────────┘
                 │
     ┌───────────┴───────────┐
     │                       │
┌────▼─────┐         ┌──────▼────────┐
│  Ollama  │         │   ChromaDB    │
│  Models  │         │ Vector Store  │
│          │         │               │
│ Chat:    │         │  Embeddings   │
│  qwen2.5 │         │  Documents    │
│  llama3.2│         │  Metadata     │
│          │         │               │
│ Embed:   │         └───────────────┘
│  nomic   │
└──────────┘
```

## File Structure

```
python-mcp-backend/
├── agent_server.py         # FastAPI server (main entry)
├── main.py                 # MCP Agent implementation
├── rag_service.py          # RAG service with LlamaIndex
├── workflows/
│   ├── __init__.py
│   └── agentic_workflows.py
├── mcp_agent.config.yaml   # MCP configuration
├── requirements.txt        # Python dependencies
├── chroma_db/             # Vector database (auto-created)
├── uploads/               # Uploaded files (auto-created)
├── logs/                  # Log files
└── README.md
```

## Troubleshooting

### Ollama Not Running
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Windows: Start Ollama from Start Menu
# macOS/Linux: ollama serve
```

### Model Not Found
```bash
# List installed models
ollama list

# Pull missing model
ollama pull llama3.2:1b
ollama pull nomic-embed-text
```

### ChromaDB Errors
```bash
# Clear and recreate
rm -rf chroma_db/  # Windows: rmdir /s chroma_db
# Restart server
```

### Memory Issues
- Use smaller models: `llama3.2:1b` instead of larger ones
- Reduce chunk size in `rag_service.py`
- Clear index regularly: `curl -X DELETE http://localhost:8000/rag/clear`

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8000 | xargs kill -9
```

## Performance Tips

### 1. Choose Right Models

**For Chat:**
- `llama3.2:1b` - Fastest, 500MB
- `llama3.2:1b` - Balanced, 1.3GB
- `phi3:mini` - Best quality, 2.3GB

**For Embeddings:**
- `nomic-embed-text` - Recommended, 274MB
- `all-minilm` - Alternative, smaller

### 2. Optimize ChromaDB
- Regularly clear old documents
- Use metadata filtering
- Limit similarity_top_k (default: 5)

### 3. Document Processing
- Pre-process large PDFs
- Split documents into chunks
- Use meaningful metadata

## Advanced Usage

### Custom Embeddings Model
Edit `rag_service.py`:
```python
def __init__(self, embedding_model: str = "all-minilm-l6-v2"):
```

### Adjust Chunk Size
Edit `rag_service.py`:
```python
Settings.chunk_size = 1024  # Larger chunks
Settings.chunk_overlap = 100
```

### Multiple Collections
```python
rag_service = RAGService(collection_name="project_docs")
```

## Next Steps

1. ✅ Backend is running
2. Test RAG with sample documents
3. Integrate with Electron UI
4. Add more MCP servers (GitHub, Brave Search)
5. Implement conversation memory
6. Add streaming responses

## Support

- [LlamaIndex Documentation](https://docs.llamaindex.ai/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Ollama Models](https://ollama.com/library)
- [MCP Documentation](https://modelcontextprotocol.io/)

## License

MIT
