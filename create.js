const fs = require('fs');
const path = require('path');

console.log('🔧 Creating COMPLETE Gogh System with AI...\n');

const files = {};

// ============================================
// .ENV
// ============================================
files['.env'] = `GEMINI_API_KEY=your_gemini_api_key_here
COMPOSIO_API_KEY=your_composio_api_key_here
GOOGLE_SEARCH_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here`;

// ============================================
// PACKAGE.JSON
// ============================================
files['package.json'] = `{
  "name": "gogh",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "dependencies": {
    "electron": "^33.0.0",
    "dotenv": "^16.4.5",
    "axios": "^1.6.0"
  }
}`;

// ============================================
// MAIN.JS - COMPLETE
// ============================================
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
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
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
    
    return response.data.items.map(item => ({
      type: 'web',
      title: item.title,
      description: item.snippet,
      url: item.link,
      action: 'open_url'
    }));
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
  const lowerQuery = query.toLowerCase();
  const filteredApps = database.apps.filter(app => 
    app.name.toLowerCase().includes(lowerQuery)
  );
  
  return filteredApps.map(app => ({
    type: 'app',
    title: app.name,
    description: app.path,
    path: app.path,
    action: 'launch_app'
  }));
}

// Combined search
async function unifiedSearch(query) {
  const [aiResults, googleResults, fileResults, appResults] = await Promise.all([
    searchWithAI(query),
    searchWithGoogle(query),
    searchLocalFiles(query),
    searchApps(query)
  ]);
  
  return {
    ai: aiResults,
    web: googleResults,
    files: fileResults,
    apps: appResults
  };
}

function createSidebar() {
  const { height } = screen.getPrimaryDisplay().workAreaSize;
  sidebarWindow = new BrowserWindow({
    width: 56,
    height: 280,
    x: 20,
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
      preload: path.join(__dirname, 'preload-sidebar.js')
    }
  });
  sidebarWindow.loadFile('sidebar.html');
  sidebarWindow.setAlwaysOnTop(true, 'floating', 1);
}

