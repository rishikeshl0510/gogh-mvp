const fs = require('fs');

console.log('🔧 Fixing all issues...\n');

const files = {};

// ============================================
// FIXED MAIN.JS
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
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      // Ensure all arrays exist
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

// Search apps - FIXED
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

// FIXED SIDEBAR.HTML - Reduced spacing
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
      height: 250px;
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
      gap: 2px;
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
      margin: 2px 0;
    }
    .settings-btn {
      width: 40px;
      height: 40px;
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

// FIXED COMMAND HTML - Separate search categories
files['command.html'] = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Command</title>
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
    
    .search-tabs {
      display: flex;
      padding: 12px 24px;
      gap: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      -webkit-app-region: no-drag;
    }
    .search-tab {
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
    .search-tab:hover { background: rgba(255, 255, 255, 0.1); }
    .search-tab.active {
      background: #ffffff;
      color: #000;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
    }
    
    .results-container {
      max-height: 400px;
      overflow-y: auto;
      padding: 8px;
    }
    .results-container::-webkit-scrollbar { width: 6px; }
    .results-container::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); }
    
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
      <input id="input" placeholder="search..." autocomplete="off">
    </div>
    <div class="search-tabs">
      <div class="search-tab active" data-type="local" onclick="switchSearchType('local')">Local</div>
      <div class="search-tab" data-type="ai" onclick="switchSearchType('ai')">AI</div>
      <div class="search-tab" data-type="google" onclick="switchSearchType('google')">Google</div>
    </div>
    <div id="results" class="results-container hidden"></div>
    <div id="loading" class="loading hidden">Searching...</div>
  </div>
  <script src="renderer-command.js"></script>
</body>
</html>`;

// FIXED PRELOAD-COMMAND.JS
files['preload-command.js'] = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('commandAPI', {
  hide: () => ipcRenderer.invoke('hide-command'),
  searchAI: (query) => ipcRenderer.invoke('search-ai', query),
  searchGoogle: (query) => ipcRenderer.invoke('search-google', query),
  searchLocal: (query) => ipcRenderer.invoke('search-local', query),
  executeResult: (result) => ipcRenderer.invoke('execute-result', result)
});`;

// FIXED RENDERER-COMMAND.JS
files['renderer-command.js'] = `const input = document.getElementById('input');
const resultsContainer = document.getElementById('results');
const loading = document.getElementById('loading');

let currentSearchType = 'local';
let allResults = [];
let selectedIndex = -1;
let searchTimer = null;

input.focus();

function switchSearchType(type) {
  currentSearchType = type;
  document.querySelectorAll('.search-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.type === type);
  });
  
  if (input.value.trim()) {
    performSearch(input.value.trim());
  }
}

input.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  
  if (!query) {
    resultsContainer.classList.add('hidden');
    loading.classList.add('hidden');
    return;
  }
  
  resultsContainer.classList.add('hidden');
  loading.classList.remove('hidden');
  
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    performSearch(query);
  }, 300);
});

async function performSearch(query) {
  try {
    allResults = [];
    
    if (currentSearchType === 'local') {
      const localResults = await window.commandAPI.searchLocal(query);
      allResults = [...localResults.files, ...localResults.apps];
    } else if (currentSearchType === 'ai') {
      allResults = await window.commandAPI.searchAI(query);
    } else if (currentSearchType === 'google') {
      allResults = await window.commandAPI.searchGoogle(query);
    }
    
    showResults();
  } catch (error) {
    console.error('Search error:', error);
    loading.classList.add('hidden');
  }
}

function showResults() {
  loading.classList.add('hidden');
  
  if (!allResults || allResults.length === 0) {
    resultsContainer.innerHTML = '<div class="loading">No results found</div>';
    resultsContainer.classList.remove('hidden');
    return;
  }
  
  let html = '';
  allResults.forEach((item, i) => {
    const icons = {
      'ai': '🤖',
      'web': '🌐',
      'file': '📄',
      'folder': '📁',
      'app': '⚡'
    };
    const icon = icons[item.type] || '📄';
    
    html += \`
      <div class="item" data-index="\${i}">
        <div class="item-icon">\${icon}</div>
        <div class="item-content">
          <div class="item-title">\${item.title}</div>
          <div class="item-desc">\${item.description || ''}</div>
        </div>
      </div>
    \`;
  });
  
  resultsContainer.innerHTML = html;
  resultsContainer.classList.remove('hidden');
  selectedIndex = 0;
  updateSelection();
  
  document.querySelectorAll('.item').forEach((el, i) => {
    el.onclick = () => {
      selectedIndex = i;
      executeSelected();
    };
  });
}

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

function selectNext() {
  if (allResults.length === 0) return;
  selectedIndex = (selectedIndex + 1) % allResults.length;
  updateSelection();
}

function selectPrev() {
  if (allResults.length === 0) return;
  selectedIndex = selectedIndex <= 0 ? allResults.length - 1 : selectedIndex - 1;
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
  if (selectedIndex >= 0 && allResults[selectedIndex]) {
    await window.commandAPI.executeResult(allResults[selectedIndex]);
    window.commandAPI.hide();
  }
}`;

// Write all files
console.log('Writing fixed files...\n');
Object.entries(files).forEach(([filename, content]) => {
  fs.writeFileSync(filename, content);
  console.log(`✓ ${filename}`);
});

console.log('\n✅ All issues fixed!');
console.log('\n🔧 Fixed:');
console.log('  • Apps filter undefined error');
console.log('  • Badge counts now update properly');
console.log('  • Knowledge graph shows existing data');
console.log('  • Reduced spacing between mode and settings');
console.log('  • Separate search tabs: Local | AI | Google');
console.log('\n▶️  Run: npm start');
