const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('commandAPI', {
  hide: () => ipcRenderer.invoke('hide-command'),
  searchLocal: (query) => ipcRenderer.invoke('search-local', query),
  openFile: (path) => ipcRenderer.invoke('open-file', path)
});