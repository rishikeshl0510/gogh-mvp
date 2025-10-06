const { app, BrowserWindow, globalShortcut, screen, ipcMain, Menu, dialog } = require('electron');
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
