// Enable garbage collection exposure for manual memory management
if (!process.env.NODE_OPTIONS?.includes('--expose-gc')) {
  console.warn('⚠️ Garbage collection not exposed. Run with: npm start -- --expose-gc');
}

const { app, BrowserWindow, globalShortcut, screen, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const { ElectronOllama } = require('electron-ollama');
const ollama = require('ollama').Ollama;
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');
const crossSpawn = require('cross-spawn');
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
let currentOllamaStream = null;
let DB_PATH;
let BOOKMARKS_DIR;
let SETTINGS_PATH;
let APPS_CACHE_PATH;
let cachedApps = null;
let isScanningApps = false;
let MCP_CONFIG_PATH;
let mcpManager = null;

Menu.setApplicationMenu(null);

// MCP Manager Class
class MCPManager {
  constructor() {
    this.servers = new Map();
    this.availableTools = [];
  }

  async connectServer(serverName, command, args, env = null) {
    try {
      console.log(`Connecting to MCP server: ${serverName}`);

      // On Windows, npx needs .cmd extension
      let finalCommand = command;
      let finalArgs = args;

      if (process.platform === 'win32' && command === 'npx') {
        finalCommand = 'npx.cmd';
        console.log(`Windows: Using npx.cmd with args:`, finalArgs);
      }

      const transport = new StdioClientTransport({
        command: finalCommand,
        args: finalArgs,
        env: env ? { ...process.env, ...env } : process.env
      });

      const client = new Client({
        name: "electron-ai-palette",
        version: "1.0.0"
      }, {
        capabilities: {}
      });

      await client.connect(transport);

      const { tools } = await client.listTools();

      this.servers.set(serverName, { client, tools, transport });

      // Refresh available tools list
      this.refreshAvailableTools();

      console.log(`✅ Connected to ${serverName} with ${tools.length} tools`);
      return { success: true, tools };
    } catch (error) {
      console.error(`❌ Failed to connect to ${serverName}:`, error);
      return { success: false, error: error.message };
    }
  }

  async disconnectServer(serverName) {
    const server = this.servers.get(serverName);
    if (server) {
      try {
        await server.client.close();
        this.servers.delete(serverName);
        this.refreshAvailableTools();
        console.log(`Disconnected from ${serverName}`);
        return { success: true };
      } catch (error) {
        console.error(`Error disconnecting from ${serverName}:`, error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Server not found' };
  }

  refreshAvailableTools() {
    this.availableTools = [];
    for (const [serverName, { tools }] of this.servers) {
      this.availableTools.push(...tools.map(tool => ({ ...tool, serverName })));
    }
  }

  async callTool(toolName, args) {
    for (const [serverName, { client, tools }] of this.servers) {
      if (tools.find(t => t.name === toolName)) {
        try {
          const result = await client.callTool({ name: toolName, arguments: args });
          return result;
        } catch (error) {
          console.error(`Error calling tool ${toolName}:`, error);
          throw error;
        }
      }
    }
    throw new Error(`Tool ${toolName} not found in any connected server`);
  }

  getAllTools() {
    return this.availableTools;
  }

  getConnectedServers() {
    return Array.from(this.servers.keys());
  }
}

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
      if (!data.fileWorkspaces) {
        data.fileWorkspaces = [];
        needsSave = true;
      }
      if (!data.composerSettings) {
        data.composerSettings = { enabled: false };
        needsSave = true;
      }
      if (data.ollamaFirstTimeSetup === undefined) {
        data.ollamaFirstTimeSetup = true;
        needsSave = true;
        console.log('✅ Database migrated: Added ollamaFirstTimeSetup flag');
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
    chatHistory: {},
    fileWorkspaces: [],
    composerSettings: { enabled: false },
    ollamaFirstTimeSetup: true
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
    // Clone data to prevent memory leaks from references
    const clonedData = JSON.parse(JSON.stringify(data));
    fs.writeFileSync(DB_PATH, JSON.stringify(clonedData, null, 2));
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
      model: 'llama3.2:1b',
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
async function generateTasksFromIntent(intentText, isRoutine = false) {
  try {
    const routineNote = isRoutine ? '\n\nIMPORTANT: These tasks are ROUTINE/RECURRING. Set them to repeat patterns.' : '';

    const prompt = `You are a task breakdown expert. Analyze this goal and create a SMART breakdown: "${intentText}"${routineNote}

Return ONLY valid JSON (no markdown, no extra text):
{
  "tasks": [
    {
      "title": "specific action",
      "description": "detailed steps and context",
      "dueDate": "YYYY-MM-DD HH:MM",
      "color": "#hex",
      "isRoutine": ${isRoutine},
      "routinePattern": "daily|weekly|monthly|null"
    }
  ]
}

STRATEGY:
1. Break complex goals into 3-8 atomic tasks
2. Order tasks by dependencies (what must happen first?)
3. Each task = ONE clear action (not vague goals)
4. Add helpful context in description
5. Set realistic due dates based on complexity
6. Assign colors: urgent=red, important=orange, routine=blue, creative=purple

EXAMPLES:
Goal: "Launch website"
→ [{"title":"Design mockups in Figma","description":"Create 3 page layouts: home, about, contact. Review brand guidelines first.","dueDate":"2025-10-15 17:00","color":"#9333EA","isRoutine":false},
   {"title":"Develop frontend HTML/CSS","description":"Convert Figma designs to responsive code. Use Tailwind CSS.","dueDate":"2025-10-20 18:00","color":"#3B82F6","isRoutine":false},
   {"title":"Deploy to Vercel","description":"Connect GitHub repo, configure domain, test live site.","dueDate":"2025-10-22 12:00","color":"#EF4444","isRoutine":false}]

Goal: "Morning routine" (routine=true)
→ [{"title":"Workout 30min","description":"Cardio or weights, track in app","dueDate":"${new Date().toISOString().split('T')[0]} 06:30","color":"#10B981","isRoutine":true,"routinePattern":"daily"}]

Today: ${new Date().toISOString().split('T')[0]}`;

    console.log('Sending request to Ollama for task generation...');
    const response = await ollamaClient.chat({
      model: 'llama3.2:1b',
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
      model: 'llama3.2:1b',
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
        if (!seen.has(app.name.toLowerCase())) {
          seen.add(app.name.toLowerCase());
          apps.push(app);
        }
      }
    }
  }

  return apps;
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

// MCP Config Functions
function loadMCPConfig() {
  try {
    if (MCP_CONFIG_PATH && fs.existsSync(MCP_CONFIG_PATH)) {
      const data = fs.readFileSync(MCP_CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('MCP config load error:', error);
  }
  return { mcpServers: {} };
}

function saveMCPConfig(config) {
  try {
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('MCP config save error:', error);
    return false;
  }
}

async function initializeMCPServers() {
  if (!mcpManager) {
    mcpManager = new MCPManager();
  }

  const config = loadMCPConfig();

  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      await mcpManager.connectServer(
        serverName,
        serverConfig.command,
        serverConfig.args,
        serverConfig.env
      );
    } catch (error) {
      console.error(`Failed to connect to MCP server ${serverName}:`, error);
    }
  }
}

app.whenReady().then(async () => {
  // Initialize paths
  DB_PATH = path.join(app.getPath('userData'), 'gogh-data.json');
  BOOKMARKS_DIR = path.join(app.getPath('userData'), 'bookmarks');
  SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
  APPS_CACHE_PATH = path.join(app.getPath('userData'), 'apps-cache.json');
  MCP_CONFIG_PATH = path.join(app.getPath('userData'), 'mcp-config.json');

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

  // Initialize MCP servers
  await initializeMCPServers();

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

  // Periodic memory cleanup every 5 minutes
  setInterval(() => {
    if (global.gc) {
      console.log('🧹 Running periodic garbage collection...');
      global.gc();
    }
  }, 5 * 60 * 1000);

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
ipcMain.handle('generate-tasks', async (_, intentText, isRoutine = false) => {
  return await generateTasksFromIntent(intentText, isRoutine);
});

// Get installed apps
ipcMain.handle('get-installed-apps', async () => {
  // Return cached apps for instant results
  if (cachedApps && cachedApps.length > 0) {
    console.log(`📱 Returning ${cachedApps.length} cached apps`);
    return cachedApps;
  }

  // If no cache, scan now (fallback)
  console.log('⚠️ No cached apps, scanning now...');
  const apps = await getInstalledApps();
  cachedApps = apps;
  saveAppsCache(apps);
  return apps;
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

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-file-workspaces', (_, mode) => {
  if (!database || !database.fileWorkspaces) {
    console.warn('Database or fileWorkspaces not initialized');
    return [];
  }
  const workspaces = database.fileWorkspaces.filter(w => w.mode === mode);
  console.log(`get-file-workspaces: mode=${mode}, found=${workspaces.length}`);
  return workspaces;
});

ipcMain.handle('add-file-workspace', (_, workspace) => {
  if (!database.fileWorkspaces) {
    database.fileWorkspaces = [];
  }
  database.fileWorkspaces.push(workspace);
  console.log(`add-file-workspace: Added ${workspace.name}, total=${database.fileWorkspaces.length}`);
  saveDatabase(database);
  broadcastUpdate();
  return true;
});

ipcMain.handle('remove-file-workspace', (_, id) => {
  database.fileWorkspaces = database.fileWorkspaces.filter(w => w.id !== id);
  saveDatabase(database);
  broadcastUpdate();
  return true;
});

ipcMain.handle('get-folder-contents', async (_, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      console.warn(`get-folder-contents: Path does not exist: ${folderPath}`);
      return [];
    }

    // Find workspace for this folder to get tags
    const workspace = database.fileWorkspaces?.find(w => folderPath.startsWith(w.rootPath));
    const taggedFiles = workspace?.files || [];

    const items = fs.readdirSync(folderPath);
    const contents = items.map(item => {
      const fullPath = path.join(folderPath, item);
      try {
        const stat = fs.statSync(fullPath);
        const fileEntry = taggedFiles.find(f => f.path === fullPath);
        return {
          name: item,
          path: fullPath,
          isDirectory: stat.isDirectory(),
          tags: fileEntry?.tags || []
        };
      } catch (e) {
        console.warn(`Error reading ${fullPath}:`, e.message);
        return null;
      }
    }).filter(Boolean).sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
    console.log(`get-folder-contents: ${folderPath} has ${contents.length} items`);
    return contents;
  } catch (e) {
    console.error(`get-folder-contents error for ${folderPath}:`, e);
    return [];
  }
});

ipcMain.handle('show-file-context-menu', async (event, item) => {
  const template = [
    {
      label: 'AI Summary',
      click: async () => {
        event.sender.send('file-context-action', { action: 'ai-summary', item });
      }
    },
    {
      label: 'Tag with AI',
      click: async () => {
        event.sender.send('file-context-action', { action: 'tag-with-ai', item });
      }
    },
    { type: 'separator' },
    {
      label: 'Show in Folder',
      click: async () => {
        shell.showItemInFolder(item.path);
      }
    },
    {
      label: 'Properties',
      click: async () => {
        event.sender.send('file-context-action', { action: 'properties', item });
      }
    }
  ];

  if (item.isDirectory) {
    template.unshift({
      label: 'Import Bookmarks',
      click: async () => {
        event.sender.send('file-context-action', { action: 'import-bookmarks', item });
      }
    });
  }

  const menu = Menu.buildFromTemplate(template);
  menu.popup(BrowserWindow.fromWebContents(event.sender));
});

ipcMain.handle('enable-composer', (_, enabled) => {
  database.composerSettings.enabled = enabled;
  saveDatabase(database);
  return database.composerSettings;
});

ipcMain.handle('tag-file-with-ai', async (_, filePath) => {
  try {
    const fileName = filePath.split(/[\\\/]/).pop();
    const ext = path.extname(fileName);
    const stat = fs.statSync(filePath);
    const parentFolder = path.dirname(filePath).split(/[\\\/]/).pop();

    const prompt = `Analyze this file and suggest 2-4 relevant tags:
File: ${fileName}
Extension: ${ext}
Size: ${stat.size} bytes
Parent folder: ${parentFolder}
Date modified: ${stat.mtime}

Suggest tags from these categories:
- Work type: documentation, code, media, data, config
- Project: project-name, client-name
- Priority: urgent, important, reference, archive
- Status: draft, final, review

Return JSON: {"tags": ["tag1", "tag2", "tag3"]}`;

    const response = await ollamaClient.chat({
      model: 'llama3.2:1b',
      messages: [{ role: 'user', content: prompt }],
      stream: false
    });

    const result = JSON.parse(response.message.content);
    return result.tags || [];
  } catch (e) {
    return [];
  }
});

ipcMain.handle('update-file-tags', (_, filePath, tags) => {
  const workspace = database.fileWorkspaces.find(w =>
    filePath.startsWith(w.rootPath)
  );
  if (workspace) {
    if (!workspace.files) workspace.files = [];
    const fileEntry = workspace.files.find(f => f.path === filePath);
    if (fileEntry) {
      fileEntry.tags = tags;
    } else {
      workspace.files.push({ path: filePath, tags, name: filePath.split(/[\\\/]/).pop() });
    }
    saveDatabase(database);
  }
  return true;
});

ipcMain.handle('semantic-file-search', async (_, query) => {
  try {
    const prompt = `Parse this file search query and extract filters:
Query: "${query}"

Return JSON with:
{
  "keywords": ["word1", "word2"],
  "fileType": "pdf|doc|image|any",
  "tags": ["tag1", "tag2"],
  "timeRange": "recent|today|week|month|any"
}`;

    const response = await ollamaClient.chat({
      model: 'llama3.2:1b',
      messages: [{ role: 'user', content: prompt }],
      stream: false
    });

    const filters = JSON.parse(response.message.content);
    const results = [];

    database.fileWorkspaces.forEach(ws => {
      if (ws.files) {
        ws.files.forEach(file => {
          let score = 0;
          if (filters.keywords) {
            filters.keywords.forEach(kw => {
              if (file.name.toLowerCase().includes(kw.toLowerCase())) score += 2;
              if (file.tags && file.tags.some(t => t.toLowerCase().includes(kw.toLowerCase()))) score += 3;
            });
          }
          if (filters.tags && file.tags) {
            filters.tags.forEach(tag => {
              if (file.tags.includes(tag)) score += 5;
            });
          }
          if (score > 0) results.push({ ...file, score });
        });
      }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  } catch (e) {
    return [];
  }
});

ipcMain.handle('read-file-with-ai', async (_, filePath) => {
  try {
    let content = '';
    const ext = path.extname(filePath).toLowerCase();
    const stats = fs.statSync(filePath);

    // Prevent reading files larger than 5MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (stats.size > MAX_FILE_SIZE) {
      return `❌ File too large (${(stats.size / 1024 / 1024).toFixed(2)} MB). Maximum file size is 5MB to prevent memory issues.`;
    }

    // Text-based files
    const textExtensions = ['.txt', '.md', '.js', '.jsx', '.ts', '.tsx', '.json', '.xml', '.html', '.css', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.sh', '.bat', '.yml', '.yaml', '.toml', '.ini', '.conf', '.log'];

    if (textExtensions.includes(ext)) {
      content = fs.readFileSync(filePath, 'utf8').slice(0, 8000);
    } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
      // For document files, provide information about the file
      const stats = fs.statSync(filePath);
      content = `[Document file: ${path.basename(filePath)}]
Type: ${ext.slice(1).toUpperCase()}
Size: ${(stats.size / 1024).toFixed(2)} KB
Modified: ${stats.mtime.toISOString()}

Note: This is a ${ext.slice(1).toUpperCase()} document. The Qwen model cannot directly parse document formats.
To analyze this file, you would need to:
1. Install a document parsing library (pdf-parse for PDF, mammoth for DOCX)
2. Extract the text content
3. Send the extracted text to the AI

For now, I can only provide file metadata.`;
    } else {
      // Try to read as text anyway
      try {
        content = fs.readFileSync(filePath, 'utf8').slice(0, 8000);
      } catch {
        const stats = fs.statSync(filePath);
        content = `[Binary file: ${path.basename(filePath)}]
Type: ${ext || 'unknown'}
Size: ${(stats.size / 1024).toFixed(2)} KB
Modified: ${stats.mtime.toISOString()}

This appears to be a binary file that cannot be read as text.`;
      }
    }

    const fileName = path.basename(filePath);
    const prompt = `Analyze this file and provide a detailed summary:

File: ${fileName}
Type: ${ext || 'unknown'}

Content:
${content}

Please provide:
1. A brief summary (2-3 sentences)
2. Key points or structure
3. Any notable patterns or information`;

    const response = await ollamaClient.chat({
      model: 'llama3.2:1b',
      messages: [{ role: 'user', content: prompt }],
      stream: false
    });

    return response.message.content;
  } catch (e) {
    console.error('Read file with AI error:', e);
    return `Error reading file: ${e.message}

The Qwen 2.5:0.5b model is a text-only model and cannot parse document formats like PDF, DOCX, etc. natively.

For document parsing, you would need to install additional libraries:
- pdf-parse (for PDF files)
- mammoth (for DOCX files)
- xlsx (for Excel files)

Would you like me to add these libraries to the project?`;
  }
});

ipcMain.handle('show-in-folder', async (_, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('get-file-properties', async (_, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      size: stat.size,
      created: stat.birthtime,
      modified: stat.mtime,
      isDirectory: stat.isDirectory()
    };
  } catch (e) {
    return null;
  }
});

ipcMain.handle('add-file-to-ai', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8').slice(0, 10000);
    if (!database.aiKnowledgeBase) database.aiKnowledgeBase = [];
    database.aiKnowledgeBase.push({
      filePath,
      content,
      addedAt: new Date().toISOString()
    });
    saveDatabase(database);
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('import-bookmarks-from-folder', async (_, folderPath) => {
  try {
    const items = fs.readdirSync(folderPath);
    let imported = 0;

    for (const item of items) {
      const fullPath = path.join(folderPath, item);
      const stat = fs.statSync(fullPath);

      if (!stat.isDirectory()) {
        const ext = path.extname(item).toLowerCase();
        const content = fs.readFileSync(fullPath, 'utf8');

        // Parse .url files (Windows internet shortcuts)
        if (ext === '.url') {
          const urlMatch = content.match(/URL=(.+)/);
          if (urlMatch) {
            const url = urlMatch[1].trim();
            const name = path.basename(item, ext);
            database.bookmarks.push({
              id: Date.now() + imported,
              name,
              url,
              mode: database.currentMode
            });
            imported++;
          }
        }
        // Parse .webloc files (macOS internet shortcuts)
        else if (ext === '.webloc') {
          const urlMatch = content.match(/<string>(.+?)<\/string>/);
          if (urlMatch) {
            const url = urlMatch[1].trim();
            const name = path.basename(item, ext);
            database.bookmarks.push({
              id: Date.now() + imported,
              name,
              url,
              mode: database.currentMode
            });
            imported++;
          }
        }
        // Parse HTML bookmark files
        else if (ext === '.html' || ext === '.htm') {
          const linkMatches = content.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);
          for (const match of linkMatches) {
            database.bookmarks.push({
              id: Date.now() + imported,
              name: match[2].trim(),
              url: match[1].trim(),
              mode: database.currentMode
            });
            imported++;
          }
        }
      }
    }

    saveDatabase(database);
    return { success: true, count: imported };
  } catch (e) {
    console.error('Import bookmarks error:', e);
    return { success: false, error: e.message };
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
      // Check if first-time setup and model needs to be pulled
      if (database.ollamaFirstTimeSetup) {
        console.log('🎯 First-time Ollama setup detected, will pull model...');
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-log', '🎯 First-time setup: Checking model...');
        }

        // Check if llama3.2:1b model exists
        try {
          const models = await ollamaClient.list();
          const modelExists = models.models.some(m => m.name.startsWith('llama3.2:1b'));

          if (!modelExists) {
            console.log('📥 Pulling llama3.2:1b model for first-time setup...');
            if (panelWindow && !panelWindow.isDestroyed()) {
              panelWindow.webContents.send('ollama-log', '📥 Downloading llama3.2:1b model (first-time setup)...');
            }

            const pullStream = await ollamaClient.pull({
              model: 'llama3.2:1b',
              stream: true
            });

            for await (const progress of pullStream) {
              if (progress.status) {
                console.log(`Model pull: ${progress.status}`);
                if (panelWindow && !panelWindow.isDestroyed()) {
                  panelWindow.webContents.send('ollama-download-progress', {
                    percent: progress.completed ? 100 : 50,
                    message: progress.status
                  });
                }
              }
            }

            console.log('✅ Model llama3.2:1b pulled successfully');
            if (panelWindow && !panelWindow.isDestroyed()) {
              panelWindow.webContents.send('ollama-log', '✅ Model downloaded successfully!');
            }
          } else {
            console.log('✅ Model llama3.2:1b already exists');
          }

          // Mark first-time setup as complete
          database.ollamaFirstTimeSetup = false;
          saveDatabase(database);
          console.log('✅ First-time setup complete');
        } catch (pullError) {
          console.error('Error during first-time model pull:', pullError);
          if (panelWindow && !panelWindow.isDestroyed()) {
            panelWindow.webContents.send('ollama-log', `⚠️ Model pull warning: ${pullError.message}`);
          }
        }
      }

      return { status: 'running', message: 'Ollama is already running' };
    }

    isOllamaStarting = true;

    // Notify user that Ollama is starting
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send('ollama-log', '🚀 Starting Ollama server...');
    }

    // Get metadata first to determine version
    const metadata = await eo.getMetadata('latest');
    const version = metadata.version;

    // Check if this specific version is already downloaded
    const isDownloaded = await eo.isDownloaded(version);

    if (isDownloaded) {
      console.log(`Ollama ${version} already downloaded, starting existing installation...`);
      if (panelWindow && !panelWindow.isDestroyed()) {
        panelWindow.webContents.send('ollama-log', `Starting Ollama ${version}...`);
      }
    } else {
      console.log(`Ollama ${version} not found, will download...`);
      if (panelWindow && !panelWindow.isDestroyed()) {
        panelWindow.webContents.send('ollama-log', `📥 Downloading Ollama ${version}...`);
      }
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
          panelWindow.webContents.send('ollama-download-progress', {
            percent,
            message: `Downloading Ollama: ${percent}% - ${message}`
          });
        }
      },
      timeoutSec: 60
    });

    isOllamaStarting = false;

    // After Ollama starts, check for first-time setup and pull model
    if (database.ollamaFirstTimeSetup) {
      console.log('🎯 First-time Ollama setup: Pulling llama3.2:1b model...');
      if (panelWindow && !panelWindow.isDestroyed()) {
        panelWindow.webContents.send('ollama-log', '📥 Downloading llama3.2:1b model (first-time setup)...');
      }

      try {
        const pullStream = await ollamaClient.pull({
          model: 'llama3.2:1b',
          stream: true
        });

        for await (const progress of pullStream) {
          if (progress.status) {
            console.log(`Model pull: ${progress.status}`);
            if (panelWindow && !panelWindow.isDestroyed()) {
              panelWindow.webContents.send('ollama-download-progress', {
                percent: progress.completed ? 100 : 50,
                message: `Downloading model: ${progress.status}`
              });
            }
          }
        }

        console.log('✅ Model llama3.2:1b pulled successfully');
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-log', '✅ Model downloaded successfully! Ready to use.');
        }

        // Mark first-time setup as complete
        database.ollamaFirstTimeSetup = false;
        saveDatabase(database);
        console.log('✅ First-time setup complete');
      } catch (pullError) {
        console.error('Error during first-time model pull:', pullError);
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-log', `⚠️ Model will be downloaded on first use: ${pullError.message}`);
        }
      }
    }

    return {
      status: 'started',
      message: 'Ollama server started successfully',
      version: version
    };

  } catch (error) {
    isOllamaStarting = false;
    console.error('Failed to start Ollama:', error);
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send('ollama-log', `❌ Error: ${error.message}`);
    }
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

ipcMain.handle('stop-ollama-generation', async () => {
  currentOllamaStream = null;
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send('ollama-done');
  }
  return { status: 'stopped' };
});