function createPanel(section) {
  if (panelWindow && currentPanel === section) {
    panelWindow.close();
    panelWindow = null;
    currentPanel = null;
    return;
  }
  
  if (panelWindow) panelWindow.close();
  
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
    modeWindow.close();
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
  if (graphWindow) {
    graphWindow.close();
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
  
  console.log('✅ Gogh Ready - AI Integrated');
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

// Unified search
ipcMain.handle('unified-search', async (_, query) => {
  return await unifiedSearch(query);
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

// SIDEBAR.HTML
files['sidebar.html'] = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Gogh</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: transparent;
      overflow: hidden;
      height: 100vh;
      -webkit-app-region: drag;
    }
    .sidebar {
      width: 56px;
      height: 280px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(20px) saturate(120%);
      -webkit-backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 0;
      gap: 4px;
    }
    .nav-item {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
      -webkit-app-region: no-drag;
      border-radius: 8px;
    }
    .nav-item:hover { background: rgba(255, 255, 255, 0.08); }
    .nav-item svg {
      width: 20px;
      height: 20px;
      stroke: #ffffff;
      stroke-width: 2;
      filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.5));
    }
    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ffffff;
      color: #000;
      padding: 2px 5px;
      border-radius: 8px;
      font-size: 9px;
      font-weight: bold;
      min-width: 16px;
      text-align: center;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
    }
    .divider {
      width: 30px;
      height: 1px;
      background: rgba(255, 255, 255, 0.2);
      margin: 4px 0;
    }
    .settings-btn {
      width: 40px;
      height: 40px;
      margin-top: auto;
      cursor: pointer;
      -webkit-app-region: no-drag;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .settings-btn:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .settings-btn svg {
      width: 18px;
      height: 18px;
      stroke: #ffffff;
      stroke-width: 2;
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="nav-item" onclick="openPanel('files')" title="Files">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
      <span class="badge" id="filesBadge">0</span>
    </div>
    
    <div class="nav-item" onclick="openPanel('tasks')" title="Tasks">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
      <span class="badge" id="tasksBadge">0</span>
    </div>
    
    <div class="nav-item" onclick="openGraphView()" title="Knowledge Graph">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="2"/>
        <circle cx="12" cy="5" r="2"/>
        <circle cx="19" cy="12" r="2"/>
        <circle cx="5" cy="12" r="2"/>
        <line x1="12" y1="7" x2="12" y2="10"/>
        <line x1="14" y1="12" x2="17" y2="12"/>
        <line x1="7" y1="12" x2="10" y2="12"/>
      </svg>
    </div>
    
    <div class="divider"></div>
    
    <div class="nav-item" onclick="openModeSelector()" title="Switch Mode">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6M1 12h6m6 0h6"/>
      </svg>
    </div>
    
    <div class="settings-btn" onclick="openSettings()" title="Settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6m8.66-15L15.5 8.5m-7 7L3.34 20.66M23 12h-6m-6 0H1m20.66-8.66L15.5 15.5m-7 7L3.34 3.34"/>
      </svg>
    </div>
  </div>
  <script src="renderer-sidebar.js"></script>
</body>
</html>`;

// COMMAND.HTML with categorized results
files['command.html'] = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Command Palette</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: transparent;
      overflow: hidden;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 20px;
      -webkit-app-region: drag;
    }
    .palette {
      width: 700px;
      background: rgba(0, 0, 0, 0.90);
      backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
      overflow: hidden;
    }
    .input-wrap {
      display: flex;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      -webkit-app-region: no-drag;
    }
    .prompt {
      color: #ffffff;
      font-weight: bold;
      margin-right: 10px;
      text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
    }
    input {
      flex: 1;
      background: transparent;
      border: none;
      color: #ffffff;
      font-size: 16px;
      font-family: 'Courier New', monospace;
      outline: none;
    }
    input::placeholder { color: rgba(255, 255, 255, 0.4); }
    
    .results-container {
      max-height: 450px;
      overflow-y: auto;
      padding: 8px;
    }
    .results-container::-webkit-scrollbar { width: 6px; }
    .results-container::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); }
    
    .category {
      margin-bottom: 16px;
    }
    .category-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.5;
      padding: 8px 12px;
      color: #ffffff;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      margin: 4px 0;
      transition: all 0.15s;
      border: 1px solid transparent;
    }
    .item:hover, .item.selected {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .item-icon {
      width: 36px;
      height: 36px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 18px;
    }
    .item-icon svg {
      width: 20px;
      height: 20px;
      stroke: #ffffff;
      stroke-width: 2;
    }
    .item-content {
      flex: 1;
      min-width: 0;
    }
    .item-title {
      font-size: 14px;
      font-weight: 500;
      color: #ffffff;
      margin-bottom: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-desc {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .loading {
      padding: 40px 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      font-size: 13px;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="palette">
    <div class="input-wrap">
      <span class="prompt">></span>
      <input id="input" placeholder="search AI, web, files, apps..." autocomplete="off">
    </div>
    <div id="results" class="results-container hidden"></div>
    <div id="loading" class="loading hidden">Searching...</div>
  </div>
  <script src="renderer-command.js"></script>
</body>
</html>`;

// Continue in next message due to length...
console.log('Writing files part 1...');
Object.entries(files).forEach(([filename, content]) => {
  fs.writeFileSync(filename, content);
  console.log(`✓ ${filename}`);
});

console.log('\n⏳ Creating remaining files...');
// PANEL.HTML with tabs and task duration
files['panel.html'] = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: transparent;
      overflow: hidden;
      height: 100vh;
      color: #ffffff;
    }
    .panel {
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(0, 0, 0, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title {
      font-size: 16px;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .title::before { content: '> '; opacity: 0.7; }
    .mode-indicator {
      font-size: 11px;
      padding: 4px 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .mode-indicator:hover { background: rgba(255, 255, 255, 0.15); }
    
    .tabs {
      display: flex;
      gap: 8px;
      padding: 12px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(0, 0, 0, 0.2);
    }
    .tab {
      padding: 6px 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: all 0.2s;
    }
    .tab:hover { background: rgba(255, 255, 255, 0.1); }
    .tab.active {
      background: #ffffff;
      color: #000;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
    }
    
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
    }
    .content::-webkit-scrollbar { width: 6px; }
    .content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
    
    .drop-zone {
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 20px;
      cursor: pointer;
      transition: all 0.3s;
      background: rgba(255, 255, 255, 0.02);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 12px;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }
    .drop-zone svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
    }
    
    .quick-add {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }
    .input-row {
      display: flex;
      gap: 8px;
    }
    .input {
      flex: 1;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: #ffffff;
      font-size: 13px;
      font-family: 'Courier New', monospace;
      outline: none;
    }
    .input:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: #ffffff;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
    }
    .input::placeholder { color: rgba(255, 255, 255, 0.4); }
    .input-small {
      width: 150px;
    }
    
    .btn {
      padding: 12px 20px;
      background: #ffffff;
      border: none;
      border-radius: 8px;
      color: #000;
      font-size: 13px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: all 0.2s;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
    }
    .btn:hover {
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
      transform: translateY(-1px);
    }
    
    .file-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .file-item:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateX(2px);
    }
    .file-icon {
      font-size: 18px;
    }
    .file-info {
      flex: 1;
      min-width: 0;
    }
    .file-name {
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-meta {
      font-size: 10px;
      opacity: 0.5;
      margin-top: 2px;
    }
    .file-delete {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid rgba(255, 0, 0, 0.3);
      border-radius: 4px;
      cursor: pointer;
      color: #ff4444;
      font-size: 14px;
    }
    
    .empty {
      padding: 60px 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.3);
      font-size: 13px;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="panel">
    <div class="header">
      <div class="title" id="panelTitle">Panel</div>
      <div class="mode-indicator" id="modeIndicator" onclick="openModeSelector()">Work</div>
    </div>
    <div id="tabsContainer" class="tabs hidden"></div>
    <div class="content" id="panelContent"></div>
  </div>
  <script src="renderer-panel.js"></script>
</body>
</html>`;

// MODE.HTML
files['mode.html'] = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Modes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: transparent;
      overflow: hidden;
      height: 100vh;
      color: #ffffff;
    }
    .mode-selector {
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mode-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.6;
      margin-bottom: 8px;
    }
    .mode-item {
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .mode-item:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.3);
    }
    .mode-item.active {
      background: #ffffff;
      color: #000;
      border-color: #ffffff;
      box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
    }
    .mode-name {
      font-size: 13px;
      font-weight: 500;
    }
    .mode-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .add-mode {
      padding: 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px dashed rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      cursor: pointer;
      text-align: center;
      font-size: 12px;
      opacity: 0.7;
      transition: all 0.2s;
      margin-top: auto;
    }
    .add-mode:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>
  <div class="mode-selector">
    <div class="mode-title">Select Mode</div>
    <div id="modeList"></div>
    <div class="add-mode" onclick="addMode()">+ New Mode</div>
  </div>
  <script src="renderer-mode.js"></script>
</body>
</html>`;

// GRAPH.HTML - Knowledge Graph
files['graph.html'] = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Knowledge Graph</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: transparent;
      overflow: hidden;
      height: 100vh;
      color: #ffffff;
    }
    .graph-container {
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .graph-header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .graph-title {
      font-size: 16px;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .graph-title::before { content: '> '; opacity: 0.7; }
    .close-btn {
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 20px;
    }
    .close-btn:hover {
      background: rgba(255, 0, 0, 0.2);
    }
    #graphCanvas {
      flex: 1;
      width: 100%;
    }
    .graph-info {
      padding: 10px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 10px;
      opacity: 0.5;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="graph-container">
    <div class="graph-header">
      <div class="graph-title">Knowledge Graph</div>
      <div class="close-btn" onclick="window.close()">×</div>
    </div>
    <canvas id="graphCanvas"></canvas>
    <div class="graph-info">Drag nodes • Double-click to connect • Right-click to delete connection</div>
  </div>
  <script src="renderer-graph.js"></script>
</body>
</html>`;

// SETTINGS.HTML
files['settings.html'] = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Settings</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: transparent;
      overflow: hidden;
      height: 100vh;
      color: #ffffff;
    }
    .settings-container {
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.90);
      backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .settings-header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .settings-title {
      font-size: 16px;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .settings-title::before { content: '> '; opacity: 0.7; }
    .close-btn {
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 20px;
    }
    .settings-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }
    .section-title {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.6;
      margin-bottom: 16px;
    }
    .dir-list {
      margin-bottom: 12px;
    }
    .dir-item {
      padding: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .remove-btn {
      padding: 4px 12px;
      background: rgba(255, 0, 0, 0.2);
      border: 1px solid rgba(255, 0, 0, 0.3);
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      color: #ff4444;
    }
    .add-btn {
      padding: 12px 20px;
      background: #ffffff;
      border: none;
      border-radius: 8px;
      color: #000;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      text-transform: uppercase;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="settings-container">
    <div class="settings-header">
      <div class="settings-title">Settings</div>
      <div class="close-btn" onclick="window.close()">×</div>
    </div>
    <div class="settings-content">
      <div class="section-title">Search Directories</div>
      <div class="dir-list" id="dirList"></div>
      <button class="add-btn" onclick="addDirectory()">+ Add Directory</button>
    </div>
  </div>
  <script src="renderer-settings.js"></script>
</body>
</html>`;

// ALL PRELOAD FILES
files['preload-sidebar.js'] = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sidebarAPI', {
  openPanel: (section) => ipcRenderer.invoke('open-panel', section),
  openGraphView: () => ipcRenderer.invoke('open-graph-view'),
  openModeSelector: () => ipcRenderer.invoke('open-mode-selector'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  getData: () => ipcRenderer.invoke('get-data'),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});`;

files['preload-panel.js'] = `const { contextBridge, ipcRenderer } = require('electron');
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
  switchMode: (id) => ipcRenderer.invoke('switch-mode', id),
  openModeSelector: () => ipcRenderer.invoke('open-mode-selector'),
  onSetPanel: (callback) => ipcRenderer.on('set-panel', (_, section) => callback(section)),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});`;

files['preload-mode.js'] = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('modeAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  switchMode: (id) => ipcRenderer.invoke('switch-mode', id),
  addMode: (mode) => ipcRenderer.invoke('add-mode', mode),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});`;

