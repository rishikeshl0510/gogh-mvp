const fs = require('fs');

console.log('🔧 Gogh - CRT Terminal Glass UI...\n');

// ============================================
// MAIN.JS - Panel doesn't close during drag
// ============================================
const mainJS = `const { app, BrowserWindow, globalShortcut, screen, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let sidebarWindow = null;
let commandWindow = null;
let panelWindow = null;
let currentPanel = null;
let isDragging = false;

const DB_PATH = path.join(app.getPath('userData'), 'gogh-data.json');
Menu.setApplicationMenu(null);

function loadDatabase() {
  try {
    return fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : {
      modes: [{ id: 'default', name: 'Work', color: '#00ff41' }, { id: 'personal', name: 'Personal', color: '#39ff14' }],
      files: [], tasks: [], events: [], currentMode: 'default'
    };
  } catch { return { modes: [{ id: 'default', name: 'Work', color: '#00ff41' }], files: [], tasks: [], events: [], currentMode: 'default' }; }
}

function saveDatabase(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); return true; }
  catch { return false; }
}

let database = loadDatabase();

function createSidebar() {
  const { height } = screen.getPrimaryDisplay().workAreaSize;
  sidebarWindow = new BrowserWindow({
    width: 70, height: height - 80,
    x: 20, y: 40,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true, show: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
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
    width: 420, height: height - 80,
    x: 100, y: 40,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true, show: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload-panel.js')
    }
  });
  
  panelWindow.loadFile('panel.html');
  panelWindow.webContents.once('did-finish-load', () => {
    panelWindow.webContents.send('set-panel', section);
  });
  
  currentPanel = section;
  
  // Panel stays open during drag operations
  panelWindow.on('close', () => {
    panelWindow = null;
    currentPanel = null;
  });
}

function createCommandPalette() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  commandWindow = new BrowserWindow({
    width: 700, height: 520,
    x: Math.round((width - 700) / 2), y: Math.round((height - 520) / 3),
    frame: false, transparent: true, alwaysOnTop: true,
    show: false, skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload-command.js')
    }
  });
  commandWindow.loadFile('command.html');
  commandWindow.on('blur', () => commandWindow.hide());
}

function toggleCommand() {
  if (commandWindow.isVisible()) commandWindow.hide();
  else { commandWindow.show(); commandWindow.focus(); }
}

app.whenReady().then(() => {
  createSidebar();
  createCommandPalette();
  
  const cmdShortcut = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Space';
  globalShortcut.register(cmdShortcut, toggleCommand);
  
  globalShortcut.register('Escape', () => {
    if (panelWindow) panelWindow.close();
  });
  
  console.log('✅ Gogh Ready - CRT Mode');
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('open-panel', (_, section) => { createPanel(section); return true; });
ipcMain.handle('get-data', () => database);
ipcMain.handle('add-file', (_, file) => { database.files.push(file); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('remove-file', (_, id) => { database.files = database.files.filter(f => f.id !== id); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('add-task', (_, task) => { database.tasks.push(task); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('toggle-task', (_, id) => { const t = database.tasks.find(x => x.id === id); if (t) t.completed = !t.completed; saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('delete-task', (_, id) => { database.tasks = database.tasks.filter(t => t.id !== id); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('add-event', (_, evt) => { database.events.push(evt); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('add-mode', (_, mode) => { database.modes.push(mode); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('switch-mode', (_, id) => { database.currentMode = id; saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('open-file', (_, path) => { require('electron').shell.openPath(path); return true; });
ipcMain.handle('select-files', async () => { const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] }); return r.filePaths; });
ipcMain.handle('hide-command', () => { commandWindow.hide(); return true; });
`;

