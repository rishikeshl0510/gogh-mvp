# Frontend Integration Guide

This guide explains how the Python MCP Backend with RAG is integrated into your Electron app and how to use it from the UI.

## Overview

The integration happens at three levels:
1. **Main Process** (`electron/main.js`) - IPC handlers
2. **Preload Script** (`electron/preload-panel.js`) - Exposed APIs
3. **React Components** (`src/components/`) - UI interactions

## Auto-Start Behavior

✅ **Python MCP Backend starts automatically when you click "Start Ollama" in the chat panel!**

### How It Works

1. User clicks "Start Ollama" button in chat
2. Ollama server starts (downloading if needed)
3. After Ollama is ready, checks Python MCP config
4. If `autoStart` or `enabled` is `true`, automatically starts Python backend
5. User sees both services starting in the logs

### Enable Auto-Start

Set in `python-mcp-config.json`:
```json
{
  "enabled": true,
  "autoStart": true
}
```

Or programmatically:
```javascript
const config = await window.panelAPI.invoke('get-python-mcp-config');
config.autoStart = true;
await window.panelAPI.invoke('save-python-mcp-config', config);
```

## Available APIs

### 1. Python MCP Backend APIs

```javascript
// Check if backend is running
const health = await window.panelAPI.pythonMCPHealth();
// Returns: { success: true, status: "healthy" }

// Chat with MCP agent (with tool calling)
const result = await window.panelAPI.pythonMCPChat(
  "Read the file at C:/path/to/document.pdf",
  "llama3.2:1b"
);
// Returns: { success: true, response: "..." }

// Get available MCP tools
const tools = await window.panelAPI.pythonMCPGetTools();
// Returns: { success: true, tools: [...] }

// Start backend manually
const start = await window.panelAPI.startPythonMCPServer();
// Returns: { success: true, message: "Server started" }
```

### 2. RAG APIs

```javascript
// Index files for semantic search
const indexResult = await window.panelAPI.ragIndexFiles([
  'C:/Users/YourName/Documents/report.pdf',
  'C:/Users/YourName/Documents/notes.txt'
]);
// Returns: { success: true, indexed: 2, files: [...] }

// Index raw text
const textResult = await window.panelAPI.ragIndexText(
  'Important information to remember...',
  { source: 'user_input', date: '2025-10-13' }
);
// Returns: { success: true, indexed: 1, chars: 38 }

// Query indexed documents
const queryResult = await window.panelAPI.ragQuery(
  'What are the key points in the report?',
  'Additional context if needed'
);
// Returns: {
//   success: true,
//   response: "The key points are...",
//   sources: [{text: "...", score: 0.92}],
//   source_count: 3
// }

// Chat with RAG enabled
const chatResult = await window.panelAPI.chatWithRAG(
  'Summarize the documents',
  'llama3.2:1b',
  true  // use_rag = true
);
// Returns: { success: true, response: "...", sources: [...] }

// Get statistics
const stats = await window.panelAPI.ragStats();
// Returns: {
//   success: true,
//   total_documents: 15,
//   collection_name: "electron_docs",
//   embedding_model: "nomic-embed-text",
//   llm_model: "llama3.2:1b"
// }

// Clear all indexed documents
const clearResult = await window.panelAPI.ragClear();
// Returns: { success: true, message: "All indexed documents cleared" }
```

## Integration Examples

### Example 1: Add RAG Toggle to Chat Component

Update `Panel.jsx` chat component:

```javascript
function ChatWidget({ data }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [useRAG, setUseRAG] = useState(false);  // NEW
  const [ragStats, setRagStats] = useState(null);  // NEW

  // Load RAG stats on mount
  useEffect(() => {
    loadRAGStats();
  }, []);

  const loadRAGStats = async () => {
    const stats = await window.panelAPI.ragStats();
    if (stats.success) {
      setRagStats(stats);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Use RAG if enabled
    const result = await window.panelAPI.chatWithRAG(
      userMessage.content,
      'llama3.2:1b',
      useRAG  // Pass RAG toggle state
    );

    if (result.success) {
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.response,
        sources: result.sources  // Include sources if available
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
  };

  return (
    <div className="chat-widget">
      {/* RAG Toggle */}
      <div className="rag-controls">
        <label>
          <input
            type="checkbox"
            checked={useRAG}
            onChange={(e) => setUseRAG(e.target.checked)}
          />
          Use RAG ({ragStats?.total_documents || 0} docs indexed)
        </label>
        <button onClick={loadRAGStats}>Refresh</button>
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="content">{msg.content}</div>
            {msg.sources && (
              <div className="sources">
                <strong>Sources:</strong>
                {msg.sources.map((src, idx) => (
                  <div key={idx} className="source">
                    {src.text} (score: {src.score?.toFixed(2)})
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        placeholder={useRAG ? "Ask about indexed documents..." : "Type a message..."}
      />
    </div>
  );
}
```