files['preload-command.js'] = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('commandAPI', {
  hide: () => ipcRenderer.invoke('hide-command'),
  unifiedSearch: (query) => ipcRenderer.invoke('unified-search', query),
  executeResult: (result) => ipcRenderer.invoke('execute-result', result)
});`;

files['preload-graph.js'] = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('graphAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  addConnection: (connection) => ipcRenderer.invoke('add-connection', connection),
  removeConnection: (id) => ipcRenderer.invoke('remove-connection', id),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});`;

files['preload-settings.js'] = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('settingsAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  addSearchDirectory: () => ipcRenderer.invoke('add-search-directory'),
  removeSearchDirectory: (dir) => ipcRenderer.invoke('remove-search-directory', dir)
});`;

// ALL RENDERER FILES - I'll continue in next message with these complete renderer scripts...

console.log('\n⏳ Writing part 2...');
Object.entries(files).forEach(([filename, content]) => {
  fs.writeFileSync(filename, content);
  console.log(`✓ ${filename}`);
});

// ============================================
// RENDERER FILES - PART 3
// ============================================

// RENDERER-SIDEBAR.JS
files['renderer-sidebar.js'] = `let data = null;

async function init() {
  data = await window.sidebarAPI.getData();
  updateBadges();
  
  window.sidebarAPI.onDataUpdated(async () => {
    data = await window.sidebarAPI.getData();
    updateBadges();
  });
}