// ============================================
// SIDEBAR HTML - CRT Green
// ============================================
const sidebarHTML = `<!DOCTYPE html>
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
      width: 70px;
      height: 100%;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(20px) saturate(120%);
      -webkit-backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 14px;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(0, 255, 65, 0.1),
        0 0 20px rgba(0, 255, 65, 0.15);
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 16px 0;
    }
    
    .logo {
      width: 100%;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }
    .logo-text {
      font-size: 24px;
      font-weight: bold;
      color: #00ff41;
      text-shadow: 0 0 10px #00ff41, 0 0 20px #00ff41;
      letter-spacing: 2px;
    }
    
    .nav-item {
      width: 100%;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
      -webkit-app-region: no-drag;
    }
    .nav-item:hover {
      background: rgba(0, 255, 65, 0.08);
    }
    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      width: 3px;
      height: 40px;
      background: #00ff41;
      border-radius: 0 2px 2px 0;
      box-shadow: 0 0 10px #00ff41;
    }
    
    .nav-icon {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 255, 65, 0.06);
      border: 1px solid rgba(0, 255, 65, 0.2);
      border-radius: 10px;
      position: relative;
    }
    .nav-icon svg {
      width: 22px;
      height: 22px;
      stroke: #00ff41;
      stroke-width: 2;
      filter: drop-shadow(0 0 3px #00ff41);
    }
    
    .badge {
      position: absolute;
      top: -6px;
      right: -6px;
      background: #00ff41;
      color: #000;
      padding: 2px 6px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: bold;
      min-width: 18px;
      text-align: center;
      border: 2px solid #000;
      box-shadow: 0 0 8px #00ff41;
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="logo">
      <div class="logo-text">G</div>
    </div>
    
    <div class="nav-item" onclick="openPanel('files')">
      <div class="nav-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>
        <span class="badge" id="filesBadge">0</span>
      </div>
    </div>
    
    <div class="nav-item" onclick="openPanel('tasks')">
      <div class="nav-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <span class="badge" id="tasksBadge">0</span>
      </div>
    </div>
    
    <div class="nav-item" onclick="openPanel('calendar')">
      <div class="nav-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span class="badge" id="eventsBadge">0</span>
      </div>
    </div>
    
    <div class="nav-item" onclick="openPanel('modes')">
      <div class="nav-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6"/>
        </svg>
      </div>
    </div>
  </div>
  <script src="renderer-sidebar.js"></script>
</body>
</html>`;

