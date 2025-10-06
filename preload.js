const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
  
  // MCP Functions
  mcpExecute: (tool, params) => ipcRenderer.invoke('mcp-execute', { tool, params }),
  mcpListTools: () => ipcRenderer.invoke('mcp-list-tools'),
  
  // AI Chat with Gemini
  aiChat: (messages, model) => ipcRenderer.invoke('ai-chat', { messages, model }),
  
  // Platform info
  platform: process.platform,
  
  // Window events
  onWindowShown: (callback) => ipcRenderer.on('window-shown', callback),
  onWindowHidden: (callback) => ipcRenderer.on('window-hidden', callback)
});
