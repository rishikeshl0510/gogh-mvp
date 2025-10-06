const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('commandAPI', {
  hide: () => ipcRenderer.invoke('hide-command'),
  unifiedSearch: (query) => ipcRenderer.invoke('unified-search', query),
  executeResult: (result) => ipcRenderer.invoke('execute-result', result)
});