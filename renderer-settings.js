let settings = null;

async function init() {
  settings = await window.settingsAPI.getSettings();
  render();
}

function render() {
  const dirList = document.getElementById('dirList');
  dirList.innerHTML = settings.searchDirectories.map(dir => `
    <div class="dir-item">
      <span>${dir}</span>
      <span class="remove-btn" onclick="removeDirectory('${dir.replace(/\\/g, '\\\\')}')">Remove</span>
    </div>
  `).join('');
}

async function addDirectory() {
  settings = await window.settingsAPI.addSearchDirectory();
  render();
}

async function removeDirectory(dir) {
  settings = await window.settingsAPI.removeSearchDirectory(dir);
  render();
}

init();