const { app, BrowserWindow, globalShortcut, screen, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const { ElectronOllama } = require('electron-ollama');
const ollama = require('ollama').Ollama;
require('dotenv').config();

let sidebarWindow = null;
let panelWindow = null;
let modeWindow = null;
let commandWindow = null;
let graphWindow = null;
let settingsWindow = null;
let currentPanel = null;
let eo = null;
let ollamaClient = null;
let isOllamaStarting = false;
let DB_PATH;
let BOOKMARKS_DIR;
let SETTINGS_PATH;
let APPS_CACHE_PATH;
let cachedApps = null;
let isScanningApps = false;

Menu.setApplicationMenu(null);

function loadSettings() {
  try {
    if (SETTINGS_PATH && fs.existsSync(SETTINGS_PATH)) {
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

let settings = {};
let database = null;

function loadDatabase() {
  if (!DB_PATH) {
    console.warn('DB_PATH not initialized yet, skipping database load');
    return null;
  }
  try {
    if (DB_PATH && fs.existsSync(DB_PATH)) {
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
      if (!data.chatHistory) {
        data.chatHistory = {};
        needsSave = true;
        console.log('✅ Database migrated: Added chatHistory');
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
    currentMode: 'default',
    chatHistory: {}
  };
  
  console.log('✅ Created fresh database');
  saveDatabase(freshData);
  return freshData;
}

function saveDatabase(data) {
  if (!DB_PATH) {
    console.warn('DB_PATH not initialized yet, skipping database save');
    return false;
  }
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('DB save error:', e);
    return false;
  }
}

// Parse intent to clarify what tasks need to be created using Ollama
async function clarifyIntent(text) {
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

    console.log('Sending request to Ollama for intent clarification...');
    const response = await ollamaClient.chat({
      model: 'qwen2.5:0.5b',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json'
    });

    console.log('Ollama response received:', JSON.stringify(response, null, 2));

    if (!response || !response.message || !response.message.content) {
      console.error('Invalid response structure from Ollama');
      return null;
    }

    let responseText = response.message.content;
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
    return null;
  }
}

// Generate multiple tasks from intent using Ollama
async function generateTasksFromIntent(intentText) {
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

    console.log('Sending request to Ollama for task generation...');
    const response = await ollamaClient.chat({
      model: 'qwen2.5:0.5b',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json'
    });

    console.log('Ollama response received:', JSON.stringify(response, null, 2));

    if (!response || !response.message || !response.message.content) {
      console.error('Invalid response structure from Ollama');
      return null;
    }

    let responseText = response.message.content;
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
    return null;
  }
}

// AI Search using Ollama with streaming
async function searchWithAI(query, streamCallback) {
  try {
    const response = await ollamaClient.chat({
      model: 'qwen2.5:0.5b',
      messages: [{ role: 'user', content: `Answer concisely in 2-3 sentences: ${query}` }],
      stream: true
    });

    let fullText = '';
    for await (const chunk of response) {
      if (chunk.message && chunk.message.content) {
        fullText += chunk.message.content;
        if (streamCallback) {
          streamCallback(fullText);
        }
      }
    }

    return {
      type: 'ai',
      title: query,
      description: fullText,
      action: 'copy'
    };
  } catch (error) {
    console.error('AI search error:', error.message);
    return {
      type: 'ai',
      title: query,
      description: 'Error: ' + error.message,
      action: 'copy'
    };
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

// Search apps - uses cache for instant results
async function searchApps(query) {
  // Use cached apps if available, otherwise return empty
  const appsToSearch = cachedApps || [];

  if (appsToSearch.length === 0) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const filteredApps = appsToSearch.filter(app =>
    app && app.name && app.name.toLowerCase().includes(lowerQuery)
  );

  return filteredApps.slice(0, 20).map(app => ({
    type: 'app',
    title: app.name.replace(/\.(exe|lnk|app)$/i, ''),
    description: '', // Remove path from display
    path: app.path,
    icon: app.icon || null,
    action: 'launch_app'
  }));
}

// Recursively scan directory for .exe files (Windows) or .app bundles (macOS)
function scanDirectoryForApps(dir, depth = 0, maxDepth = 2) {
  const apps = [];
  if (depth > maxDepth) return apps;

  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);

        if (process.platform === 'win32') {
          if (item.endsWith('.exe') && stat.isFile()) {
            apps.push({
              name: item.replace(/\.exe$/i, ''),
              path: fullPath
            });
          } else if (item.endsWith('.lnk') && stat.isFile()) {
            // Include .lnk shortcuts
            apps.push({
              name: item.replace(/\.lnk$/i, ''),
              path: fullPath
            });
          } else if (stat.isDirectory() && depth < maxDepth) {
            // Recursively scan subdirectories
            apps.push(...scanDirectoryForApps(fullPath, depth + 1, maxDepth));
          }
        } else if (process.platform === 'darwin') {
          if (item.endsWith('.app')) {
            apps.push({
              name: item.replace('.app', ''),
              path: fullPath
            });
          }
        }
      } catch (e) {
        // Skip files we can't access
      }
    }
  } catch (e) {
    // Skip directories we can't read
  }

  return apps;
}

// Load apps cache from disk
function loadAppsCache() {
  try {
    if (APPS_CACHE_PATH && fs.existsSync(APPS_CACHE_PATH)) {
      const cacheData = JSON.parse(fs.readFileSync(APPS_CACHE_PATH, 'utf8'));
      cachedApps = cacheData.apps || [];
      console.log(`✅ Loaded ${cachedApps.length} apps from cache`);
      return cachedApps;
    }
  } catch (error) {
    console.error('Error loading apps cache:', error);
  }
  return [];
}

// Save apps cache to disk
function saveAppsCache(apps) {
  try {
    if (APPS_CACHE_PATH) {
      fs.writeFileSync(APPS_CACHE_PATH, JSON.stringify({ apps, timestamp: Date.now() }, null, 2));
      console.log(`✅ Saved ${apps.length} apps to cache`);
      return true;
    }
  } catch (error) {
    console.error('Error saving apps cache:', error);
  }
  return false;
}

// Scan and cache apps in background (non-blocking)
async function scanAndCacheApps() {
  if (isScanningApps) {
    console.log('⚠️ App scan already in progress');
    return cachedApps || [];
  }

  isScanningApps = true;
  console.log('🔍 Starting background app scan...');

  try {
    const apps = await getInstalledApps();
    cachedApps = apps;
    saveAppsCache(apps);
    console.log(`✅ App scan complete: ${apps.length} apps found`);
    return apps;
  } catch (error) {
    console.error('Error scanning apps:', error);
    return cachedApps || [];
  } finally {
    isScanningApps = false;
  }
}

// Get list of installed applications from common locations
async function getInstalledApps() {
  const apps = [];
  const commonAppDirs = [];

  if (process.platform === 'win32') {
    // Windows: Include Program Files, Start Menu, and AppData
    commonAppDirs.push(
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      path.join(os.homedir(), 'AppData\\Local\\Programs'),
      path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'),
      'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
    );
  } else if (process.platform === 'darwin') {
    // macOS: Include /Applications and ~/Applications
    commonAppDirs.push(
      '/Applications',
      path.join(os.homedir(), 'Applications')
    );
  }

  const seen = new Set();
  for (const dir of commonAppDirs) {
    if (fs.existsSync(dir)) {
      const foundApps = scanDirectoryForApps(dir, 0, 2);
      for (const app of foundApps) {
        // Deduplicate by app name
        if (!seen.has(app.name.toLowerCase())) {
          seen.add(app.name.toLowerCase());
          apps.push(app);
        }
      }
    }
  }

  return apps.slice(0, 100); // Return up to 100 apps
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

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  panelWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
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

  // Enable click-through for the window
  panelWindow.setIgnoreMouseEvents(true, { forward: true });
  
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

  // Handle click-through messages from renderer
  ipcMain.on('set-click-through', (event, clickThrough) => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
    }
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
    width: 140,
    height: 180,
    x: 86,
    y: Math.round((height - 180) / 2),
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
  // Initialize paths
  DB_PATH = path.join(app.getPath('userData'), 'gogh-data.json');
  BOOKMARKS_DIR = path.join(app.getPath('userData'), 'bookmarks');
  SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
  APPS_CACHE_PATH = path.join(app.getPath('userData'), 'apps-cache.json');

  if (!fs.existsSync(BOOKMARKS_DIR)) {
    fs.mkdirSync(BOOKMARKS_DIR, { recursive: true });
  }

  // Reload settings and database with paths now available
  settings = loadSettings();
  database = loadDatabase();

  // Load cached apps
  loadAppsCache();

  // Initialize ElectronOllama
  const ollamaBasePath = app.getPath('userData');
  const ollamaModelsPath = path.join(ollamaBasePath, 'ollama-models');

  // Ensure models directory exists
  if (!fs.existsSync(ollamaModelsPath)) {
    fs.mkdirSync(ollamaModelsPath, { recursive: true });
  }

  eo = new ElectronOllama({
    basePath: ollamaBasePath,
    directory: 'ollama-binaries'
  });

  // Set OLLAMA_MODELS environment variable to persist models in app data
  process.env.OLLAMA_MODELS = ollamaModelsPath;

  ollamaClient = new ollama({ host: 'http://localhost:11434' });

  console.log(`📁 Ollama binaries: ${path.join(ollamaBasePath, 'ollama-binaries')}`);
  console.log(`📁 Ollama models: ${ollamaModelsPath}`);

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

  // Trigger background app scan if cache is empty or older than 24 hours
  setTimeout(() => {
    if (!cachedApps || cachedApps.length === 0) {
      console.log('🔄 No apps cached, starting initial scan...');
      scanAndCacheApps();
    } else {
      // Check cache age
      try {
        const cacheData = JSON.parse(fs.readFileSync(APPS_CACHE_PATH, 'utf8'));
        const cacheAge = Date.now() - (cacheData.timestamp || 0);
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (cacheAge > oneDayMs) {
          console.log('🔄 Apps cache is old, refreshing...');
          scanAndCacheApps();
        }
      } catch (e) {
        // If error reading cache age, rescan
        scanAndCacheApps();
      }
    }
  }, 2000); // Wait 2 seconds after startup
});

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  // Stop Ollama server if running
  if (eo) {
    const server = eo.getServer();
    if (server) {
      try {
        await server.stop();
        console.log('✅ Ollama server stopped');
      } catch (e) {
        console.error('Error stopping Ollama:', e);
      }
    }
  }
});

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
ipcMain.handle('search-ai', async (event, query) => {
  // Create streaming callback that sends chunks to renderer
  const streamCallback = (partialText) => {
    event.sender.send('ai-search-chunk', partialText);
  };

  return await searchWithAI(query, streamCallback);
});