ipcMain.handle('chat-with-ollama', async (event, message, enableTools = true) => {
  const modelName = 'llama3.2:1b';
  const MAX_ITERATIONS = 5; // Prevent infinite loops
  const MAX_RESPONSE_LENGTH = 50000; // Limit response size to 50KB
  const MAX_TOOL_RESULT_LENGTH = 10000; // Limit tool result size
  let iterationCount = 0;
  let conversationHistory = [
    { role: 'user', content: message }
  ];
  let shouldContinue = true;

  try {
    // First check if model exists
    try {
      const models = await ollamaClient.list();
      const modelExists = models.models.some(m => m.name === modelName || m.name.startsWith('llama3.2:1b'));

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

    // Get available MCP tools
    let tools = [];
    console.log('enableTools:', enableTools, 'mcpManager:', !!mcpManager);

    if (enableTools && mcpManager) {
      const mcpTools = mcpManager.getAllTools();
      console.log('MCP tools available:', mcpTools.length);

      tools = mcpTools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || 'No description',
          parameters: tool.inputSchema || { type: 'object', properties: {} }
        }
      }));

      if (tools.length > 0) {
        console.log('Tools ready:', tools.map(t => t.function.name).join(', '));
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-thought', { type: 'tool_check', content: `Found ${tools.length} available tools` });
        }
      }
    } else {
      console.log('Tools disabled or mcpManager not available');
    }

    // Enhanced prompt with tool awareness - let AI reason intelligently
    let enhancedMessage = message;
    if (tools.length > 0) {
      const toolsList = tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');

      // Check if message contains file path indicators
      const hasFilePath = /[\/\\]|\.txt|\.md|\.js|\.py|\.json|\.css|\.html|file|path|read/i.test(message);

      if (hasFilePath) {
        // Direct instruction for file operations
        enhancedMessage = `You have tools to read and analyze files. When the user provides a file path, you MUST use the appropriate tool.

Available tools:
${toolsList}

User request: ${message}

IMPORTANT: If the message contains a file path, directory, or asks about file contents, respond ONLY with:
TOOL_CALL: read_file {"path": "the/file/path"}

Your response:`;
      } else {
        // General conversational prompt
        enhancedMessage = `You are a helpful AI assistant with access to tools.

Available tools:
${toolsList}

Guidelines:
- If user mentions specific files or paths, use read_file tool
- If user asks to analyze/read something, use appropriate tools
- Otherwise, respond naturally in conversation

Format tool calls as: TOOL_CALL: tool_name {"arg": "value"}

User request: ${message}

Your response:`;
      }
    }

    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send('ollama-thought', { type: 'thinking', content: 'Processing your request...' });
    }

    const response = await ollamaClient.chat({
      model: modelName,
      messages: [{ role: 'user', content: enhancedMessage }],
      stream: true,
    });

    currentOllamaStream = response;
    let fullResponse = '';
    let hasToolIndicator = false;

    try {
      for await (const chunk of response) {
        if (!currentOllamaStream) break;

        // Memory safety: Stop if response is too large
        if (fullResponse.length > MAX_RESPONSE_LENGTH) {
          console.warn('Response too large, truncating');
          fullResponse += '\n\n[Response truncated due to memory limits]';
          break;
        }

        if (chunk.message && chunk.message.content) {
          fullResponse += chunk.message.content;

          // Check if response contains tool-related keywords early
          if (!hasToolIndicator && (
            fullResponse.includes('TOOL_CALL:') ||
            fullResponse.includes('USER_CALL:') ||
            fullResponse.includes('execute') ||
            fullResponse.includes('"path"') ||
            fullResponse.includes('.pdf') ||
            fullResponse.includes('.docx')
          )) {
            hasToolIndicator = true;
            console.log('Tool indicator detected - stopping UI stream');
          }

          // Only stream to UI if it's NOT a tool call
          if (!hasToolIndicator && panelWindow && !panelWindow.isDestroyed()) {
            panelWindow.webContents.send('ollama-chunk', chunk.message.content);
          }
        }
        // Check for done flag
        if (chunk.done) {
          break;
        }
      }
    } catch (streamError) {
      console.error('Stream error:', streamError);
      // Continue anyway, we may have received partial response
    }

    currentOllamaStream = null;

    // Clear large response from memory after processing
    if (fullResponse.length > 1000) {
      console.log(`Response size: ${fullResponse.length} bytes`);
    }

    console.log('Full response:', fullResponse.substring(0, 200));
    console.log('Had tool indicator:', hasToolIndicator);

    // Check if response contains tool call OR looks like tool arguments
    let shouldExecuteTool = false;
    let toolCallMatch = null;

    // Method 1: Proper TOOL_CALL: format
    if (fullResponse.includes('TOOL_CALL:')) {
      console.log('Tool call detected with TOOL_CALL: prefix');
      toolCallMatch = fullResponse.match(/TOOL_CALL:\s*(\w+)\s+(.+)/s);
      shouldExecuteTool = true;
    }
    // Method 2: USER_CALL or any variant
    else if (fullResponse.match(/(USER_CALL|CALL):\s*(\w+)\s+(.+)/s)) {
      console.log('Tool call detected with alternate prefix');
      const match = fullResponse.match(/(USER_CALL|CALL):\s*(\w+)\s+(.+)/s);
      if (match) {
        toolCallMatch = ['', match[2], match[3]]; // Extract tool name and args
        shouldExecuteTool = true;
      }
    }
    // Method 3: JSON-only response with path
    else if (fullResponse.match(/^\s*\{.*"path"\s*:\s*".*\}\s*$/s)) {
      console.log('Detected JSON-only response, assuming read_file tool call');
      const jsonMatch = fullResponse.match(/\{.*\}/s);
      if (jsonMatch) {
        toolCallMatch = ['', 'read_file', jsonMatch[0]];
        shouldExecuteTool = true;
      }
    }
    // Method 4: AI explaining the tool format - extract and execute anyway
    else if (fullResponse.includes('"path"') && fullResponse.match(/\{.*"path"\s*:\s*\{.*"value"\s*:\s*"([^"]+)"/s)) {
      console.log('AI tried to explain tool format - extracting path value');
      const pathMatch = fullResponse.match(/"value"\s*:\s*"([^"]+)"/);
      if (pathMatch) {
        toolCallMatch = ['', 'read_file', JSON.stringify({ path: pathMatch[1] })];
        shouldExecuteTool = true;
      }
    }
    // Method 5: Simple path in response
    else if (fullResponse.match(/["']([C-Z]:\\.*?\.(pdf|docx?|txt|md))["']/i)) {
      console.log('Found file path in response - executing read_file');
      const pathMatch = fullResponse.match(/["']([C-Z]:\\.*?\.(pdf|docx?|txt|md))["']/i);
      if (pathMatch) {
        toolCallMatch = ['', 'read_file', JSON.stringify({ path: pathMatch[1] })];
        shouldExecuteTool = true;
      }
    }

    console.log('Should execute tool?', shouldExecuteTool, 'Match:', toolCallMatch ? 'yes' : 'no');

    if (shouldExecuteTool && toolCallMatch && mcpManager) {
        const [, toolName, argsString] = toolCallMatch;

        // Clear message and show tool execution status
        if (panelWindow && !panelWindow.isDestroyed()) {
          // Don't show the AI's explanation text, show clean status
          panelWindow.webContents.send('ollama-chunk', `🔧 Executing ${toolName}...\n`);
          panelWindow.webContents.send('ollama-thought', { type: 'tool_call', content: `Calling tool: ${toolName}` });
        }

        try {
          let args = {};

          // Extract arguments - handle various formats
          const trimmed = argsString.trim();

          // Try to parse as proper JSON first
          try {
            args = JSON.parse(trimmed);
          } catch (e) {
            // Handle format like: {path: C:\Users\...\file.docx}
            // Or: {C:\Users\...\file.docx}
            const pathMatch = trimmed.match(/\{?\s*(?:path\s*:\s*)?(.+?)\s*\}?$/s);
            if (pathMatch) {
              const pathValue = pathMatch[1].trim();
              args = { path: pathValue };
            } else {
              // Fallback: treat entire string as path
              args = { path: trimmed.replace(/[{}]/g, '').trim() };
            }
          }

          console.log(`Calling MCP tool: ${toolName} with args:`, args);

          // Send structured message for UI
          if (panelWindow && !panelWindow.isDestroyed()) {
            panelWindow.webContents.send('tool-call-start', {
              toolName,
              args,
              query: message
            });
          }

          const toolResult = await mcpManager.callTool(toolName, args);

          // Send result to UI
          if (panelWindow && !panelWindow.isDestroyed()) {
            panelWindow.webContents.send('tool-call-result', {
              toolName,
              result: toolResult
            });
          }

          if (panelWindow && !panelWindow.isDestroyed()) {
            panelWindow.webContents.send('ollama-thought', { type: 'tool_result', content: `Tool completed: ${toolName}` });
          }

          // Feed the tool result back to AI for analysis
          let resultText = '';
          if (toolResult && toolResult.content) {
            const content = Array.isArray(toolResult.content) ? toolResult.content : [toolResult.content];
            resultText = content.map(c => {
              if (typeof c === 'object' && c.text) return c.text;
              if (typeof c === 'string') return c;
              return JSON.stringify(c, null, 2);
            }).join('\n');
          } else {
            resultText = JSON.stringify(toolResult, null, 2);
          }

          // Truncate tool results to prevent memory bloat
          if (resultText.length > MAX_TOOL_RESULT_LENGTH) {
            console.warn(`Tool result too large (${resultText.length} bytes), truncating`);
            resultText = resultText.substring(0, MAX_TOOL_RESULT_LENGTH) + '\n\n[Result truncated for memory safety]';
          }

          console.log('Tool result text:', resultText.substring(0, 200) + '...');

          // AGENTIC LOOP: Feed result back and let AI decide next action
          conversationHistory.push({
            role: 'assistant',
            content: `I executed ${toolName} tool`
          });

          // Ask AI: do you need more tools or can you answer now?
          // Limit prompt size to prevent memory issues
          const truncatedResult = resultText.substring(0, 2000);
          const agenticPrompt = `Tool execution result from ${toolName}:
${truncatedResult}

Original user request: "${message}"

Now analyze the result and decide:
- Do you have enough information to answer the user's question comprehensively?
- Or do you need to use another tool to gather more information?

If you can answer: Provide a clear, helpful response to the user
If you need more info: Use TOOL_CALL: tool_name {"arg": "value"}

Your response:`;

          conversationHistory.push({ role: 'user', content: agenticPrompt });

          // Trim conversation history to prevent unbounded growth
          if (conversationHistory.length > 10) {
            conversationHistory = [
              conversationHistory[0], // Keep original user message
              ...conversationHistory.slice(-8) // Keep last 8 messages
            ];
          }

          if (panelWindow && !panelWindow.isDestroyed()) {
            panelWindow.webContents.send('ollama-chunk', `\n📊 Analyzing (iteration ${iterationCount + 1}/${MAX_ITERATIONS})...\n\n`);
            panelWindow.webContents.send('ollama-thought', { type: 'reasoning', content: 'Agent reasoning...' });
          }

          // Get AI's next decision
          const decisionResponse = await ollamaClient.chat({
            model: modelName,
            messages: conversationHistory,
            stream: true,
          });

          let decisionText = '';
          for await (const chunk of decisionResponse) {
            if (chunk.message && chunk.message.content) {
              decisionText += chunk.message.content;
              if (panelWindow && !panelWindow.isDestroyed()) {
                panelWindow.webContents.send('ollama-chunk', chunk.message.content);
              }
            }
            if (chunk.done) break;
          }

          conversationHistory.push({ role: 'assistant', content: decisionText });

          // Check if AI wants to use another tool
          iterationCount++;
          if (iterationCount >= MAX_ITERATIONS) {
            console.log('Max iterations reached, stopping agentic loop');
            shouldContinue = false;
          } else if (decisionText.includes('TOOL_CALL:') || decisionText.includes('"path"')) {
            console.log('AI wants to use another tool, continuing loop...');
            // Loop will continue and process this new tool call
          } else {
            console.log('AI provided final answer, stopping loop');
            shouldContinue = false;
          }
      } catch (toolError) {
        console.error('Tool execution error:', toolError);
        console.error('Args string was:', argsString);
        if (panelWindow && !panelWindow.isDestroyed()) {
          panelWindow.webContents.send('ollama-thought', { type: 'error', content: `Tool error: ${toolError.message}` });
          panelWindow.webContents.send('ollama-chunk', `\n\n**❌ Error:** ${toolError.message}\n`);
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

        try {
          for await (const chunk of retryResponse) {
            if (chunk.message && chunk.message.content) {
              if (panelWindow && !panelWindow.isDestroyed()) {
                panelWindow.webContents.send('ollama-chunk', chunk.message.content);
              }
            }
            if (chunk.done) {
              break;
            }
          }
        } catch (retryStreamError) {
          console.error('Retry stream error:', retryStreamError);
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
const MAX_CHAT_HISTORY = 50; // Limit to last 50 messages per mode

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
  // Save the entire chat history object (chatWindows and activeChat)
  // No need to slice since this is the entire state
  database.chatHistory[mode] = messages;
  saveDatabase(database);

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

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

// MCP IPC Handlers
ipcMain.handle('get-mcp-config', () => {
  return loadMCPConfig();
});

ipcMain.handle('save-mcp-server', async (_, { name, command, args, env }) => {
  const config = loadMCPConfig();
  config.mcpServers[name] = { command, args, env };
  saveMCPConfig(config);

  // Connect to the new server
  if (mcpManager) {
    const result = await mcpManager.connectServer(name, command, args, env);
    return result;
  }
  return { success: false, error: 'MCP Manager not initialized' };
});

ipcMain.handle('remove-mcp-server', async (_, serverName) => {
  const config = loadMCPConfig();
  delete config.mcpServers[serverName];
  saveMCPConfig(config);

  // Disconnect from the server
  if (mcpManager) {
    await mcpManager.disconnectServer(serverName);
  }
  return { success: true };
});

ipcMain.handle('get-mcp-tools', () => {
  if (mcpManager) {
    return mcpManager.getAllTools();
  }
  return [];
});

ipcMain.handle('get-mcp-servers', () => {
  if (mcpManager) {
    return mcpManager.getConnectedServers();
  }
  return [];
});

ipcMain.handle('call-mcp-tool', async (_, { toolName, args }) => {
  if (mcpManager) {
    try {
      const result = await mcpManager.callTool(toolName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'MCP Manager not initialized' };
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