### Example 2: Add Document Indexing to File Widget

Update file widget in `Panel.jsx`:

```javascript
function FilesWidget({ data }) {
  const [indexing, setIndexing] = useState(false);

  const indexSelectedFiles = async () => {
    setIndexing(true);

    // Get file paths from current mode
    const filePaths = data.files
      .filter(f => f.mode === data.currentMode)
      .map(f => f.path);

    const result = await window.panelAPI.ragIndexFiles(filePaths);

    if (result.success) {
      alert(`✅ Indexed ${result.indexed} files successfully!`);
    } else {
      alert(`❌ Error: ${result.error}`);
    }

    setIndexing(false);
  };

  return (
    <div className="files-widget">
      <button onClick={indexSelectedFiles} disabled={indexing}>
        {indexing ? 'Indexing...' : '📚 Index Files for RAG'}
      </button>

      {/* File list */}
      {data.files.map(file => (
        <div key={file.id} className="file-item">
          {file.name}
        </div>
      ))}
    </div>
  );
}
```

### Example 3: Enhanced MCP Settings with RAG Panel

Update `MCPSettings.jsx`:

```javascript
export default function MCPSettings({ showCustomDialog }) {
  const [servers, setServers] = useState([]);
  const [tools, setTools] = useState([]);
  const [pythonBackendStatus, setPythonBackendStatus] = useState('unknown');
  const [ragStats, setRagStats] = useState(null);  // NEW
  const [currentTab, setCurrentTab] = useState('servers');  // NEW

  useEffect(() => {
    loadServers();
    loadTools();
    checkPythonBackend();
    loadRAGStats();  // NEW
  }, []);

  const loadRAGStats = async () => {
    const stats = await window.panelAPI.ragStats();
    if (stats.success) {
      setRagStats(stats);
    }
  };

  const clearRAGIndex = async () => {
    if (confirm('Clear all indexed documents? This cannot be undone.')) {
      const result = await window.panelAPI.ragClear();
      if (result.success) {
        alert('✅ Index cleared successfully!');
        loadRAGStats();
      }
    }
  };

  return (
    <div style={{ padding: '8px' }}>
      {/* Tabs */}
      <div className="tabs">
        <button onClick={() => setCurrentTab('servers')}>
          MCP Servers
        </button>
        <button onClick={() => setCurrentTab('rag')}>
          RAG Documents
        </button>
      </div>

      {currentTab === 'servers' ? (
        <>
          {/* Existing MCP servers UI */}
          <div>Python Backend Status: {pythonBackendStatus}</div>
          {/* ... */}
        </>
      ) : (
        <>
          {/* RAG Tab */}
          <div className="rag-panel">
            <h3>RAG Statistics</h3>
            {ragStats ? (
              <div className="stats">
                <div>📚 Total Documents: {ragStats.total_documents}</div>
                <div>🤖 LLM Model: {ragStats.llm_model}</div>
                <div>🔤 Embedding Model: {ragStats.embedding_model}</div>
                <div>📦 Collection: {ragStats.collection_name}</div>
              </div>
            ) : (
              <div>Loading...</div>
            )}

            <div className="actions">
              <button onClick={loadRAGStats}>
                🔄 Refresh Stats
              </button>
              <button onClick={clearRAGIndex} className="danger">
                🗑️ Clear Index
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

### Example 4: Quick RAG Query Component

Create a new component for quick queries:

```javascript
function RAGQueryWidget() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const askQuestion = async () => {
    if (!question.trim()) return;

    setLoading(true);
    const response = await window.panelAPI.ragQuery(question);

    if (response.success) {
      setResult(response);
    } else {
      alert(`Error: ${response.error}`);
    }

    setLoading(false);
  };

  return (
    <div className="rag-query-widget">
      <h3>Quick RAG Query</h3>

      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
        placeholder="Ask a question about your documents..."
      />

      <button onClick={askQuestion} disabled={loading}>
        {loading ? 'Searching...' : '🔍 Search'}
      </button>

      {result && (
        <div className="result">
          <div className="answer">
            <strong>Answer:</strong>
            <p>{result.response}</p>
          </div>

          {result.sources && result.sources.length > 0 && (
            <div className="sources">
              <strong>Sources ({result.source_count}):</strong>
              {result.sources.map((source, idx) => (
                <div key={idx} className="source-card">
                  <div className="source-text">{source.text}</div>
                  {source.score && (
                    <div className="source-score">
                      Relevance: {(source.score * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Typical Workflow

### 1. First Time Setup
```bash
# In terminal
cd llm-server/python-mcp-backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
ollama pull llama3.2:1b
ollama pull nomic-embed-text
```

### 2. Enable Auto-Start
In Electron app, run in dev console:
```javascript
const config = await window.panelAPI.invoke('get-python-mcp-config');
config.enabled = true;
config.autoStart = true;
await window.panelAPI.invoke('save-python-mcp-config', config);
```

### 3. Start Services
- Click "Start Ollama" button in chat
- Python MCP Backend starts automatically
- Check MCP Settings to verify status

### 4. Index Documents
```javascript
// Index your important files
await window.panelAPI.ragIndexFiles([
  'C:/Users/YourName/Documents/project-notes.txt',
  'C:/Users/YourName/Documents/research.pdf'
]);
```

### 5. Use RAG in Chat
```javascript
// Enable RAG toggle in UI
const response = await window.panelAPI.chatWithRAG(
  'What did I write about the project timeline?',
  'llama3.2:1b',
  true  // use RAG
);

console.log(response.response);
console.log('Sources:', response.sources);
```

## Error Handling

Always wrap API calls in try-catch:

```javascript
async function safeRAGQuery(question) {
  try {
    const result = await window.panelAPI.ragQuery(question);

    if (!result.success) {
      console.error('RAG query failed:', result.error);
      return { error: result.error };
    }

    return result;
  } catch (error) {
    console.error('RAG query exception:', error);
    return { error: error.message };
  }
}
```

## Performance Tips

### 1. Lazy Load RAG Stats
Only load when needed:
```javascript
const [ragStats, setRagStats] = useState(null);

const loadStatsIfNeeded = async () => {
  if (!ragStats) {
    const stats = await window.panelAPI.ragStats();
    if (stats.success) setRagStats(stats);
  }
};
```

### 2. Debounce Queries
For search-as-you-type:
```javascript
const [query, setQuery] = useState('');
const [results, setResults] = useState(null);

const debouncedQuery = useDebounce(query, 500);

useEffect(() => {
  if (debouncedQuery) {
    window.panelAPI.ragQuery(debouncedQuery).then(setResults);
  }
}, [debouncedQuery]);
```

### 3. Cache Results
```javascript
const cache = new Map();

async function cachedRAGQuery(question) {
  if (cache.has(question)) {
    return cache.get(question);
  }

  const result = await window.panelAPI.ragQuery(question);
  cache.set(question, result);
  return result;
}
```

## Testing

### Test Backend Connection
```javascript
// In browser console
await window.panelAPI.pythonMCPHealth()
```

### Test RAG Query
```javascript
// In browser console
await window.panelAPI.ragQuery('Hello, test query')
```

### Test File Indexing
```javascript
// In browser console
await window.panelAPI.ragIndexFiles(['C:/path/to/test.txt'])
```

## Debugging

### Check Backend Status
```javascript
const health = await window.panelAPI.pythonMCPHealth();
console.log('Backend status:', health);

const stats = await window.panelAPI.ragStats();
console.log('RAG stats:', stats);
```

### View Logs
Backend logs are at: `llm-server/python-mcp-backend/logs/mcp-agent.jsonl`

### Enable Verbose Logging
In `rag_service.py`, add debug prints:
```python
print(f"🔍 Querying with: {question}")
print(f"📊 Found {len(results)} results")
```

## Next Steps

1. ✅ Backend is integrated and auto-starts
2. Add RAG toggle to chat UI
3. Add document indexing button to files
4. Create RAG stats panel in settings
5. Add source attribution to chat messages
6. Implement conversation memory

## Support

- Check [SETUP_GUIDE.md](./SETUP_GUIDE.md) for setup issues
- Check [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for architecture details
- Check [README.md](./README.md) for API documentation

---

**Status**: ✅ Fully Integrated and Ready to Use!
