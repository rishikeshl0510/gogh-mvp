const fs = require('fs');

console.log('🔧 Final fixes: Graph + Natural Language Tasks...\n');

const files = {};

// FIXED MAIN.JS - Check if panel exists before closing
files['main.js'] = `const { app, BrowserWindow, globalShortcut, screen, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
require('dotenv').config();

let sidebarWindow = null;
let panelWindow = null;
let modeWindow = null;
let commandWindow = null;
let graphWindow = null;
let settingsWindow = null;
let currentPanel = null;

const DB_PATH = path.join(app.getPath('userData'), 'gogh-data.json');
const BOOKMARKS_DIR = path.join(app.getPath('userData'), 'bookmarks');
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

Menu.setApplicationMenu(null);

if (!fs.existsSync(BOOKMARKS_DIR)) {
  fs.mkdirSync(BOOKMARKS_DIR, { recursive: true });
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Settings load error:', e);
  }
  
  const homeDir = os.homedir();
  let searchDirs = [];
  
  if (process.platform === 'darwin') {
    searchDirs = [
      path.join(homeDir, 'Documents'),
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Downloads')
    ];
  } else if (process.platform === 'win32') {
    searchDirs = [
      path.join(homeDir, 'Documents'),
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Downloads')
    ];
  } else {
    searchDirs = [homeDir];
  }
  
  return { searchDirectories: searchDirs };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return true;
  } catch (e) {
    console.error('Settings save error:', e);
    return false;
  }
}

let settings = loadSettings();

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      if (!data.apps) data.apps = [];
      if (!data.files) data.files = [];
      if (!data.bookmarks) data.bookmarks = [];
      if (!data.tasks) data.tasks = [];
      if (!data.events) data.events = [];
      if (!data.connections) data.connections = [];
      if (!data.modes) data.modes = [{ id: 'default', name: 'Work', color: '#ffffff' }];
      if (!data.currentMode) data.currentMode = 'default';
      return data;
    }
  } catch (e) {
    console.error('DB load error:', e);
  }
  return {
    modes: [
      { id: 'default', name: 'Work', color: '#ffffff' },
      { id: 'personal', name: 'Personal', color: '#cccccc' }
    ],
    files: [],
    bookmarks: [],
    apps: [],
    tasks: [],
    events: [],
    connections: [],
    currentMode: 'default'
  };
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('DB save error:', e);
    return false;
  }
}

let database = loadDatabase();

// Parse natural language task using Gemini
async function parseTaskNaturalLanguage(text) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return null;
  }
  
  try {
    const prompt = \`Extract task details from this text: "\${text}"
Return ONLY a JSON object with this exact format (no markdown, no extra text):
{
  "title": "task title",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}

Examples:
- "Buy groceries tomorrow" -> {"title": "Buy groceries", "startDate": "2025-10-07", "endDate": "2025-10-07"}
- "Finish project by next Friday" -> {"title": "Finish project", "startDate": "2025-10-06", "endDate": "2025-10-11"}
- "Call mom in 2 days" -> {"title": "Call mom", "startDate": "2025-10-08", "endDate": "2025-10-08"}

Today is \${new Date().toISOString().split('T')[0]}\`;

    const response = await axios.post(
      \`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=\${process.env.GEMINI_API_KEY}\`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      }
    );
    
    let responseText = response.data.candidates[0].content.parts[0].text;
    responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    
    const parsed = JSON.parse(responseText);
    return parsed;
  } catch (error) {
    console.error('Task parsing error:', error.message);
    return null;
  }
}

// AI Search
async function searchWithAI(query) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return [];
  }
  
  try {
    const response = await axios.post(
      \`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=\${process.env.GEMINI_API_KEY}\`,
      {
        contents: [{
          parts: [{ text: \`Answer concisely in 1-2 sentences: \${query}\` }]
        }]
      }
    );
    
    const text = response.data.candidates[0].content.parts[0].text;
    return [{
      type: 'ai',
      title: 'AI Response',
      description: text,
      action: 'copy'
    }];
  } catch (error) {
    console.error('AI search error:', error.message);
    return [];
  }
}

// Google Search
async function searchWithGoogle(query) {
  if (!process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_SEARCH_API_KEY === 'your_google_api_key_here') {
    return [];
  }
  
  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: process.env.GOOGLE_SEARCH_API_KEY,
        cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: 5
      }
    });
    
    if (response.data.items) {
      return response.data.items.map(item => ({
        type: 'web',
        title: item.title,
        description: item.snippet,
        url: item.link,
        action: 'open_url'
      }));
    }
    return [];
  } catch (error) {
    console.error('Google search error:', error.message);
    return [];
  }
}

// Local file search
async function searchLocalFiles(query) {
  const results = [];
  const searchDirs = settings.searchDirectories || [];
  
  for (const dir of searchDirs) {
    try {
      const files = await searchDirectory(dir, query, 0, 2);
      results.push(...files);
      if (results.length >= 10) break;
    } catch (e) {
      // Skip
    }
  }
  
  return results.slice(0, 10).map(file => ({
    type: file.isDirectory ? 'folder' : 'file',
    title: file.name,
    description: file.path,
    path: file.path,
    action: 'open_file'
  }));
}

async function searchDirectory(dir, query, currentDepth, maxDepth) {
  if (currentDepth >= maxDepth) return [];
  
  const results = [];
  try {
    const items = fs.readdirSync(dir);
    const lowerQuery = query.toLowerCase();
    
    for (const item of items) {
      if (item.startsWith('.')) continue;
      
      const fullPath = path.join(dir, item);
      
      if (item.toLowerCase().includes(lowerQuery)) {
        const stat = fs.statSync(fullPath);
        results.push({
          name: item,
          path: fullPath,
          isDirectory: stat.isDirectory(),
          size: stat.size
        });
      }
      
      if (results.length >= 10) break;
    }
  } catch (e) {
    // Skip
  }
  
  return results;
}

// Search apps
async function searchApps(query) {
  if (!database || !database.apps || !Array.isArray(database.apps)) {
    return [];
  }
  
  const lowerQuery = query.toLowerCase();
  const filteredApps = database.apps.filter(app => 
    app && app.name && app.name.toLowerCase().includes(lowerQuery)
  );
  
  return filteredApps.map(app => ({
    type: 'app',
    title: app.name,
    description: app.path,
    path: app.path,
    action: 'launch_app'
  }));
}

function createSidebar() {
  const { height } = screen.getPrimaryDisplay().workAreaSize;
  sidebarWindow = new BrowserWindow({
    width: 56,
    height: 250,
    x: 20,
    y: Math.round((height - 250) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-sidebar.js')
    }
  });
  sidebarWindow.loadFile('sidebar.html');
  sidebarWindow.setAlwaysOnTop(true, 'floating', 1);
}

function createPanel(section) {
  if (panelWindow && currentPanel === section) {
    if (!panelWindow.isDestroyed()) {
      panelWindow.close();
    }
    panelWindow = null;
    currentPanel = null;
    return;
  }
  
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.close();
  }
  
  const { height } = screen.getPrimaryDisplay().workAreaSize;
  panelWindow = new BrowserWindow({
    width: 420,
    height: height - 80,
    x: 86,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-panel.js')
    }
  });
  
  panelWindow.loadFile('panel.html');
  panelWindow.webContents.once('did-finish-load', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send('set-panel', section);
    }
  });
  
  currentPanel = section;
  panelWindow.on('close', () => {
    panelWindow = null;
    currentPanel = null;
  });
}

function createModeSelector() {
  if (modeWindow) {
    if (!modeWindow.isDestroyed()) {
      modeWindow.close();
    }
    modeWindow = null;
    return;
  }
  
  const { height } = screen.getPrimaryDisplay().workAreaSize;
  modeWindow = new BrowserWindow({
    width: 240,
    height: 280,
    x: 86,
    y: Math.round((height - 280) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-mode.js')
    }
  });
  
  modeWindow.loadFile('mode.html');
  modeWindow.on('close', () => {
    modeWindow = null;
  });
}

function createGraphView() {
  // FIXED: Close panel first, check if exists
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.close();
    panelWindow = null;
    currentPanel = null;
  }
  
  if (graphWindow) {
    if (!graphWindow.isDestroyed()) {
      graphWindow.close();
    }
    graphWindow = null;
    return;
  }
  
  const { height } = screen.getPrimaryDisplay().workAreaSize;
  graphWindow = new BrowserWindow({
    width: 420,
    height: height - 80,
    x: 86,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-graph.js')
    }
  });
  
  graphWindow.loadFile('graph.html');
  graphWindow.on('close', () => {
    graphWindow = null;
  });
}

function createSettings() {
  if (settingsWindow) {
    if (!settingsWindow.isDestroyed()) {
      settingsWindow.focus();
    }
    return;
  }
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    x: Math.round((width - 600) / 2),
    y: Math.round((height - 500) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-settings.js')
    }
  });
  
  settingsWindow.loadFile('settings.html');
  settingsWindow.on('close', () => {
    settingsWindow = null;
  });
}

function createCommandPalette() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  commandWindow = new BrowserWindow({
    width: 700,
    height: 520,
    x: Math.round((width - 700) / 2),
    y: Math.round((height - 520) / 3),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-command.js')
    }
  });
  commandWindow.loadFile('command.html');
  commandWindow.on('blur', () => {
    if (commandWindow && !commandWindow.isDestroyed()) {
      commandWindow.hide();
    }
  });
}

function toggleCommand() {
  if (!commandWindow || commandWindow.isDestroyed()) {
    createCommandPalette();
    return;
  }
  
  if (commandWindow.isVisible()) {
    commandWindow.hide();
  } else {
    commandWindow.show();
    commandWindow.focus();
  }
}

function broadcastUpdate() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send('data-updated');
  }
  if (sidebarWindow && !sidebarWindow.isDestroyed()) {
    sidebarWindow.webContents.send('data-updated');
  }
  if (modeWindow && !modeWindow.isDestroyed()) {
    modeWindow.webContents.send('data-updated');
  }
  if (graphWindow && !graphWindow.isDestroyed()) {
    graphWindow.webContents.send('data-updated');
  }
}

app.whenReady().then(() => {
  createSidebar();
  createCommandPalette();
  
  const cmdShortcut = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Space';
  globalShortcut.register(cmdShortcut, toggleCommand);
  
  globalShortcut.register('Escape', () => {
    if (panelWindow && !panelWindow.isDestroyed()) panelWindow.close();
    if (modeWindow && !modeWindow.isDestroyed()) modeWindow.close();
    if (graphWindow && !graphWindow.isDestroyed()) graphWindow.close();
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
  });
  
  console.log('✅ Gogh Ready');
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('open-panel', (_, section) => { createPanel(section); return true; });
ipcMain.handle('open-mode-selector', () => { createModeSelector(); return true; });
ipcMain.handle('open-graph-view', () => { createGraphView(); return true; });
ipcMain.handle('open-settings', () => { createSettings(); return true; });
ipcMain.handle('get-data', () => database);
ipcMain.handle('get-settings', () => settings);

// Parse task with AI
ipcMain.handle('parse-task', async (_, text) => {
  return await parseTaskNaturalLanguage(text);
});

// Separate search handlers
ipcMain.handle('search-ai', async (_, query) => {
  return await searchWithAI(query);
});

ipcMain.handle('search-google', async (_, query) => {
  return await searchWithGoogle(query);
});

ipcMain.handle('search-local', async (_, query) => {
  const fileResults = await searchLocalFiles(query);
  const appResults = await searchApps(query);
  return { files: fileResults, apps: appResults };
});

// Execute search result
ipcMain.handle('execute-result', async (_, result) => {
  switch (result.action) {
    case 'open_file':
      await shell.openPath(result.path);
      break;
    case 'launch_app':
      await shell.openPath(result.path);
      break;
    case 'open_url':
      await shell.openExternal(result.url);
      break;
  }
  return true;
});

// Settings
ipcMain.handle('add-search-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths.length > 0) {
    settings.searchDirectories.push(result.filePaths[0]);
    saveSettings(settings);
    return settings;
  }
  return settings;
});

ipcMain.handle('remove-search-directory', (_, dir) => {
  settings.searchDirectories = settings.searchDirectories.filter(d => d !== dir);
  saveSettings(settings);
  return settings;
});

// File operations
ipcMain.handle('add-file', (_, file) => {
  database.files.push(file);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('remove-file', (_, id) => {
  database.files = database.files.filter(f => f.id !== id);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('open-file', async (_, filePath) => {
  if (!filePath || filePath === 'undefined') return false;
  try {
    await shell.openPath(filePath);
    return true;
  } catch (error) {
    console.error('Error opening file:', error);
    return false;
  }
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
  return result.filePaths;
});

// Bookmark operations
ipcMain.handle('add-bookmark', (_, bookmark) => {
  const bookmarkFile = path.join(BOOKMARKS_DIR, \`\${bookmark.id}.json\`);
  fs.writeFileSync(bookmarkFile, JSON.stringify(bookmark, null, 2));
  database.bookmarks.push(bookmark);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('remove-bookmark', (_, id) => {
  const bookmarkFile = path.join(BOOKMARKS_DIR, \`\${id}.json\`);
  if (fs.existsSync(bookmarkFile)) fs.unlinkSync(bookmarkFile);
  database.bookmarks = database.bookmarks.filter(b => b.id !== id);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('open-bookmark', (_, url) => {
  if (!url || url === 'undefined') return false;
  shell.openExternal(url);
  return true;
});

// App operations
ipcMain.handle('add-app', (_, app) => {
  database.apps.push(app);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('remove-app', (_, id) => {
  database.apps = database.apps.filter(a => a.id !== id);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('launch-app', async (_, appPath) => {
  if (!appPath || appPath === 'undefined') return false;
  try {
    await shell.openPath(appPath);
    return true;
  } catch (error) {
    console.error('Error launching app:', error);
    return false;
  }
});

// Connection operations
ipcMain.handle('add-connection', (_, connection) => {
  database.connections.push(connection);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('remove-connection', (_, id) => {
  database.connections = database.connections.filter(c => c.id !== id);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

// Task operations
ipcMain.handle('add-task', (_, task) => {
  database.tasks.push(task);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('toggle-task', (_, id) => {
  const task = database.tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    if (task.completed) {
      task.completedAt = new Date().toISOString();
    }
    saveDatabase(database);
    broadcastUpdate();
  }
  return database;
});

ipcMain.handle('delete-task', (_, id) => {
  database.tasks = database.tasks.filter(t => t.id !== id);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

// Mode operations
ipcMain.handle('add-mode', (_, mode) => {
  database.modes.push(mode);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('switch-mode', (_, id) => {
  database.currentMode = id;
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('hide-command', () => {
  if (commandWindow && !commandWindow.isDestroyed()) {
    commandWindow.hide();
  }
  return true;
});
`;

