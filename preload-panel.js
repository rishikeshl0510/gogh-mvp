const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('panelAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  addFile: (file) => ipcRenderer.invoke('add-file', file),
  removeFile: (id) => ipcRenderer.invoke('remove-file', id),
  openFile: (path) => ipcRenderer.invoke('open-file', path),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  addBookmark: (bookmark) => ipcRenderer.invoke('add-bookmark', bookmark),
  removeBookmark: (id) => ipcRenderer.invoke('remove-bookmark', id),
  openBookmark: (url) => ipcRenderer.invoke('open-bookmark', url),
  addApp: (app) => ipcRenderer.invoke('add-app', app),
  removeApp: (id) => ipcRenderer.invoke('remove-app', id),
  launchApp: (path) => ipcRenderer.invoke('launch-app', path),
  addTask: (task) => ipcRenderer.invoke('add-task', task),
  toggleTask: (id) => ipcRenderer.invoke('toggle-task', id),
  deleteTask: (id) => ipcRenderer.invoke('delete-task', id),
  addEvent: (evt) => ipcRenderer.invoke('add-event', evt),
  switchMode: (id) => ipcRenderer.invoke('switch-mode', id),
  openModeSelector: () => ipcRenderer.invoke('open-mode-selector'),
  onSetPanel: (callback) => ipcRenderer.on('set-panel', (_, section) => callback(section)),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});