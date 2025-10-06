const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sidebarAPI', {
  openPanel: (section) => ipcRenderer.invoke('open-panel', section),
  openGraphView: () => ipcRenderer.invoke('open-graph-view'),
  openModeSelector: () => ipcRenderer.invoke('open-mode-selector'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  getData: () => ipcRenderer.invoke('get-data'),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});