// FIXED PRELOAD-PANEL.JS - Add parseTask
files['preload-panel.js'] = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('panelAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  parseTask: (text) => ipcRenderer.invoke('parse-task', text),
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
  switchMode: (id) => ipcRenderer.invoke('switch-mode', id),
  openModeSelector: () => ipcRenderer.invoke('open-mode-selector'),
  onSetPanel: (callback) => ipcRenderer.on('set-panel', (_, section) => callback(section)),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});`;

// UPDATED RENDERER-PANEL.JS - Natural language task input
files['renderer-panel.js'] = `let data = null;
let currentSection = null;
let currentTab = 'files';

async function init() {
  data = await window.panelAPI.getData();
  
  window.panelAPI.onSetPanel(async (section) => {
    currentSection = section;
    data = await window.panelAPI.getData();
    render();
  });
  
  window.panelAPI.onDataUpdated(async () => {
    data = await window.panelAPI.getData();
    render();
  });
}

function render() {
  document.getElementById('panelTitle').textContent = currentSection.toUpperCase();
  
  const currentMode = data.modes.find(m => m.id === data.currentMode);
  document.getElementById('modeIndicator').textContent = currentMode ? currentMode.name : 'Work';
  
  const content = document.getElementById('panelContent');
  
  if (currentSection === 'files') {
    renderFilesSection();
  } else if (currentSection === 'tasks') {
    renderTasks(content);
  }
}

