const fs = require('fs');

console.log('🔧 Gogh - White CRT + Noise Mode Selector...\n');

const mainJS = `const { app, BrowserWindow, globalShortcut, screen, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let sidebarWindow = null;
let commandWindow = null;
let panelWindow = null;
let modeWindow = null;
let currentPanel = null;

const DB_PATH = path.join(app.getPath('userData'), 'gogh-data.json');
Menu.setApplicationMenu(null);

function loadDatabase() {
  try {
    return fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : {
      modes: [
        { id: 'default', name: 'Work', color: '#ffffff' },
        { id: 'personal', name: 'Personal', color: '#cccccc' },
        { id: 'focus', name: 'Focus', color: '#999999' }
      ],
      files: [], tasks: [], events: [], currentMode: 'default'
    };
  } catch { return { modes: [{ id: 'default', name: 'Work', color: '#ffffff' }], files: [], tasks: [], events: [], currentMode: 'default' }; }
}

function saveDatabase(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); return true; }
  catch { return false; }
}

let database = loadDatabase();

function createSidebar() {
  const { height } = screen.getPrimaryDisplay().workAreaSize;
  sidebarWindow = new BrowserWindow({
    width: 56, height: 280,
    x: 20, y: Math.round((height - 280) / 2),
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

function createModeSelector() {
  if (modeWindow) {
    modeWindow.close();
    modeWindow = null;
    return;
  }
  
  const { height } = screen.getPrimaryDisplay().workAreaSize;
  modeWindow = new BrowserWindow({
    width: 240, height: 280,
    x: 86, y: Math.round((height - 280) / 2),
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true, show: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload-mode.js')
    }
  });
  
  modeWindow.loadFile('mode.html');
  modeWindow.on('close', () => modeWindow = null);
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
    x: 86, y: 40,
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
  panelWindow.on('close', () => { panelWindow = null; currentPanel = null; });
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
    if (modeWindow) modeWindow.close();
  });
  
  console.log('✅ Gogh Ready - White CRT');
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('open-panel', (_, section) => { createPanel(section); return true; });
ipcMain.handle('open-mode-selector', () => { createModeSelector(); return true; });
ipcMain.handle('get-data', () => database);
ipcMain.handle('add-file', (_, file) => { database.files.push(file); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); if (sidebarWindow) sidebarWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('remove-file', (_, id) => { database.files = database.files.filter(f => f.id !== id); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); if (sidebarWindow) sidebarWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('add-task', (_, task) => { database.tasks.push(task); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); if (sidebarWindow) sidebarWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('toggle-task', (_, id) => { const t = database.tasks.find(x => x.id === id); if (t) t.completed = !t.completed; saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); if (sidebarWindow) sidebarWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('delete-task', (_, id) => { database.tasks = database.tasks.filter(t => t.id !== id); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); if (sidebarWindow) sidebarWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('add-event', (_, evt) => { database.events.push(evt); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); if (sidebarWindow) sidebarWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('add-mode', (_, mode) => { database.modes.push(mode); saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); if (modeWindow) modeWindow.webContents.send('data-updated'); if (sidebarWindow) sidebarWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('switch-mode', (_, id) => { database.currentMode = id; saveDatabase(database); if (panelWindow) panelWindow.webContents.send('data-updated'); if (modeWindow) modeWindow.webContents.send('data-updated'); if (sidebarWindow) sidebarWindow.webContents.send('data-updated'); return database; });
ipcMain.handle('open-file', (_, path) => { require('electron').shell.openPath(path); return true; });
ipcMain.handle('select-files', async () => { const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] }); return r.filePaths; });
ipcMain.handle('hide-command', () => { commandWindow.hide(); return true; });
`;

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
      width: 56px;
      height: 280px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(20px) saturate(120%);
      -webkit-backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        0 0 30px rgba(255, 255, 255, 0.1);
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
    .nav-item:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .nav-item.active {
      background: rgba(255, 255, 255, 0.12);
    }
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
    
    .mode-btn {
      width: 40px;
      height: 40px;
      margin-top: auto;
      position: relative;
      cursor: pointer;
      -webkit-app-region: no-drag;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .mode-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: 
        repeating-linear-gradient(
          0deg,
          rgba(255, 255, 255, 0.03) 0px,
          rgba(255, 255, 255, 0.03) 1px,
          transparent 1px,
          transparent 2px
        ),
        repeating-linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.03) 0px,
          rgba(255, 255, 255, 0.03) 1px,
          transparent 1px,
          transparent 2px
        );
      animation: noise 0.2s infinite;
      pointer-events: none;
    }
    @keyframes noise {
      0%, 100% { transform: translate(0, 0); }
      10% { transform: translate(-1px, -1px); }
      20% { transform: translate(1px, 1px); }
      30% { transform: translate(-1px, 1px); }
      40% { transform: translate(1px, -1px); }
      50% { transform: translate(-2px, 0); }
      60% { transform: translate(2px, 0); }
      70% { transform: translate(0, -2px); }
      80% { transform: translate(0, 2px); }
      90% { transform: translate(1px, 0); }
    }
    .mode-btn svg {
      position: relative;
      z-index: 1;
      width: 16px;
      height: 16px;
      stroke: #ffffff;
      stroke-width: 2;
    }
    .mode-btn:hover {
      border-color: #ffffff;
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.4);
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="nav-item" onclick="openPanel('files')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
      <span class="badge" id="filesBadge">0</span>
    </div>
    
    <div class="nav-item" onclick="openPanel('tasks')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
      <span class="badge" id="tasksBadge">0</span>
    </div>
    
    <div class="nav-item" onclick="openPanel('calendar')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span class="badge" id="eventsBadge">0</span>
    </div>
    
    <div class="nav-item" onclick="openPanel('modes')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6"/>
      </svg>
    </div>
    
    <div class="mode-btn" onclick="openModeSelector()" title="Switch Mode">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="1"/>
        <circle cx="12" cy="5" r="1"/>
        <circle cx="12" cy="19" r="1"/>
      </svg>
    </div>
  </div>
  <script src="renderer-sidebar.js"></script>
