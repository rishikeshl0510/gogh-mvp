let data = null;
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
  list.innerHTML = data.modes.map(m => `
    <div class="mode-item ${m.id === data.currentMode ? 'active' : ''}" onclick="switchMode('${m.id}')">
      <span class="mode-name">${m.name}</span>
      <span class="mode-indicator"></span>
    </div>
  `).join('');
}
async function switchMode(id) {
  await window.modeAPI.switchMode(id);
}
async function addMode() {
  const name = prompt('Mode name:');
  if (name) {
    await window.modeAPI.addMode({
      id: 'mode_' + Date.now(),
      name: name,
      color: '#ffffff'
    });
  }
}
init();