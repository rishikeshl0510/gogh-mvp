const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('commandAPI', {
  hide: () => ipcRenderer.invoke('hide-command'),
  searchAI: (query) => ipcRenderer.invoke('search-ai', query),
  searchGoogle: (query) => ipcRenderer.invoke('search-google', query),
  searchLocal: (query) => ipcRenderer.invoke('search-local', query),
  executeResult: (result) => ipcRenderer.invoke('execute-result', result),
  onAISearchChunk: (callback) => ipcRenderer.on('ai-search-chunk', (_, chunk) => callback(chunk))
});