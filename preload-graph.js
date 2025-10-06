const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('graphAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  addConnection: (connection) => ipcRenderer.invoke('add-connection', connection),
  removeConnection: (id) => ipcRenderer.invoke('remove-connection', id),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});