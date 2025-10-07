const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('graphAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});