// ============================================
// PANEL HTML - CRT Terminal Style
// ============================================
const panelHTML = `<!DOCTYPE html>
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
      color: #00ff41;
    }
    .panel {
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(20px) saturate(120%);
      -webkit-backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 14px;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(0, 255, 65, 0.1),
        0 0 20px rgba(0, 255, 65, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(0, 255, 65, 0.2);
      background: rgba(0, 0, 0, 0.3);
    }
    .title {
      font-size: 16px;
      font-weight: bold;
      color: #00ff41;
      text-shadow: 0 0 8px #00ff41;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .title::before {
      content: '> ';
      opacity: 0.7;
    }
    
    .mode-bar {
      padding: 12px 24px;
      border-bottom: 1px solid rgba(0, 255, 65, 0.2);
      background: rgba(0, 0, 0, 0.2);
    }
    .mode-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
    }
    .mode-tabs::-webkit-scrollbar { height: 4px; }
    .mode-tabs::-webkit-scrollbar-thumb { background: rgba(0, 255, 65, 0.3); }
    .mode-tab {
      padding: 6px 14px;
      background: rgba(0, 255, 65, 0.06);
      border: 1px solid rgba(0, 255, 65, 0.2);
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .mode-tab:hover {
      background: rgba(0, 255, 65, 0.12);
    }
    .mode-tab.active {
      background: #00ff41;
      color: #000;
      box-shadow: 0 0 10px #00ff41;
    }
    
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
    }
    .content::-webkit-scrollbar { width: 6px; }
    .content::-webkit-scrollbar-thumb {
      background: rgba(0, 255, 65, 0.3);
      border-radius: 3px;
    }
    
    .quick-add {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .input {
      flex: 1;
      padding: 12px 14px;
      background: rgba(0, 255, 65, 0.04);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 8px;
      color: #00ff41;
      font-size: 13px;
      font-family: 'Courier New', monospace;
      outline: none;
      transition: all 0.2s;
    }
    .input:focus {
      background: rgba(0, 255, 65, 0.08);
      border-color: #00ff41;
      box-shadow: 0 0 10px rgba(0, 255, 65, 0.2);
    }
    .input::placeholder { color: rgba(0, 255, 65, 0.4); }
    
    .btn {
      padding: 12px 20px;
      background: #00ff41;
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
      box-shadow: 0 0 10px rgba(0, 255, 65, 0.5);
    }
    .btn:hover {
      box-shadow: 0 0 15px #00ff41;
      transform: translateY(-1px);
    }
    
    .drop-zone {
      border: 2px dashed rgba(0, 255, 65, 0.3);
      border-radius: 10px;
      padding: 40px;
      text-align: center;
      color: rgba(0, 255, 65, 0.6);
      margin-bottom: 20px;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 13px;
      letter-spacing: 0.5px;
    }
    .drop-zone:hover,
    .drop-zone.drag-over {
      border-color: #00ff41;
      background: rgba(0, 255, 65, 0.05);
      box-shadow: 0 0 20px rgba(0, 255, 65, 0.15);
    }
    
    /* TASK LIST - Graph-like UI */
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .task-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: rgba(0, 255, 65, 0.04);
      border: 1px solid rgba(0, 255, 65, 0.2);
      border-left: 3px solid #00ff41;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    .task-item:hover {
      background: rgba(0, 255, 65, 0.08);
      border-left-width: 4px;
      transform: translateX(2px);
    }
    .task-item.completed {
      opacity: 0.5;
      text-decoration: line-through;
    }
    .task-checkbox {
      width: 18px;
      height: 18px;
      border: 2px solid #00ff41;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: rgba(0, 255, 65, 0.06);
    }
    .task-checkbox.checked {
      background: #00ff41;
    }
    .task-checkbox.checked::after {
      content: '✓';
      color: #000;
      font-size: 12px;
      font-weight: bold;
    }
    .task-content {
      flex: 1;
      min-width: 0;
    }
    .task-title {
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 4px;
      line-height: 1.4;
    }
    .task-meta {
      font-size: 10px;
      opacity: 0.6;
      letter-spacing: 0.5px;
    }
    .task-delete {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid rgba(255, 0, 0, 0.3);
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: all 0.2s;
      color: #ff4444;
      font-size: 14px;
    }
    .task-item:hover .task-delete {
      opacity: 1;
    }
    
    .file-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: rgba(0, 255, 65, 0.04);
      border: 1px solid rgba(0, 255, 65, 0.2);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .file-item:hover {
      background: rgba(0, 255, 65, 0.08);
      transform: translateX(2px);
    }
    .file-icon {
      width: 32px;
      height: 32px;
      background: rgba(0, 255, 65, 0.1);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
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
      color: rgba(0, 255, 65, 0.3);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="panel">
    <div class="header">
      <div class="title" id="panelTitle">Panel</div>
    </div>
    <div class="mode-bar">
      <div class="mode-tabs" id="modeTabs"></div>
    </div>
    <div class="content" id="panelContent"></div>
  </div>
  <script src="renderer-panel.js"></script>
</body>
</html>`;