function openModeSelector() {
  window.panelAPI.openModeSelector();
}

function renderFilesSection() {
  const tabsContainer = document.getElementById('tabsContainer');
  tabsContainer.classList.remove('hidden');
  tabsContainer.innerHTML = \`
    <div class="tab \${currentTab === 'files' ? 'active' : ''}" onclick="switchTab('files')">Files</div>
    <div class="tab \${currentTab === 'bookmarks' ? 'active' : ''}" onclick="switchTab('bookmarks')">Bookmarks</div>
    <div class="tab \${currentTab === 'apps' ? 'active' : ''}" onclick="switchTab('apps')">Apps</div>
  \`;
  
  const content = document.getElementById('panelContent');
  if (currentTab === 'files') renderFiles(content);
  else if (currentTab === 'bookmarks') renderBookmarks(content);
  else if (currentTab === 'apps') renderApps(content);
}

function switchTab(tab) {
  currentTab = tab;
  renderFilesSection();
}

function renderFiles(content) {
  const filtered = data.files.filter(f => f.mode === data.currentMode);
  content.innerHTML = \`
    <div class="drop-zone" id="drop">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 10c0-1.1-.9-2-2-2h-6.5l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V10z"/>
        <line x1="12" y1="13" x2="12" y2="19"/>
        <line x1="9" y1="16" x2="15" y2="16"/>
      </svg>
      Drop files here
    </div>
    <div>\${filtered.length ? filtered.map(f => \`
      <div class="file-item" onclick="openFile('\${f.path.replace(/\\\\/g, '\\\\\\\\')}')">
        <span class="file-icon">📄</span>
        <div class="file-info">
          <div class="file-name">\${f.name}</div>
        </div>
        <div class="file-delete" onclick="event.stopPropagation();removeFile('\${f.id}')">×</div>
      </div>
    \`).join('') : '<div class="empty">NO FILES</div>'}</div>
    <button class="btn" onclick="addFiles()">+ ADD FILES</button>
  \`;
  setupDrop();
}

function renderBookmarks(content) {
  const filtered = data.bookmarks.filter(b => b.mode === data.currentMode);
  content.innerHTML = \`
    <div class="quick-add">
      <input type="text" id="bookmarkUrl" class="input" placeholder="Paste URL (https://...)">
      <button class="btn" onclick="addBookmark()">+ ADD</button>
    </div>
    <div>\${filtered.length ? filtered.map(b => \`
      <div class="file-item" onclick="openBookmark('\${b.url}')">
        <span class="file-icon">🔖</span>
        <div class="file-info">
          <div class="file-name">\${b.name || b.url}</div>
        </div>
        <div class="file-delete" onclick="event.stopPropagation();removeBookmark('\${b.id}')">×</div>
      </div>
    \`).join('') : '<div class="empty">NO BOOKMARKS</div>'}</div>
  \`;
}

function renderApps(content) {
  const filtered = data.apps.filter(a => a.mode === data.currentMode);
  content.innerHTML = \`
    <button class="btn" onclick="addApp()" style="margin-bottom:20px">+ ADD APP</button>
    <div>\${filtered.length ? filtered.map(a => \`
      <div class="file-item" onclick="launchApp('\${a.path.replace(/\\\\/g, '\\\\\\\\')}')">
        <span class="file-icon">⚡</span>
        <div class="file-info">
          <div class="file-name">\${a.name}</div>
        </div>
        <div class="file-delete" onclick="event.stopPropagation();removeApp('\${a.id}')">×</div>
      </div>
    \`).join('') : '<div class="empty">NO APPS</div>'}</div>
  \`;
}

function renderTasks(content) {
  document.getElementById('tabsContainer').classList.add('hidden');
  const filtered = data.tasks.filter(t => t.mode === data.currentMode);
  const active = filtered.filter(t => !t.completed);
  const completed = filtered.filter(t => t.completed);
  
  content.innerHTML = \`
    <div class="quick-add">
      <div style="background: rgba(100, 150, 255, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 11px; color: rgba(255,255,255,0.7);">
        💡 Type naturally: "Buy groceries tomorrow", "Finish project by Friday", "Call mom in 2 days"
      </div>
      <input type="text" id="taskInput" class="input" placeholder="What do you need to do? (e.g., Meeting with team next Monday)">
      <button class="btn" onclick="addTaskNatural()">+ ADD TASK</button>
    </div>
    <div>\${active.length ? active.map(t => {
      const now = new Date();
      const end = new Date(t.endDate);
      const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      const dueDateText = daysLeft > 0 ? \`\${daysLeft}d left\` : daysLeft === 0 ? 'Today' : 'Overdue';
      
      return \`
        <div class="file-item">
          <span onclick="toggleTask('\${t.id}')" style="cursor:pointer;font-size:20px">☐</span>
          <div class="file-info">
            <div class="file-name">\${t.title}</div>
            <div class="file-meta">\${new Date(t.startDate).toLocaleDateString()} - \${new Date(t.endDate).toLocaleDateString()} • \${dueDateText}</div>
          </div>
          <div class="file-delete" onclick="deleteTask('\${t.id}')">×</div>
        </div>
      \`;
    }).join('') : '<div class="empty">NO ACTIVE TASKS</div>'}</div>
    \${completed.length ? '<div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.2)"></div>' : ''}
    \${completed.map(t => \`
      <div class="file-item" style="opacity:0.5">
        <span onclick="toggleTask('\${t.id}')" style="cursor:pointer;font-size:20px">☑</span>
        <div class="file-info">
          <div class="file-name" style="text-decoration:line-through">\${t.title}</div>
          <div class="file-meta">Completed \${new Date(t.completedAt).toLocaleDateString()}</div>
        </div>
        <div class="file-delete" onclick="deleteTask('\${t.id}')">×</div>
      </div>
    \`).join('')}
  \`;
  
  const input = document.getElementById('taskInput');
  if (input) {
    input.focus();
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addTaskNatural();
    });
  }
}

function setupDrop() {
  const zone = document.getElementById('drop');
  if (!zone) return;
  
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });
  
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    
    for (const file of Array.from(e.dataTransfer.files)) {
      await window.panelAPI.addFile({
        id: Date.now() + Math.random(),
        name: file.name,
        path: file.path,
        mode: data.currentMode,
        date: new Date().toISOString()
      });
    }
  });
}

async function addFiles() {
  const paths = await window.panelAPI.selectFiles();
  for (const p of paths) {
    await window.panelAPI.addFile({
      id: Date.now() + Math.random(),
      name: p.split(/[\\\\\\/]/).pop(),
      path: p,
      mode: data.currentMode,
      date: new Date().toISOString()
    });
  }
}

async function openFile(filePath) {
  if (!filePath || filePath === 'undefined') {
    alert('File path is missing');
    return;
  }
  await window.panelAPI.openFile(filePath);
}

async function removeFile(id) {
  await window.panelAPI.removeFile(id);
}

async function addBookmark() {
  const urlInput = document.getElementById('bookmarkUrl');
  const url = urlInput.value.trim();
  if (!url) return;
  
  await window.panelAPI.addBookmark({
    id: Date.now(),
    name: url,
    url: url,
    mode: data.currentMode,
    date: new Date().toISOString()
  });
  urlInput.value = '';
}

async function openBookmark(url) {
  await window.panelAPI.openBookmark(url);
}

async function removeBookmark(id) {
  await window.panelAPI.removeBookmark(id);
}

async function addApp() {
  const paths = await window.panelAPI.selectFiles();
  if (paths.length > 0) {
    await window.panelAPI.addApp({
      id: Date.now(),
      name: paths[0].split(/[\\\\\\/]/).pop(),
      path: paths[0],
      mode: data.currentMode
    });
  }
}

async function launchApp(appPath) {
  await window.panelAPI.launchApp(appPath);
}

async function removeApp(id) {
  await window.panelAPI.removeApp(id);
}

async function addTaskNatural() {
  const input = document.getElementById('taskInput');
  if (!input || !input.value.trim()) return;
  
  const text = input.value.trim();
  input.disabled = true;
  input.placeholder = 'Processing with AI...';
  
  try {
    const parsed = await window.panelAPI.parseTask(text);
    
    if (parsed && parsed.title && parsed.startDate && parsed.endDate) {
      await window.panelAPI.addTask({
        id: Date.now(),
        title: parsed.title,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        mode: data.currentMode,
        completed: false,
        createdAt: new Date().toISOString()
      });
      input.value = '';
    } else {
      alert('Could not understand the task. Try: "Buy groceries tomorrow" or "Meeting next Friday"');
    }
  } catch (error) {
    alert('AI parsing failed. Check your Gemini API key in .env');
  }
  
  input.disabled = false;
  input.placeholder = 'What do you need to do?';
  input.focus();
}

async function toggleTask(id) {
  await window.panelAPI.toggleTask(id);
}

async function deleteTask(id) {
  await window.panelAPI.deleteTask(id);
}

init();`;

// Write files
console.log('Writing fixed files...\n');
Object.entries(files).forEach(([filename, content]) => {
  fs.writeFileSync(filename, content);
  console.log(`✓ ${filename}`);
});

console.log('\n✅ All fixed!');
console.log('\n🔧 Fixed:');
console.log('  • Graph view "object destroyed" error');
console.log('  • Graph closes panel properly before opening');
console.log('  • Natural language task creation with Gemini');
console.log('  • Simple text input: "Buy groceries tomorrow"');
console.log('\n💡 Examples:');
console.log('  • "Meeting with team next Monday"');
console.log('  • "Call mom in 2 days"');
console.log('  • "Finish project by Friday"');
console.log('\n▶️  Run: npm start');
