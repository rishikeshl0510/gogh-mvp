const { contextBridge, ipcRenderer } = require('electron');

// Handle click-through for widgets
window.addEventListener('DOMContentLoaded', () => {
  const updateClickThrough = () => {
    // If a dialog is open, disable click-through entirely
    const dialog = document.querySelector('.dialog-overlay');
    if (dialog) {
      ipcRenderer.send('set-click-through', false);
      return;
    }

    const widgets = document.querySelectorAll('.widget');
    let isOverWidget = false;

    widgets.forEach(widget => {
      const rect = widget.getBoundingClientRect();
      const mouseX = window.mouseX || 0;
      const mouseY = window.mouseY || 0;

      if (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      ) {
        isOverWidget = true;
      }
    });

    ipcRenderer.send('set-click-through', !isOverWidget);
  };

  document.addEventListener('mousemove', (e) => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;
    updateClickThrough();
  });

  // Update on widget changes
  const observer = new MutationObserver(updateClickThrough);
  observer.observe(document.body, { childList: true, subtree: true });
});

contextBridge.exposeInMainWorld('panelAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  clarifyIntent: (text) => ipcRenderer.invoke('clarify-intent', text),
  generateTasks: (intentText) => ipcRenderer.invoke('generate-tasks', intentText),
  addIntent: (intent) => ipcRenderer.invoke('add-intent', intent),
  deleteIntent: (id) => ipcRenderer.invoke('delete-intent', id),
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
  getInstalledApps: () => ipcRenderer.invoke('get-installed-apps'),
  addTask: (task) => ipcRenderer.invoke('add-task', task),
  addTasksBatch: (tasks) => ipcRenderer.invoke('add-tasks-batch', tasks),
  toggleTask: (id) => ipcRenderer.invoke('toggle-task', id),
  deleteTask: (id) => ipcRenderer.invoke('delete-task', id),
  attachToTask: (taskId, attachment) => ipcRenderer.invoke('attach-to-task', { taskId, attachment }),
  detachFromTask: (taskId, attachmentId) => ipcRenderer.invoke('detach-from-task', { taskId, attachmentId }),
  switchMode: (id) => ipcRenderer.invoke('switch-mode', id),
  addMode: (mode) => ipcRenderer.invoke('add-mode', mode),
  deleteMode: (id) => ipcRenderer.invoke('delete-mode', id),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  addSearchDirectory: () => ipcRenderer.invoke('add-search-directory'),
  removeSearchDirectory: (dir) => ipcRenderer.invoke('remove-search-directory', dir),
  resetDatabase: () => ipcRenderer.invoke('reset-database'),
  openModeSelector: () => ipcRenderer.invoke('open-mode-selector'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFileWorkspaces: (mode) => ipcRenderer.invoke('get-file-workspaces', mode),
  addFileWorkspace: (workspace) => ipcRenderer.invoke('add-file-workspace', workspace),
  removeFileWorkspace: (id) => ipcRenderer.invoke('remove-file-workspace', id),
  getFolderContents: (folderPath) => ipcRenderer.invoke('get-folder-contents', folderPath),
  showFileContextMenu: (item) => ipcRenderer.invoke('show-file-context-menu', item),
  enableComposer: (enabled) => ipcRenderer.invoke('enable-composer', enabled),
  tagFileWithAI: (filePath) => ipcRenderer.invoke('tag-file-with-ai', filePath),
  updateFileTags: (filePath, tags) => ipcRenderer.invoke('update-file-tags', filePath, tags),
  semanticFileSearch: (query) => ipcRenderer.invoke('semantic-file-search', query),
  readFileWithAI: (filePath) => ipcRenderer.invoke('read-file-with-ai', filePath),
  addFileToAI: (filePath) => ipcRenderer.invoke('add-file-to-ai', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  getFileProperties: (filePath) => ipcRenderer.invoke('get-file-properties', filePath),
  importBookmarksFromFolder: (folderPath) => ipcRenderer.invoke('import-bookmarks-from-folder', folderPath),
  onFileContextAction: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('file-context-action', listener);
    return () => ipcRenderer.removeListener('file-context-action', listener);
  },
  onSetPanel: (callback) => ipcRenderer.on('set-panel', (_, section) => callback(section)),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback),

  // Ollama APIs
  startOllama: () => ipcRenderer.invoke('start-ollama'),
  checkOllamaStatus: () => ipcRenderer.invoke('check-ollama-status'),
  chatWithOllama: (message) => ipcRenderer.invoke('chat-with-ollama', message),
  stopOllamaGeneration: () => ipcRenderer.invoke('stop-ollama-generation'),
  onOllamaChunk: (callback) => {
    const listener = (_, chunk) => callback(chunk);
    ipcRenderer.on('ollama-chunk', listener);
    return () => ipcRenderer.removeListener('ollama-chunk', listener);
  },
  onOllamaDone: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('ollama-done', listener);
    return () => ipcRenderer.removeListener('ollama-done', listener);
  },
  onOllamaDownloadProgress: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('ollama-download-progress', listener);
    return () => ipcRenderer.removeListener('ollama-download-progress', listener);
  },
  onOllamaLog: (callback) => {
    const listener = (_, message) => callback(message);
    ipcRenderer.on('ollama-log', listener);
    return () => ipcRenderer.removeListener('ollama-log', listener);
  },
  onOllamaThought: (callback) => {
    const listener = (_, thought) => callback(thought);
    ipcRenderer.on('ollama-thought', listener);
    return () => ipcRenderer.removeListener('ollama-thought', listener);
  },
  onToolCallStart: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('tool-call-start', listener);
    return () => ipcRenderer.removeListener('tool-call-start', listener);
  },
  onToolCallResult: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('tool-call-result', listener);
    return () => ipcRenderer.removeListener('tool-call-result', listener);
  },

  // Chat History APIs
  getChatHistory: (mode) => ipcRenderer.invoke('get-chat-history', mode),
  saveChatHistory: (mode, messages) => ipcRenderer.invoke('save-chat-history', { mode, messages }),
  clearChatHistory: (mode) => ipcRenderer.invoke('clear-chat-history', mode),

  // Export APIs
  exportResponse: (content, format) => ipcRenderer.invoke('export-response', { content, format }),

  // MCP APIs
  getMCPConfig: () => ipcRenderer.invoke('get-mcp-config'),
  saveMCPServer: (config) => ipcRenderer.invoke('save-mcp-server', config),
  removeMCPServer: (serverName) => ipcRenderer.invoke('remove-mcp-server', serverName),
  getMCPTools: () => ipcRenderer.invoke('get-mcp-tools'),
  getMCPServers: () => ipcRenderer.invoke('get-mcp-servers'),
  callMCPTool: (toolName, args) => ipcRenderer.invoke('call-mcp-tool', { toolName, args })
});
