const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('modeAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  switchMode: (id) => ipcRenderer.invoke('switch-mode', id),
  addMode: (mode) => ipcRenderer.invoke('add-mode', mode),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});