const { app, BrowserWindow, globalShortcut, screen, ipcMain, Menu, dialog, shell } = require('electron');
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: `Answer concisely in 1-2 sentences: ${query}` }]
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
  const bookmarkFile = path.join(BOOKMARKS_DIR, `${bookmark.id}.json`);
  fs.writeFileSync(bookmarkFile, JSON.stringify(bookmark, null, 2));
  database.bookmarks.push(bookmark);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('remove-bookmark', (_, id) => {
  const bookmarkFile = path.join(BOOKMARKS_DIR, `${id}.json`);
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
