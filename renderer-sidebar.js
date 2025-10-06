let data = null;
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
init();