let data = null;

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

init();