function openPanel(section) {
  window.sidebarAPI.openPanel(section);
}

function openGraphView() {
  window.sidebarAPI.openGraphView();
}

function openModeSelector() {
  window.sidebarAPI.openModeSelector();
}

function openSettings() {
  window.sidebarAPI.openSettings();
}

function updateBadges() {
  const m = data.currentMode;
  const totalFiles = data.files.filter(f => f.mode === m).length + 
                     data.bookmarks.filter(b => b.mode === m).length + 
                     data.apps.filter(a => a.mode === m).length;
  
  document.getElementById('filesBadge').textContent = totalFiles;
  document.getElementById('tasksBadge').textContent = data.tasks.filter(t => t.mode === m && !t.completed).length;
}

init();`;

// RENDERER-PANEL.JS
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
      <input type="text" id="taskTitle" class="input" placeholder="Task title...">
      <div class="input-row">
        <input type="datetime-local" id="taskStart" class="input input-small" placeholder="Start">
        <input type="datetime-local" id="taskEnd" class="input input-small" placeholder="End">
        <button class="btn" onclick="addTask()">+ ADD</button>
      </div>
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

async function addTask() {
  const titleInput = document.getElementById('taskTitle');
  const startInput = document.getElementById('taskStart');
  const endInput = document.getElementById('taskEnd');
  
  if (!titleInput.value.trim() || !startInput.value || !endInput.value) {
    alert('Please fill all fields');
    return;
  }
  
  await window.panelAPI.addTask({
    id: Date.now(),
    title: titleInput.value,
    startDate: startInput.value,
    endDate: endInput.value,
    mode: data.currentMode,
    completed: false,
    createdAt: new Date().toISOString()
  });
  
  titleInput.value = '';
  startInput.value = '';
  endInput.value = '';
}

async function toggleTask(id) {
  await window.panelAPI.toggleTask(id);
}

async function deleteTask(id) {
  await window.panelAPI.deleteTask(id);
}

init();`;

