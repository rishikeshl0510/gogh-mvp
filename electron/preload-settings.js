const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('settingsAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  addSearchDirectory: () => ipcRenderer.invoke('add-search-directory'),
  removeSearchDirectory: (dir) => ipcRenderer.invoke('remove-search-directory', dir),
  deleteAllData: () => ipcRenderer.invoke('delete-all-data')
});