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
      let needsSave = false;
      
      if (!data.apps) { data.apps = []; needsSave = true; }
      if (!data.files) { data.files = []; needsSave = true; }
      if (!data.bookmarks) { data.bookmarks = []; needsSave = true; }
      if (!data.tasks) { data.tasks = []; needsSave = true; }
      if (!data.intents) { 
        data.intents = []; 
        needsSave = true;
        console.log('✅ Database migrated: Added intents array');
      }
      if (!data.events) { data.events = []; needsSave = true; }
      if (!data.connections) { data.connections = []; needsSave = true; }
      if (!data.modes) { 
        data.modes = [{ id: 'default', name: 'Work', color: '#ffffff' }]; 
        needsSave = true; 
      }
      if (!data.currentMode) { 
        data.currentMode = 'default'; 
        needsSave = true; 
      }
      
      // Migrate existing tasks to add new fields
      if (data.tasks.length > 0) {
        data.tasks.forEach(task => {
          if (task.intentId === undefined) {
            task.intentId = null;
            needsSave = true;
          }
          if (!task.attachments) {
            task.attachments = [];
            needsSave = true;
          }
        });
        if (needsSave) {
          console.log('✅ Database migrated: Updated task schema');
        }
      }
      
      if (needsSave) {
        saveDatabase(data);
        console.log('✅ Database migration complete');
      }
      
      return data;
    }
  } catch (e) {
    console.error('DB load error:', e);
    console.error('Creating backup and starting fresh...');
    if (fs.existsSync(DB_PATH)) {
      const backup = DB_PATH + '.error-backup.' + Date.now();
      try {
        fs.copyFileSync(DB_PATH, backup);
        console.log('Backup created at:', backup);
      } catch (backupError) {
        console.error('Could not create backup:', backupError);
      }
    }
  }
  
  const freshData = {
    modes: [
      { id: 'default', name: 'Work', color: '#ffffff' },
      { id: 'personal', name: 'Personal', color: '#cccccc' }
    ],
    files: [],
    bookmarks: [],
    apps: [],
    tasks: [],
    intents: [],
    events: [],
    connections: [],
    currentMode: 'default'
  };
  
  console.log('✅ Created fresh database');
  saveDatabase(freshData);
  return freshData;
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

// Parse intent to clarify what tasks need to be created
async function clarifyIntent(text) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.error('Gemini API key not configured');
    return null;
  }
  
  try {
    const prompt = `Analyze this intent: "${text}"

Provide a clear, concise description of what the user wants to accomplish (1-2 sentences max).

Return ONLY a JSON object with this exact format (no markdown, no extra text):
{
  "intent": "Clear description of what user wants to accomplish"
}

Examples:
- "Plan my vacation to Japan" -> {"intent": "Plan and organize a vacation trip to Japan including bookings, activities, and preparations"}
- "Learn React" -> {"intent": "Learn React framework through tutorials, practice projects, and understanding core concepts"}

Today is ${new Date().toISOString().split('T')[0]}`;

    console.log('Sending request to Gemini API for intent clarification...');
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Gemini API response received:', JSON.stringify(response.data, null, 2));
    
    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      console.error('Invalid response structure from Gemini API');
      return null;
    }
    
    let responseText = response.data.candidates[0].content.parts[0].text;
    console.log('Raw response text:', responseText);
    
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    console.log('Cleaned response text:', responseText);
    
    const parsed = JSON.parse(responseText);
    console.log('Parsed intent:', parsed);
    
    if (!parsed || !parsed.intent) {
      console.error('Parsed response missing intent field');
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Intent clarification error:', error.message);
    if (error.response) {
      console.error('API error response:', error.response.data);
    }
    return null;
  }
}

