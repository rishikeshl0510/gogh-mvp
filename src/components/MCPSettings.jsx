import React, { useState, useEffect } from 'react';

export default function MCPSettings({ showCustomDialog }) {
  const [currentTab, setCurrentTab] = useState('servers');
  const [servers, setServers] = useState([]);
  const [tools, setTools] = useState([]);
  const [expandedTools, setExpandedTools] = useState({});
  const [pythonBackendStatus, setPythonBackendStatus] = useState('unknown');
  const [ragStats, setRagStats] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadServers();
    loadTools();
    checkPythonBackend();
    if (currentTab === 'rag') {
      loadRAGStats();
    }
  }, [currentTab]);

  const checkPythonBackend = async () => {
    const result = await window.panelAPI.pythonMCPHealth();
    if (result.success) {
      setPythonBackendStatus('running');
    } else {
      setPythonBackendStatus('offline');
    }
  };

  const startPythonBackend = async () => {
    setStarting(true);
    const result = await window.panelAPI.startPythonMCPServer();
    setStarting(false);

    if (result.success) {
      alert('✅ Python MCP Backend started successfully!');
      await checkPythonBackend();
      if (currentTab === 'rag') {
        await loadRAGStats();
      }
    } else {
      alert(`❌ Failed to start: ${result.error}`);
    }
  };

  const loadServers = async () => {
    const connectedServers = await window.panelAPI.getMCPServers();
    setServers(connectedServers);
  };

  const loadTools = async () => {
    const availableTools = await window.panelAPI.getMCPTools();
    setTools(availableTools);
  };

  const loadRAGStats = async () => {
    const stats = await window.panelAPI.ragStats();
    if (stats.success) {
      setRagStats(stats);
    } else {
      setRagStats(null);
    }
  };

  const handleRemoveServer = async (serverName) => {
    if (confirm(`Remove MCP server "${serverName}"?`)) {
      await window.panelAPI.removeMCPServer(serverName);
      await loadServers();
      await loadTools();
    }
  };

  const toggleTool = (idx) => {
    setExpandedTools(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const clearRAGIndex = async () => {
    if (confirm('⚠️ Clear ALL indexed documents? This cannot be undone!')) {
      const result = await window.panelAPI.ragClear();
      if (result.success) {
        alert('✅ Index cleared successfully!');
        await loadRAGStats();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>
      {/* Header Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setCurrentTab('servers')}
          style={{
            flex: 1,
            padding: '10px',
            background: currentTab === 'servers' ? 'rgba(100, 200, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: currentTab === 'servers' ? '1px solid rgba(100, 200, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          🔌 MCP Servers
        </button>
        <button
          onClick={() => setCurrentTab('rag')}
          style={{
            flex: 1,
            padding: '10px',
            background: currentTab === 'rag' ? 'rgba(100, 200, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: currentTab === 'rag' ? '1px solid rgba(100, 200, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          📚 RAG Documents
        </button>
      </div>

      {currentTab === 'servers' ? (
        <>
          {/* Python MCP Backend Status */}
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Python MCP Backend (Port 8000)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: pythonBackendStatus === 'running' ? 'rgba(100, 255, 150, 0.8)' : 'rgba(255, 100, 100, 0.8)'
              }}></div>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600' }}>
                {pythonBackendStatus === 'running' ? '✅ Running' : '⚪ Offline'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={checkPythonBackend}
                style={{
                  flex: 1,
                  background: 'rgba(100, 200, 255, 0.1)',
                  border: '1px solid rgba(100, 200, 255, 0.2)',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontSize: '9px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                🔄 Check Status
              </button>
              {pythonBackendStatus === 'offline' && (
                <button
                  onClick={startPythonBackend}
                  disabled={starting}
                  style={{
                    flex: 1,
                    background: 'rgba(100, 255, 150, 0.1)',
                    border: '1px solid rgba(100, 255, 150, 0.3)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '9px',
                    color: 'rgba(100, 255, 150, 0.9)',
                    cursor: starting ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: starting ? 0.5 : 1
                  }}
                >
                  {starting ? '⏳ Starting...' : '🚀 Start Server'}
                </button>
              )}
            </div>
            {pythonBackendStatus === 'offline' && (
              <div style={{ fontSize: '8px', color: 'rgba(255, 150, 100, 0.7)', marginTop: '8px', lineHeight: '1.4' }}>
                Or manually: cd llm-server/python-mcp-backend && python agent_server.py
              </div>
            )}
          </div>

          {/* Connected Servers */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Node.js MCP Servers ({servers.length})
            </div>
            {servers.length === 0 ? (
              <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', padding: '12px', textAlign: 'center' }}>
                No MCP servers connected
              </div>
            ) : (
              servers.map(serverName => (
                <div
                  key={serverName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'rgba(100, 200, 255, 0.08)',
                    border: '1px solid rgba(100, 200, 255, 0.2)',
                    borderRadius: '6px',
                    marginBottom: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'rgba(100, 255, 150, 0.8)'
                    }}></div>
                    <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                      {serverName}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveServer(serverName)}
                    style={{
                      background: 'rgba(255, 100, 100, 0.2)',
                      border: '1px solid rgba(255, 100, 100, 0.3)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '9px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Available Tools */}
          <div style={{ marginBottom: '16px', flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Available Tools ({tools.length})
            </div>
            {tools.map((tool, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '4px',
                  marginBottom: '4px',
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => toggleTool(idx)}
                  style={{
                    padding: '8px 10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ fontSize: '9px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' }}>
                    {tool.name}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    transform: expandedTools[idx] ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </div>
                </div>
                {expandedTools[idx] && (
                  <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                      {tool.description || 'No description'}
                    </div>
                    {tool.inputSchema && tool.inputSchema.properties && (
                      <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '8px' }}>
                        <div style={{ marginBottom: '4px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.7)' }}>
                          Parameters:
                        </div>
                        {Object.entries(tool.inputSchema.properties).map(([key, value]) => (
                          <div key={key} style={{ marginLeft: '8px', marginBottom: '4px' }}>
                            <span style={{ color: 'rgba(100, 200, 255, 0.8)' }}>{key}</span>
                            {value.description && (
                              <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}> - {value.description}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: '8px', color: 'rgba(100, 200, 255, 0.6)', marginTop: '8px' }}>
                      from: {tool.serverName}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Server Button */}
          <button
            onClick={() => showCustomDialog('mcp')}
            style={{
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '10px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            + Add MCP Server
          </button>
        </>
      ) : (
        <>
          {/* RAG Panel */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {pythonBackendStatus === 'offline' ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '16px' }}>
                  Python MCP Backend is offline
                </div>
                <button
                  onClick={startPythonBackend}
                  disabled={starting}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(100, 255, 150, 0.2)',
                    border: '1px solid rgba(100, 255, 150, 0.4)',
                    borderRadius: '6px',
                    color: 'rgba(100, 255, 150, 0.95)',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: starting ? 'not-allowed' : 'pointer',
                    opacity: starting ? 0.5 : 1
                  }}
                >
                  {starting ? '⏳ Starting Server...' : '🚀 Start Python Backend'}
                </button>
              </div>
            ) : (
              <>
                {/* RAG Statistics */}
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(100, 200, 255, 0.05)', border: '1px solid rgba(100, 200, 255, 0.2)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '10px', color: 'rgba(255, 255, 255, 0.9)' }}>
                    📊 RAG Statistics
                  </div>
                  {ragStats ? (
                    <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(100, 200, 255, 0.8)' }}>Documents:</span> {ragStats.total_documents}
                      </div>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(100, 200, 255, 0.8)' }}>LLM Model:</span> {ragStats.llm_model}
                      </div>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(100, 200, 255, 0.8)' }}>Embedding:</span> {ragStats.embedding_model}
                      </div>
                      <div>
                        <span style={{ color: 'rgba(100, 200, 255, 0.8)' }}>Collection:</span> {ragStats.collection_name}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)' }}>
                      Loading statistics...
                    </div>
                  )}
                </div>

                {/* RAG Info */}
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.9)' }}>
                    💡 How to use RAG
                  </div>
                  <div style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.6' }}>
                    1. Index your documents using the chat panel<br/>
                    2. Enable RAG toggle when chatting<br/>
                    3. Ask questions about your documents<br/>
                    4. Get answers with source citations
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={loadRAGStats}
                    style={{
                      padding: '10px',
                      background: 'rgba(100, 200, 255, 0.1)',
                      border: '1px solid rgba(100, 200, 255, 0.3)',
                      borderRadius: '6px',
                      color: 'rgba(100, 200, 255, 0.95)',
                      fontSize: '10px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Refresh Statistics
                  </button>
                  <button
                    onClick={clearRAGIndex}
                    style={{
                      padding: '10px',
                      background: 'rgba(255, 100, 100, 0.1)',
                      border: '1px solid rgba(255, 100, 100, 0.3)',
                      borderRadius: '6px',
                      color: 'rgba(255, 100, 100, 0.95)',
                      fontSize: '10px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Clear All Documents
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Separate MCP Dialog Component (unchanged)
export function MCPDialog({ onClose }) {
  const [newServer, setNewServer] = useState({
    name: '',
    command: 'npx',
    args: '',
    env: ''
  });

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.command) return;

    const args = newServer.args.split(',').map(a => a.trim()).filter(Boolean);
    let env = null;

    if (newServer.env) {
      try {
        env = JSON.parse(`{${newServer.env}}`);
      } catch (e) {
        alert('Invalid JSON format for environment variables');
        return;
      }
    }

    const result = await window.panelAPI.saveMCPServer({
      name: newServer.name,
      command: newServer.command,
      args,
      env
    });

    if (result.success) {
      onClose();
    } else {
      alert(`Failed to add server: ${result.error}`);
    }
  };

  return (
    <div
      className="dialog-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        pointerEvents: 'all'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: '500px',
          background: 'rgba(20, 20, 25, 0.98)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)'
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: 'rgba(255, 255, 255, 0.95)' }}>
          Add MCP Server
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '6px' }}>
            Server Name
          </label>
          <input
            type="text"
            value={newServer.name}
            onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
            placeholder="filesystem"
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '10px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '6px' }}>
            Command
          </label>
          <select
            value={newServer.command}
            onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '10px',
              outline: 'none'
            }}
          >
            <option value="npx">npx</option>
            <option value="node">node</option>
            <option value="python">python</option>
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '6px' }}>
            Arguments (comma-separated)
          </label>
          <input
            type="text"
            value={newServer.args}
            onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
            placeholder="-y, @modelcontextprotocol/server-filesystem, /path/to/dir"
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '10px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '6px' }}>
            Environment Variables (optional, JSON format)
          </label>
          <input
            type="text"
            value={newServer.env}
            onChange={(e) => setNewServer({ ...newServer, env: e.target.value })}
            placeholder='"GITHUB_TOKEN": "your-token"'
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '10px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAddServer}
            style={{
              padding: '8px 16px',
              background: 'rgba(100, 200, 255, 0.2)',
              border: '1px solid rgba(100, 200, 255, 0.4)',
              borderRadius: '8px',
              color: 'rgba(100, 200, 255, 0.95)',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Add Server
          </button>
        </div>
      </div>
    </div>
  );
}