ipcMain.handle('search-google', async (_, query) => {
  return await searchWithGoogle(query);
});

ipcMain.handle('search-local', async (_, query) => {
  const fileResults = await searchLocalFiles(query);
  const appResults = await searchApps(query);
  return { files: fileResults, apps: appResults };
});

ipcMain.handle('refresh-apps-cache', async () => {
  try {
    const apps = await scanAndCacheApps();
    return { success: true, count: apps.length };
  } catch (error) {
    console.error('Error refreshing apps cache:', error);
    return { success: false, error: error.message };
  }
});

// Execute search result
ipcMain.handle('execute-result', async (_, result) => {
  try {
    switch (result.action) {
      case 'open_file':
        if (!result.path || !fs.existsSync(result.path)) {
          console.error('File not found:', result.path);
          return false;
        }
        const fileResult = await shell.openPath(result.path);
        if (fileResult) {
          console.error('Error opening file:', fileResult);
          return false;
        }
        break;

      case 'launch_app':
        if (!result.path || !fs.existsSync(result.path)) {
          console.error('App not found:', result.path);
          return false;
        }
        const appResult = await shell.openPath(result.path);
        if (appResult) {
          console.error('Error launching app:', appResult);
          return false;
        }
        break;

      case 'open_url':
        if (!result.url) {
          console.error('Invalid URL:', result.url);
          return false;
        }
        await shell.openExternal(result.url);
        break;

      default:
        console.error('Unknown action:', result.action);
        return false;
    }
    return true;
  } catch (error) {
    console.error('Error executing result:', error);
    return false;
  }
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
  if (!appPath || appPath === 'undefined') {
    console.error('Invalid app path:', appPath);
    return false;
  }

  try {
    // Validate path exists
    if (!fs.existsSync(appPath)) {
      console.error('App path does not exist:', appPath);
      return false;
    }

    // Use shell.openPath for launching
    const result = await shell.openPath(appPath);

    // If result is not empty string, there was an error
    if (result) {
      console.error('Error launching app:', result);
      return false;
    }

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

ipcMain.handle('delete-mode', (_, id) => {
  if (id === 'default') {
    return database;
  }
  database.modes = database.modes.filter(m => m.id !== id);
  // Move all data from deleted mode to default
  database.files.forEach(f => { if (f.mode === id) f.mode = 'default'; });
  database.bookmarks.forEach(b => { if (b.mode === id) b.mode = 'default'; });
  database.apps.forEach(a => { if (a.mode === id) a.mode = 'default'; });
  database.tasks.forEach(t => { if (t.mode === id) t.mode = 'default'; });
  database.intents.forEach(i => { if (i.mode === id) i.mode = 'default'; });
  if (database.currentMode === id) {
    database.currentMode = 'default';
  }
  saveDatabase(database);
  broadcastUpdate();
  return database;
});

ipcMain.handle('reset-database', () => {
  database = {
    modes: [
      { id: 'default', name: 'Work', color: '#ffffff' }
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
  saveDatabase(database);
  broadcastUpdate();
  return true;
});

ipcMain.handle('hide-command', () => {
  if (commandWindow && !commandWindow.isDestroyed()) {
    commandWindow.hide();
  }
  return true;
});

ipcMain.handle('delete-all-data', () => {
  database = {
    modes: [
      { id: 'default', name: 'Work', color: '#ffffff' }
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
  saveDatabase(database);
  broadcastUpdate();
  return true;
});

// Ollama IPC Handlers
ipcMain.handle('start-ollama', async (event) => {
  try {
    if (isOllamaStarting) {
      return { status: 'starting', message: 'Ollama is already starting...' };
    }

    const isRunning = await eo.isRunning();

    if (isRunning) {
      return { status: 'running', message: 'Ollama is already running' };
    }

    isOllamaStarting = true;

    // Get metadata first to determine version
    const metadata = await eo.getMetadata('latest');
    const version = metadata.version;

    // Check if this specific version is already downloaded
    const isDownloaded = await eo.isDownloaded(version);

    if (isDownloaded) {
      console.log(`Ollama ${version} already downloaded, starting existing installation...`);
    } else {
      console.log(`Ollama ${version} not found, will download...`);
    }

    await eo.serve(version, {
      env: {
        OLLAMA_MODELS: process.env.OLLAMA_MODELS
      },
      serverLog: (message) => {
        console.log('[Ollama Server]', message);
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-log', message);
        }
      },
      downloadLog: (percent, message) => {
        console.log(`[Ollama Download] ${percent}%`, message);
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-download-progress', { percent, message });
        }
      },
      timeoutSec: 60
    });

    isOllamaStarting = false;

    return {
      status: 'started',
      message: 'Ollama server started successfully',
      version: version
    };

  } catch (error) {
    isOllamaStarting = false;
    console.error('Failed to start Ollama:', error);
    return {
      status: 'error',
      message: error.message
    };
  }
});

ipcMain.handle('check-ollama-status', async () => {
  try {
    const isRunning = await eo.isRunning();
    return { isRunning };
  } catch (error) {
    return { isRunning: false };
  }
});

ipcMain.handle('chat-with-ollama', async (event, message) => {
  const modelName = 'qwen2.5:0.5b';

  try {
    // First check if model exists
    try {
      const models = await ollamaClient.list();
      const modelExists = models.models.some(m => m.name === modelName || m.name.startsWith('qwen2.5:0.5b'));

      if (!modelExists) {
        console.log(`Model ${modelName} not found locally, pulling...`);
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-log', `Downloading model ${modelName}...`);
        }

        const pullStream = await ollamaClient.pull({
          model: modelName,
          stream: true
        });

        for await (const progress of pullStream) {
          if (progress.status) {
            console.log(`Pull progress: ${progress.status}`);
            if (panelWindow && !panelWindow.isDestroyed()) {
              panelWindow.webContents.send('ollama-log', progress.status);
            }
          }
        }

        console.log(`Model ${modelName} pulled successfully`);
      } else {
        console.log(`Model ${modelName} already available`);
      }
    } catch (listError) {
      console.error('Error checking models:', listError);
    }

    const response = await ollamaClient.chat({
      model: modelName,
      messages: [{ role: 'user', content: message }],
      stream: true,
    });

    for await (const chunk of response) {
      if (chunk.message && chunk.message.content) {
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-chunk', chunk.message.content);
        }
      }
    }

    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send('ollama-done');
    }

    return { status: 'success' };
  } catch (error) {
    console.error('Chat error:', error);

    // If model not found, pull it
    if (error.status_code === 404 || error.error?.includes('not found')) {
      console.log(`Model ${modelName} not found, pulling...`);

      if (panelWindow && !panelWindow.isDestroyed()) {
        panelWindow.webContents.send('ollama-log', `Downloading model ${modelName}...`);
      }

      try {
        const pullStream = await ollamaClient.pull({
          model: modelName,
          stream: true
        });

        for await (const progress of pullStream) {
          if (progress.status) {
            console.log(`Pull progress: ${progress.status}`);
            if (panelWindow && !panelWindow.isDestroyed()) {
              panelWindow.webContents.send('ollama-log', progress.status);
            }
          }
        }

        console.log(`Model ${modelName} pulled successfully, retrying chat...`);

        // Retry the chat after pulling
        const retryResponse = await ollamaClient.chat({
          model: modelName,
          messages: [{ role: 'user', content: message }],
          stream: true,
        });

        for await (const chunk of retryResponse) {
          if (chunk.message && chunk.message.content) {
            if (panelWindow && !panelWindow.isDestroyed()) {
              panelWindow.webContents.send('ollama-chunk', chunk.message.content);
            }
          }
        }

        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-done');
        }

        return { status: 'success' };
      } catch (pullError) {
        console.error('Model pull failed:', pullError);
        return { status: 'error', message: `Failed to download model: ${pullError.message}` };
      }
    }

    return { status: 'error', message: error.message };
  }
});

// Chat History Operations
ipcMain.handle('get-chat-history', (_, mode) => {
  if (!database || !database.chatHistory) {
    return [];
  }
  return database.chatHistory[mode] || [];
});

ipcMain.handle('save-chat-history', (_, { mode, messages }) => {
  if (!database) {
    return false;
  }
  if (!database.chatHistory) {
    database.chatHistory = {};
  }
  database.chatHistory[mode] = messages;
  saveDatabase(database);
  return true;
});

ipcMain.handle('clear-chat-history', (_, mode) => {
  if (!database || !database.chatHistory) {
    return false;
  }
  if (mode) {
    database.chatHistory[mode] = [];
  } else {
    database.chatHistory = {};
  }
  saveDatabase(database);
  return true;
});

// Export response to file
ipcMain.handle('export-response', async (_, { content, format }) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const extension = format === 'docx' ? 'docx' : 'md';
    const fileName = `response-${timestamp}.${extension}`;

    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Response',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      filters: [
        { name: format === 'docx' ? 'Word Document' : 'Markdown', extensions: [extension] }
      ]
    });

    if (!filePath) {
      return { success: false, message: 'Cancelled' };
    }

    if (format === 'docx') {
      // For DOCX, we need to create a proper Word document
      // Using a simple approach: create an HTML file that Word can open
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    strong { font-weight: bold; }
    em { font-style: italic; }
  </style>
</head>
<body>
${content.replace(/\n/g, '<br>')}
</body>
</html>`;

      // Save as .docx (Word can open HTML files)
      fs.writeFileSync(filePath, htmlContent, 'utf8');
    } else {
      // For Markdown, save as-is
      fs.writeFileSync(filePath, content, 'utf8');
    }

    return { success: true, filePath };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, message: error.message };
  }
  return true;
});