// Generate multiple tasks from intent using Gemini
async function generateTasksFromIntent(intentText) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.error('Gemini API key not configured');
    return null;
  }
  
  try {
    const prompt = `Break down this intent into specific actionable tasks: "${intentText}"

Return ONLY a JSON object with an array of tasks (no markdown, no extra text):
{
  "tasks": [
    {"title": "task title", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"},
    {"title": "task title", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}
  ]
}

Guidelines:
- Create 2-6 specific, actionable tasks
- Tasks should be in logical order
- Set realistic dates based on task dependencies
- Each task should be clear and focused

Examples:
- "Plan vacation to Japan" -> {"tasks": [{"title": "Research destinations and create itinerary", "startDate": "2025-10-07", "endDate": "2025-10-10"}, {"title": "Book flights and accommodation", "startDate": "2025-10-11", "endDate": "2025-10-13"}, {"title": "Apply for visa if needed", "startDate": "2025-10-14", "endDate": "2025-10-20"}]}

Today is ${new Date().toISOString().split('T')[0]}`;

    console.log('Sending request to Gemini API for task generation...');
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Gemini API response received:', JSON.stringify(response.data, null, 2));
    
    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      console.error('Invalid response structure from Gemini API');
      return null;
    }
    
    let responseText = response.data.candidates[0].content.parts[0].text;
    console.log('Raw response text:', responseText);
    
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    console.log('Cleaned response text:', responseText);
    
    const parsed = JSON.parse(responseText);
    console.log('Parsed tasks:', parsed);
    
    if (!parsed || !parsed.tasks || !Array.isArray(parsed.tasks)) {
      console.error('Parsed response missing tasks array');
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Task generation error:', error.message);
    if (error.response) {
      console.error('API error response:', error.response.data);
    }
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

// Local file search (exclude executables and shortcuts)
async function searchLocalFiles(query) {
  const results = [];
  const searchDirs = settings.searchDirectories || [];
  const appExtensions = ['.exe', '.lnk', '.app', '.dmg'];
  
  for (const dir of searchDirs) {
    try {
      const files = await searchDirectory(dir, query, 0, 2);
      results.push(...files);
      if (results.length >= 10) break;
    } catch (e) {
      // Skip
    }
  }
  
  return results.slice(0, 10)
    .filter(file => {
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      return !appExtensions.includes(ext);
    })
    .map(file => ({
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
    title: app.name.replace(/\.(exe|lnk|app)$/i, ''),
    description: app.path,
    path: app.path,
    icon: app.icon || null,
    action: 'launch_app'
  }));
}

// Get list of installed applications
async function getInstalledApps() {
  const apps = [];
  const commonAppDirs = [];
  
  if (process.platform === 'win32') {
    commonAppDirs.push(
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      path.join(os.homedir(), 'AppData\\Local\\Programs')
    );
  } else if (process.platform === 'darwin') {
    commonAppDirs.push('/Applications', path.join(os.homedir(), 'Applications'));
  }
  
  for (const dir of commonAppDirs) {
    try {
      if (fs.existsSync(dir)) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          try {
            const stat = fs.statSync(fullPath);
            if (process.platform === 'win32' && (item.endsWith('.exe') || stat.isDirectory())) {
              apps.push({
                name: item.replace(/\.(exe|lnk)$/i, ''),
                path: fullPath
              });
            } else if (process.platform === 'darwin' && item.endsWith('.app')) {
              apps.push({
                name: item.replace('.app', ''),
                path: fullPath
              });
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  
  return apps.slice(0, 50);
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
  sidebarWindow.loadFile('dist/sidebar.html');
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
  
  panelWindow.loadFile('dist/panel.html');
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
  
  modeWindow.loadFile('dist/mode.html');
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
  
  graphWindow.loadFile('dist/graph.html');
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
  
  settingsWindow.loadFile('dist/settings.html');
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
  commandWindow.loadFile('dist/command.html');
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

// Clarify intent with AI
ipcMain.handle('clarify-intent', async (_, text) => {
  return await clarifyIntent(text);
});

// Generate tasks from intent with AI
ipcMain.handle('generate-tasks', async (_, intentText) => {
  return await generateTasksFromIntent(intentText);
});

// Get installed apps
ipcMain.handle('get-installed-apps', async () => {
  return await getInstalledApps();
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

// Intent operations
ipcMain.handle('add-intent', (_, intent) => {
  database.intents.push(intent);
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('delete-intent', (_, id) => {
  database.intents = database.intents.filter(i => i.id !== id);
  database.tasks = database.tasks.filter(t => t.intentId !== id);
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

ipcMain.handle('add-tasks-batch', (_, tasks) => {
  database.tasks.push(...tasks);
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

ipcMain.handle('attach-to-task', (_, data) => {
  const task = database.tasks.find(t => t.id === data.taskId);
  if (task) {
    if (!task.attachments) task.attachments = [];
    task.attachments.push(data.attachment);
    saveDatabase(database);
    broadcastUpdate();
  }
  return database;
});

ipcMain.handle('detach-from-task', (_, data) => {
  const task = database.tasks.find(t => t.id === data.taskId);
  if (task && task.attachments) {
    task.attachments = task.attachments.filter(a => a.id !== data.attachmentId);
    saveDatabase(database);
    broadcastUpdate();
  }
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