// ============================================
// COMMAND HTML - CRT Style
// ============================================
const commandHTML = `<!DOCTYPE html>
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
      width: 640px;
      background: rgba(0, 0, 0, 0.90);
      backdrop-filter: blur(20px) saturate(120%);
      -webkit-backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 14px;
      box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.7),
        0 0 30px rgba(0, 255, 65, 0.15);
      overflow: hidden;
    }
    .input-wrap {
      display: flex;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(0, 255, 65, 0.2);
      -webkit-app-region: no-drag;
    }
    .prompt {
      color: #00ff41;
      font-weight: bold;
      margin-right: 10px;
      text-shadow: 0 0 5px #00ff41;
    }
    input {
      flex: 1;
      background: transparent;
      border: none;
      color: #00ff41;
      font-size: 16px;
      font-family: 'Courier New', monospace;
      outline: none;
    }
    input::placeholder { color: rgba(0, 255, 65, 0.4); }
    .list {
      max-height: 400px;
      overflow-y: auto;
      padding: 8px;
    }
    .list::-webkit-scrollbar { width: 6px; }
    .list::-webkit-scrollbar-thumb { background: rgba(0, 255, 65, 0.3); }
    .item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 8px;
      cursor: pointer;
      margin: 4px 0;
      transition: all 0.15s;
      -webkit-app-region: no-drag;
      border: 1px solid transparent;
    }
    .item:hover, .item.selected {
      background: rgba(0, 255, 65, 0.08);
      border-color: rgba(0, 255, 65, 0.3);
    }
    .item-icon {
      width: 38px;
      height: 38px;
      background: rgba(0, 255, 65, 0.1);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .item-icon svg {
      width: 20px;
      height: 20px;
      stroke: #00ff41;
    }
    .item-content {
      flex: 1;
    }
    .item-title {
      font-size: 14px;
      font-weight: 500;
      color: #00ff41;
      margin-bottom: 3px;
    }
    .item-desc {
      font-size: 12px;
      color: rgba(0, 255, 65, 0.6);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="palette">
    <div class="input-wrap">
      <span class="prompt">></span>
      <input id="input" placeholder="enter command..." autocomplete="off">
    </div>
    <div id="list" class="list hidden"></div>
  </div>
  <script src="renderer-command.js"></script>
</body>
</html>`;

// ============================================
// PRELOAD FILES
// ============================================
const preloadSidebar = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sidebarAPI', {
  openPanel: (section) => ipcRenderer.invoke('open-panel', section),
  getData: () => ipcRenderer.invoke('get-data')
});`;

const preloadPanel = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('panelAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  addFile: (file) => ipcRenderer.invoke('add-file', file),
  removeFile: (id) => ipcRenderer.invoke('remove-file', id),
  addTask: (task) => ipcRenderer.invoke('add-task', task),
  toggleTask: (id) => ipcRenderer.invoke('toggle-task', id),
  deleteTask: (id) => ipcRenderer.invoke('delete-task', id),
  addEvent: (evt) => ipcRenderer.invoke('add-event', evt),
  addMode: (mode) => ipcRenderer.invoke('add-mode', mode),
  switchMode: (id) => ipcRenderer.invoke('switch-mode', id),
  openFile: (path) => ipcRenderer.invoke('open-file', path),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  onSetPanel: (callback) => ipcRenderer.on('set-panel', (_, section) => callback(section)),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});`;

const preloadCommand = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('commandAPI', {
  hide: () => ipcRenderer.invoke('hide-command')
});`;

// ============================================
// RENDERER FILES
// ============================================
const rendererSidebar = `let data = null;
async function init() {
  data = await window.sidebarAPI.getData();
  updateBadges();
  setInterval(async () => {
    data = await window.sidebarAPI.getData();
    updateBadges();
  }, 2000);
}
function openPanel(section) {
  window.sidebarAPI.openPanel(section);
}
function updateBadges() {
  const m = data.currentMode;
  document.getElementById('filesBadge').textContent = data.files.filter(f => f.mode === m).length;
  document.getElementById('tasksBadge').textContent = data.tasks.filter(t => t.mode === m && !t.completed).length;
  document.getElementById('eventsBadge').textContent = data.events.filter(e => e.mode === m).length;
}
init();`;

const rendererPanel = `let data = null;
let currentSection = null;

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
  renderModes();
  
  const content = document.getElementById('panelContent');
  if (currentSection === 'files') renderFiles(content);
  else if (currentSection === 'tasks') renderTasks(content);
  else if (currentSection === 'calendar') renderCalendar(content);
  else if (currentSection === 'modes') renderModesPanel(content);
}