// RENDERER-COMMAND.JS - With AI, Web, Files, Apps search
files['renderer-command.js'] = `const input = document.getElementById('input');
const resultsContainer = document.getElementById('results');
const loading = document.getElementById('loading');

let allResults = { ai: [], web: [], files: [], apps: [] };
let selectedIndex = -1;
let allItems = [];
let searchTimer = null;

input.focus();

input.addEventListener('input', async (e) => {
  const query = e.target.value.trim();
  
  if (!query) {
    resultsContainer.classList.add('hidden');
    loading.classList.add('hidden');
    return;
  }
  
  resultsContainer.classList.add('hidden');
  loading.classList.remove('hidden');
  
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    allResults = await window.commandAPI.unifiedSearch(query);
    showResults();
  }, 300);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectNext();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectPrev();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    executeSelected();
  } else if (e.key === 'Escape') {
    window.commandAPI.hide();
  }
});

function showResults() {
  loading.classList.add('hidden');
  
  allItems = [];
  let html = '';
  
  // AI Results
  if (allResults.ai && allResults.ai.length > 0) {
    html += '<div class="category"><div class="category-title">AI Response</div>';
    allResults.ai.forEach(item => {
      html += createItem(item, '🤖');
      allItems.push(item);
    });
    html += '</div>';
  }
  
  // Web Results
  if (allResults.web && allResults.web.length > 0) {
    html += '<div class="category"><div class="category-title">Web Results</div>';
    allResults.web.forEach(item => {
      html += createItem(item, '🌐');
      allItems.push(item);
    });
    html += '</div>';
  }
  
  // File Results
  if (allResults.files && allResults.files.length > 0) {
    html += '<div class="category"><div class="category-title">Files</div>';
    allResults.files.forEach(item => {
      const icon = item.type === 'folder' ? '📁' : '📄';
      html += createItem(item, icon);
      allItems.push(item);
    });
    html += '</div>';
  }
  
  // App Results
  if (allResults.apps && allResults.apps.length > 0) {
    html += '<div class="category"><div class="category-title">Apps</div>';
    allResults.apps.forEach(item => {
      html += createItem(item, '⚡');
      allItems.push(item);
    });
    html += '</div>';
  }
  
  if (html) {
    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
    selectedIndex = 0;
    updateSelection();
    
    // Add click handlers
    document.querySelectorAll('.item').forEach((el, i) => {
      el.onclick = () => {
        selectedIndex = i;
        executeSelected();
      };
    });
  } else {
    resultsContainer.innerHTML = '<div class="empty" style="padding:40px;text-align:center;color:rgba(255,255,255,0.3)">No results found</div>';
    resultsContainer.classList.remove('hidden');
  }
}

function createItem(item, icon) {
  return \`
    <div class="item">
      <div class="item-icon">\${icon}</div>
      <div class="item-content">
        <div class="item-title">\${item.title}</div>
        <div class="item-desc">\${item.description || ''}</div>
      </div>
    </div>
  \`;
}

function selectNext() {
  if (allItems.length === 0) return;
  selectedIndex = (selectedIndex + 1) % allItems.length;
  updateSelection();
}

function selectPrev() {
  if (allItems.length === 0) return;
  selectedIndex = selectedIndex <= 0 ? allItems.length - 1 : selectedIndex - 1;
  updateSelection();
}

function updateSelection() {
  document.querySelectorAll('.item').forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
    if (i === selectedIndex) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

async function executeSelected() {
  if (selectedIndex >= 0 && allItems[selectedIndex]) {
    await window.commandAPI.executeResult(allItems[selectedIndex]);
    window.commandAPI.hide();
  }
}`;