</body>
</html>`;

const modeHTML = `<!DOCTYPE html>
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
      -webkit-backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 255, 255, 0.1);
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
      color: #ffffff;
    }
    .panel {
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(20px) saturate(120%);
      -webkit-backdrop-filter: blur(20px) saturate(120%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(0, 0, 0, 0.3);
    }
    .title {
      font-size: 16px;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .title::before { content: '> '; opacity: 0.7; }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
    }
    .content::-webkit-scrollbar { width: 6px; }
    .content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
    
    .quick-add {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
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
      transition: all 0.2s;
    }
    .input:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: #ffffff;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
    }
    .input::placeholder { color: rgba(255, 255, 255, 0.4); }
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
    
    /* GRAPH-STYLE TASK VIEW */
    .task-graph {
      display: flex;
      flex-direction: column;
      gap: 2px;
      position: relative;
    }
    .task-graph::before {
      content: '';
      position: absolute;
      left: 19px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, rgba(255,255,255,0.2), transparent);
    }
    .task-node {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      position: relative;
    }
    .task-node::before {
      content: '';
      position: absolute;
      left: 12px;
      top: 50%;
      width: 16px;
      height: 2px;
      background: rgba(255, 255, 255, 0.2);
    }
    .task-point {
      width: 8px;
      height: 8px;
      border: 2px solid #ffffff;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.9);
      flex-shrink: 0;
      margin-top: 5px;
      z-index: 1;
      position: relative;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
    }
    .task-point.completed {
      background: #ffffff;
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.8);
    }
    .task-body {
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .task-body:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.3);
    }
    .task-node.completed .task-body {
      opacity: 0.5;
    }
    .task-title {
      font-size: 13px;
      line-height: 1.4;
      margin-bottom: 4px;
    }
    .task-node.completed .task-title {
      text-decoration: line-through;
    }
    .task-meta {
      font-size: 10px;
      opacity: 0.5;
      letter-spacing: 0.5px;
    }
    .task-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .task-body:hover .task-actions {
      opacity: 1;
    }
    .task-action-btn {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid rgba(255, 0, 0, 0.3);
      border-radius: 3px;
      cursor: pointer;
      color: #ff4444;
      font-size: 12px;
    }
    
    .drop-zone {
      border: 2px dashed rgba(255, 255, 255, 0.3);
      border-radius: 10px;
      padding: 40px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 20px;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 13px;
      letter-spacing: 0.5px;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.15);
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
    .empty {
      padding: 60px 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.3);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="panel">
    <div class="header">
      <div class="title" id="panelTitle">Panel</div>
    </div>
    <div class="content" id="panelContent"></div>
  </div>
  <script src="renderer-panel.js"></script>