function renderModes() {
  const tabs = document.getElementById('modeTabs');
  tabs.innerHTML = data.modes.map(m => 
    \`<div class="mode-tab \${m.id === data.currentMode ? 'active' : ''}" onclick="switchMode('\${m.id}')">\${m.name}</div>\`
  ).join('');
}

async function switchMode(id) {
  data = await window.panelAPI.switchMode(id);
  render();
}

function renderFiles(content) {
  const filtered = data.files.filter(f => f.mode === data.currentMode);
  content.innerHTML = \`
    <div class="drop-zone" id="drop">[ DROP FILES HERE ]</div>
    <div id="files">\${filtered.length ? filtered.map(f => \`
      <div class="file-item" onclick="openFile('\${f.path}')">
        <div class="file-icon">📄</div>
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

function renderTasks(content) {
  const filtered = data.tasks.filter(t => t.mode === data.currentMode);
  const active = filtered.filter(t => !t.completed);
  const completed = filtered.filter(t => t.completed);
  
  content.innerHTML = \`
    <div class="quick-add">
      <input type="text" id="taskIn" class="input" placeholder="New task... (press Enter)">
      <button class="btn" onclick="addTask()">+</button>
    </div>
    <div class="task-list">
      \${active.length ? active.map(t => \`
        <div class="task-item">
          <div class="task-checkbox" onclick="toggleTask('\${t.id}')"></div>
          <div class="task-content">
            <div class="task-title">\${t.title}</div>
            <div class="task-meta">\${new Date(t.date).toLocaleString()}</div>
          </div>
          <div class="task-delete" onclick="deleteTask('\${t.id}')">×</div>
        </div>
      \`).join('') : '<div class="empty">NO ACTIVE TASKS</div>'}
      \${completed.length ? '<div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(0,255,65,0.2)"></div>' : ''}
      \${completed.map(t => \`
        <div class="task-item completed">
          <div class="task-checkbox checked" onclick="toggleTask('\${t.id}')"></div>
          <div class="task-content">
            <div class="task-title">\${t.title}</div>
            <div class="task-meta">\${new Date(t.date).toLocaleString()}</div>
          </div>
          <div class="task-delete" onclick="deleteTask('\${t.id}')">×</div>
        </div>
      \`).join('')}
    </div>
  \`;
  
  const input = document.getElementById('taskIn');
  input.focus();
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
  });
}

function renderCalendar(content) {
  const filtered = data.events.filter(e => e.mode === data.currentMode);
  content.innerHTML = \`
    <input type="text" id="evTitle" class="input" placeholder="Event title..." style="margin-bottom:8px">
    <input type="datetime-local" id="evTime" class="input" style="margin-bottom:12px">
    <button class="btn" onclick="addEvent()">+ ADD EVENT</button>
    <div style="margin-top:20px">\${filtered.length ? filtered.map(e => \`
      <div class="file-item">
        <div class="file-icon">📅</div>
        <div class="file-info">
          <div class="file-name">\${e.title}</div>
          <div style="font-size:10px;opacity:0.6;margin-top:4px">\${new Date(e.time).toLocaleString()}</div>
        </div>
      </div>
    \`).join('') : '<div class="empty">NO EVENTS</div>'}</div>
  \`;
}

function renderModesPanel(content) {
  content.innerHTML = \`
    <input type="text" id="modeName" class="input" placeholder="Mode name..." style="margin-bottom:12px">
    <button class="btn" onclick="addMode()">+ CREATE MODE</button>
    <div style="margin-top:20px">\${data.modes.map(m => \`
      <div class="file-item">
        <div class="file-icon">🎨</div>
        <div class="file-info">
          <div class="file-name">\${m.name}</div>
        </div>
      </div>
    \`).join('')}</div>
  \`;
}

function setupDrop() {
  const zone = document.getElementById('drop');
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    for (const file of Array.from(e.dataTransfer.files)) {
      await window.panelAPI.addFile({
        id: Date.now() + Math.random(),
        name: file.name,
        path: file.path,
        size: file.size,
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
      size: 0,
      mode: data.currentMode,
      date: new Date().toISOString()
    });
  }
}

async function openFile(path) { await window.panelAPI.openFile(path); }
async function removeFile(id) { await window.panelAPI.removeFile(id); }

async function addTask() {
  const inp = document.getElementById('taskIn');
  if (!inp.value.trim()) return;
  await window.panelAPI.addTask({
    id: Date.now(),
    title: inp.value,
    mode: data.currentMode,
    completed: false,
    date: new Date().toISOString()
  });
}

async function toggleTask(id) { await window.panelAPI.toggleTask(id); }
async function deleteTask(id) { await window.panelAPI.deleteTask(id); }

async function addEvent() {
  const title = document.getElementById('evTitle');
  const time = document.getElementById('evTime');
  if (!title.value.trim() || !time.value) return;
  await window.panelAPI.addEvent({
    id: Date.now(),
    title: title.value,
    time: time.value,
    mode: data.currentMode
  });
}

async function addMode() {
  const name = document.getElementById('modeName');
  if (!name.value.trim()) return;
  await window.panelAPI.addMode({
    id: 'mode_' + Date.now(),
    name: name.value,
    color: '#00ff41'
  });
}

init();`;

const rendererCommand = `const input = document.getElementById('input');
const list = document.getElementById('list');
let commands = [];
let selected = -1;

input.focus();

input.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  if (!query) {
    list.classList.add('hidden');
    return;
  }
  
  commands = [
    {
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      title: 'AI: ' + query,
      desc: 'Ask AI about this...'
    },
    {
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      title: 'Copy: ' + query,
      desc: 'Copy to clipboard'
    },
    {
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
      title: 'Search Web',
      desc: 'Google: ' + query
    }
  ];
  
  showCommands();
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selected = (selected + 1) % commands.length;
    updateSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selected = selected <= 0 ? commands.length - 1 : selected - 1;
    updateSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    execute();
  } else if (e.key === 'Escape') {
    window.commandAPI.hide();
  }
});

function showCommands() {
  list.innerHTML = '';
  commands.forEach((cmd, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = \`
      <div class="item-icon">\${cmd.icon}</div>
      <div class="item-content">
        <div class="item-title">\${cmd.title}</div>
        <div class="item-desc">\${cmd.desc}</div>
      </div>
    \`;
    item.onclick = () => {
      selected = i;
      execute();
    };
    list.appendChild(item);
  });
  list.classList.remove('hidden');
  selected = 0;
  updateSelection();
}

function updateSelection() {
  document.querySelectorAll('.item').forEach((el, i) => {
    el.classList.toggle('selected', i === selected);
  });
}

function execute() {
  console.log('Execute:', commands[selected]);
  window.commandAPI.hide();
}`;

// WRITE FILES
console.log('Writing files...');
fs.writeFileSync('main.js', mainJS);
fs.writeFileSync('sidebar.html', sidebarHTML);
fs.writeFileSync('panel.html', panelHTML);
fs.writeFileSync('command.html', commandHTML);
fs.writeFileSync('preload-sidebar.js', preloadSidebar);
fs.writeFileSync('preload-panel.js', preloadPanel);
fs.writeFileSync('preload-command.js', preloadCommand);
fs.writeFileSync('renderer-sidebar.js', rendererSidebar);
fs.writeFileSync('renderer-panel.js', rendererPanel);
fs.writeFileSync('renderer-command.js', rendererCommand);

console.log('\n✅ CRT Glass UI Complete!');
console.log('\n🎨 Features:');
console.log('  • Terminal green CRT aesthetic');
console.log('  • Glass background (higher opacity)');
console.log('  • Panel STAYS OPEN during drag/drop');
console.log('  • Beautiful task list UI (graph-like)');
console.log('  • Quick task creation (press Enter)');
console.log('  • Task checkboxes + delete buttons');
console.log('\n▶️  Run: npm start');
console.log('⌨️  ESC to close panel');