// RENDERER-MODE.JS
files['renderer-mode.js'] = `let data = null;

async function init() {
  data = await window.modeAPI.getData();
  render();
  
  window.modeAPI.onDataUpdated(async () => {
    data = await window.modeAPI.getData();
    render();
  });
}

function render() {
  const list = document.getElementById('modeList');
  list.innerHTML = data.modes.map(m => \`
    <div class="mode-item \${m.id === data.currentMode ? 'active' : ''}" onclick="switchMode('\${m.id}')">
      <span class="mode-name">\${m.name}</span>
      <span class="mode-indicator"></span>
    </div>
  \`).join('');
}

async function switchMode(id) {
  await window.modeAPI.switchMode(id);
  window.close();
}

async function addMode() {
  const name = prompt('Mode name:');
  if (name && name.trim()) {
    await window.modeAPI.addMode({
      id: 'mode_' + Date.now(),
      name: name.trim(),
      color: '#ffffff'
    });
  }
}

init();`;

// RENDERER-GRAPH.JS - Interactive Knowledge Graph
files['renderer-graph.js'] = `const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

let data = null;
let nodes = [];
let edges = [];
let selectedNode = null;
let connectFrom = null;
let isDragging = false;
let draggedNode = null;
let mouseX = 0;
let mouseY = 0;

function resizeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

async function init() {
  data = await window.graphAPI.getData();
  createGraph();
  animate();
  
  window.graphAPI.onDataUpdated(async () => {
    data = await window.graphAPI.getData();
    createGraph();
  });
}

function createGraph() {
  nodes = [];
  edges = [];
  
  const allItems = [
    ...data.files.map(f => ({ ...f, type: 'file', label: f.name })),
    ...data.tasks.map(t => ({ ...t, type: 'task', label: t.title })),
    ...data.bookmarks.map(b => ({ ...b, type: 'bookmark', label: b.name || b.url }))
  ];
  
  allItems.forEach((item, i) => {
    const angle = (i / allItems.length) * Math.PI * 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.3;
    
    nodes.push({
      id: item.id,
      x: canvas.width / 2 + Math.cos(angle) * radius,
      y: canvas.height / 2 + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      radius: 15,
      type: item.type,
      label: (item.label || 'Node').substring(0, 20)
    });
  });
  
  data.connections.forEach(conn => {
    const source = nodes.find(n => n.id === conn.from);
    const target = nodes.find(n => n.id === conn.to);
    if (source && target) {
      edges.push({ source, target, id: conn.id });
    }
  });
}

function applyForces() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  nodes.forEach(node => {
    // Center force
    node.vx += (centerX - node.x) * 0.0005;
    node.vy += (centerY - node.y) * 0.0005;
    
    // Repulsion
    nodes.forEach(other => {
      if (node === other) return;
      const dx = other.x - node.x;
      const dy = other.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 150) {
        const force = (150 - dist) / dist * 0.3;
        node.vx -= dx * force;
        node.vy -= dy * force;
      }
    });
    
    // Edge attraction
    edges.forEach(edge => {
      if (edge.source === node) {
        const dx = edge.target.x - node.x;
        const dy = edge.target.y - node.y;
        node.vx += dx * 0.005;
        node.vy += dy * 0.005;
      }
      if (edge.target === node) {
        const dx = edge.source.x - node.x;
        const dy = edge.source.y - node.y;
        node.vx += dx * 0.005;
        node.vy += dy * 0.005;
      }
    });
    
    // Apply velocity
    node.x += node.vx;
    node.y += node.vy;
    node.vx *= 0.85;
    node.vy *= 0.85;
    
    // Bounds
    node.x = Math.max(node.radius, Math.min(canvas.width - node.radius, node.x));
    node.y = Math.max(node.radius, Math.min(canvas.height - node.radius, node.y));
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw edges
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  edges.forEach(edge => {
    if (edge.source && edge.target) {
      ctx.beginPath();
      ctx.moveTo(edge.source.x, edge.source.y);
      ctx.lineTo(edge.target.x, edge.target.y);
      ctx.stroke();
    }
  });
  
  // Draw connection line
  if (connectFrom) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(connectFrom.x, connectFrom.y);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // Draw nodes
  nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    
    const colors = {
      file: 'rgba(100, 150, 255, 0.7)',
      task: 'rgba(100, 255, 150, 0.7)',
      bookmark: 'rgba(255, 150, 100, 0.7)'
    };
    
    ctx.fillStyle = colors[node.type] || 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
    
    ctx.strokeStyle = node === selectedNode ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = node === selectedNode ? 2 : 1;
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + node.radius + 10);
  });
}

function animate() {
  applyForces();
  draw();
  requestAnimationFrame(animate);
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  
  if (isDragging && draggedNode) {
    draggedNode.x = mouseX;
    draggedNode.y = mouseY;
    draggedNode.vx = 0;
    draggedNode.vy = 0;
  }
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  draggedNode = nodes.find(node => {
    const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
    return dist < node.radius;
  });
  
  if (draggedNode) {
    selectedNode = draggedNode;
    isDragging = true;
  }
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
  draggedNode = null;
});

canvas.addEventListener('dblclick', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const node = nodes.find(n => {
    const dist = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
    return dist < n.radius;
  });
  
  if (node) {
    if (!connectFrom) {
      connectFrom = node;
    } else if (connectFrom !== node) {
      window.graphAPI.addConnection({
        id: Date.now(),
        from: connectFrom.id,
        to: node.id
      });
      connectFrom = null;
    } else {
      connectFrom = null;
    }
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  edges.forEach((edge, i) => {
    const midX = (edge.source.x + edge.target.x) / 2;
    const midY = (edge.source.y + edge.target.y) / 2;
    const dist = Math.sqrt((midX - x) ** 2 + (midY - y) ** 2);
    
    if (dist < 10) {
      window.graphAPI.removeConnection(edge.id);
    }
  });
});

init();`;

// RENDERER-SETTINGS.JS
files['renderer-settings.js'] = `let settings = null;

async function init() {
  settings = await window.settingsAPI.getSettings();
  render();
}

function render() {
  const dirList = document.getElementById('dirList');
  dirList.innerHTML = settings.searchDirectories.map(dir => \`
    <div class="dir-item">
      <span>\${dir}</span>
      <span class="remove-btn" onclick="removeDirectory('\${dir.replace(/\\\\/g, '\\\\\\\\')}')">Remove</span>
    </div>
  \`).join('');
}

async function addDirectory() {
  settings = await window.settingsAPI.addSearchDirectory();
  render();
}

async function removeDirectory(dir) {
  settings = await window.settingsAPI.removeSearchDirectory(dir);
  render();
}

init();`;

// Write all files
console.log('Writing all files...');
let count = 0;
Object.entries(files).forEach(([filename, content]) => {
  fs.writeFileSync(filename, content);
  console.log('✓ ' + filename);
  count++;
});

console.log('\n✅ Created ' + count + ' files!');
console.log('\nRun: npm install && npm start');