</body>
</html>`;

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
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 255, 255, 0.1);
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
    .list {
      max-height: 400px;
      overflow-y: auto;
      padding: 8px;
    }
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
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
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

// PRELOAD FILES
const preloadSidebar = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sidebarAPI', {
  openPanel: (section) => ipcRenderer.invoke('open-panel', section),
  openModeSelector: () => ipcRenderer.invoke('open-mode-selector'),
  getData: () => ipcRenderer.invoke('get-data'),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
});`;

const preloadMode = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('modeAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  switchMode: (id) => ipcRenderer.invoke('switch-mode', id),
  addMode: (mode) => ipcRenderer.invoke('add-mode', mode),
  onDataUpdated: (callback) => ipcRenderer.on('data-updated', callback)
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

// RENDERER FILES
const rendererSidebar = `let data = null;
async function init() {
  data = await window.sidebarAPI.getData();
  updateBadges();
  window.sidebarAPI.onDataUpdated(async () => {
    data = await window.sidebarAPI.getData();
    updateBadges();
  });
}
function openPanel(section) { window.sidebarAPI.openPanel(section); }
function openModeSelector() { window.sidebarAPI.openModeSelector(); }
function updateBadges() {
  const m = data.currentMode;
  document.getElementById('filesBadge').textContent = data.files.filter(f => f.mode === m).length;
  document.getElementById('tasksBadge').textContent = data.tasks.filter(t => t.mode === m && !t.completed).length;
  document.getElementById('eventsBadge').textContent = data.events.filter(e => e.mode === m).length;
}
init();`;

const rendererMode = `let data = null;
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
async function switchMode(id) { await window.modeAPI.switchMode(id); }
async function addMode() {
  const name = prompt('Mode name:');
  if (name) await window.modeAPI.addMode({ id: 'mode_' + Date.now(), name, color: '#ffffff' });
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
  const content = document.getElementById('panelContent');
  if (currentSection === 'files') renderFiles(content);
  else if (currentSection === 'tasks') renderTasks(content);
  else if (currentSection === 'calendar') renderCalendar(content);
  else if (currentSection === 'modes') renderModesPanel(content);
}

function renderFiles(content) {
  const filtered = data.files.filter(f => f.mode === data.currentMode);
  content.innerHTML = \`
    <div class="drop-zone" id="drop">[ DROP FILES HERE ]</div>
    <div>\${filtered.length ? filtered.map(f => \`
      <div class="file-item" onclick="openFile('\${f.path}')">
        <span>📄</span>
        <span style="flex:1">\${f.name}</span>
        <span onclick="event.stopPropagation();removeFile('\${f.id}')" style="cursor:pointer;opacity:0.5">×</span>
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
      <input type="text" id="taskIn" class="input" placeholder="New task... (Enter to add)">
      <button class="btn" onclick="addTask()">+</button>
    </div>
    <div class="task-graph">
      \${active.length ? active.map(t => \`
        <div class="task-node">
          <div class="task-point" onclick="toggleTask('\${t.id}')"></div>
          <div class="task-body">
            <div class="task-title">\${t.title}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div class="task-meta">\${new Date(t.date).toLocaleString()}</div>
              <div class="task-actions">
                <div class="task-action-btn" onclick="deleteTask('\${t.id}')">×</div>
              </div>
            </div>
          </div>
        </div>
      \`).join('') : '<div class="empty">NO TASKS</div>'}
      \${completed.map(t => \`
        <div class="task-node completed">
          <div class="task-point completed" onclick="toggleTask('\${t.id}')"></div>
          <div class="task-body">
            <div class="task-title">\${t.title}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div class="task-meta">\${new Date(t.date).toLocaleString()}</div>
              <div class="task-actions">
                <div class="task-action-btn" onclick="deleteTask('\${t.id}')">×</div>
              </div>
            </div>
          </div>
        </div>
      \`).join('')}
    </div>
  \`;
  
  const input = document.getElementById('taskIn');
  input.focus();
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });
}

function renderCalendar(content) {
  const filtered = data.events.filter(e => e.mode === data.currentMode);
  content.innerHTML = \`
    <input type="text" id="evTitle" class="input" placeholder="Event..." style="margin-bottom:8px">
    <input type="datetime-local" id="evTime" class="input" style="margin-bottom:12px">
    <button class="btn" onclick="addEvent()">+ ADD EVENT</button>
    <div style="margin-top:20px">\${filtered.length ? filtered.map(e => \`
      <div class="file-item">
        <span>📅</span>
        <div style="flex:1">
          <div>\${e.title}</div>
          <div style="font-size:10px;opacity:0.5;margin-top:2px">\${new Date(e.time).toLocaleString()}</div>
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
      <div class="file-item"><span>🎨</span><span>\${m.name}</span></div>
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
      await window.panelAPI.addFile({ id: Date.now() + Math.random(), name: file.name, path: file.path, size: file.size, mode: data.currentMode, date: new Date().toISOString() });
    }
  });
}

async function addFiles() {
  const paths = await window.panelAPI.selectFiles();
  for (const p of paths) await window.panelAPI.addFile({ id: Date.now() + Math.random(), name: p.split(/[\\\\\\/]/).pop(), path: p, size: 0, mode: data.currentMode, date: new Date().toISOString() });
}

async function openFile(path) { await window.panelAPI.openFile(path); }
async function removeFile(id) { await window.panelAPI.removeFile(id); }
async function addTask() {
  const inp = document.getElementById('taskIn');
  if (!inp.value.trim()) return;
  await window.panelAPI.addTask({ id: Date.now(), title: inp.value, mode: data.currentMode, completed: false, date: new Date().toISOString() });
}
async function toggleTask(id) { await window.panelAPI.toggleTask(id); }
async function deleteTask(id) { await window.panelAPI.deleteTask(id); }
async function addEvent() {
  const title = document.getElementById('evTitle');
  const time = document.getElementById('evTime');
  if (!title.value.trim() || !time.value) return;
  await window.panelAPI.addEvent({ id: Date.now(), title: title.value, time: time.value, mode: data.currentMode });
}
async function addMode() {
  const name = document.getElementById('modeName');
  if (!name.value.trim()) return;
  await window.panelAPI.addMode({ id: 'mode_' + Date.now(), name: name.value, color: '#ffffff' });
}

init();`;

const rendererCommand = `const input = document.getElementById('input');
input.focus();
input.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.commandAPI.hide(); });`;

// WRITE FILES
console.log('Writing files...');
fs.writeFileSync('main.js', mainJS);
fs.writeFileSync('sidebar.html', sidebarHTML);
fs.writeFileSync('mode.html', modeHTML);
fs.writeFileSync('panel.html', panelHTML);
fs.writeFileSync('command.html', commandHTML);
fs.writeFileSync('preload-sidebar.js', preloadSidebar);
fs.writeFileSync('preload-mode.js', preloadMode);
fs.writeFileSync('preload-panel.js', preloadPanel);
fs.writeFileSync('preload-command.js', preloadCommand);
fs.writeFileSync('renderer-sidebar.js', rendererSidebar);
fs.writeFileSync('renderer-mode.js', rendererMode);
fs.writeFileSync('renderer-panel.js', rendererPanel);
fs.writeFileSync('renderer-command.js', rendererCommand);

console.log('\n✅ White CRT Complete!');
console.log('\n🎨 Features:');
console.log('  • White CRT aesthetic (no colors)');
console.log('  • 56px minimal sidebar (4 icons only)');
console.log('  • Animated noise button for mode switching');
console.log('  • Graph-style task view (connected nodes)');
console.log('  • Clean icon-only design');
console.log('  • Mode selector popup window');
console.log('\n▶️  Run: npm start');
