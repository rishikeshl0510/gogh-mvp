const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sidebarAPI', {
  openPanel: (section) => ipcRenderer.invoke('open-panel', section),
  openModeSelector: () => ipcRenderer.invoke('open-mode-selector'),
  getData: () => ipcRenderer.invoke('get-data'),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});