let data = null;
let currentSection = null;
let currentTab = 'files';

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
  
  // Update mode indicator
  const currentMode = data.modes.find(m => m.id === data.currentMode);
  document.getElementById('modeIndicator').textContent = currentMode ? currentMode.name : 'Work';
  
  const content = document.getElementById('panelContent');
  
  if (currentSection === 'files') {
    renderFilesSection();
  } else if (currentSection === 'tasks') {
    renderTasks(content);
  }
}

function openModeSelector() {
  window.panelAPI.openModeSelector();
}

function renderFilesSection() {
  const tabsContainer = document.getElementById('tabsContainer');
  tabsContainer.classList.remove('hidden');
  tabsContainer.innerHTML = `
    <div class="tab ${currentTab === 'files' ? 'active' : ''}" onclick="switchTab('files')">Files</div>
    <div class="tab ${currentTab === 'bookmarks' ? 'active' : ''}" onclick="switchTab('bookmarks')">Bookmarks</div>
    <div class="tab ${currentTab === 'apps' ? 'active' : ''}" onclick="switchTab('apps')">Apps</div>
  `;
  
  const content = document.getElementById('panelContent');
  if (currentTab === 'files') renderFiles(content);
  else if (currentTab === 'bookmarks') renderBookmarks(content);
  else if (currentTab === 'apps') renderApps(content);
}

function switchTab(tab) {
  currentTab = tab;
  renderFilesSection();
}

function renderFiles(content) {
  const filtered = data.files.filter(f => f.mode === data.currentMode);
  content.innerHTML = `
    <div class="drop-zone" id="drop">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 10c0-1.1-.9-2-2-2h-6.5l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V10z"/>
        <line x1="12" y1="13" x2="12" y2="19"/>
        <line x1="9" y1="16" x2="15" y2="16"/>
      </svg>
      Drop here
    </div>
    <div>${filtered.length ? filtered.map(f => `
      <div class="file-item" onclick="openFile('${f.path.replace(/\\/g, '\\\\')}')">
        <span class="file-icon">📄</span>
        <div class="file-info">
          <div class="file-name">${f.name}</div>
        </div>
        <div class="file-delete" onclick="event.stopPropagation();removeFile('${f.id}')">×</div>
      </div>
    `).join('') : '<div class="empty">NO FILES</div>'}</div>
    <button class="btn" onclick="addFiles()">+ ADD FILES</button>
  `;
  setupDrop();
}

function renderBookmarks(content) {
  const filtered = data.bookmarks.filter(b => b.mode === data.currentMode);
  content.innerHTML = `
    <div class="quick-add">
      <input type="text" id="bookmarkUrl" class="input" placeholder="URL (https://...)">
      <button class="btn" onclick="addBookmark()">+</button>
    </div>
    <div>${filtered.length ? filtered.map(b => `
      <div class="file-item" onclick="openBookmark('${b.url}')">
        <span class="file-icon">🔖</span>
        <div class="file-info">
          <div class="file-name">${b.name || b.url}</div>
        </div>
        <div class="file-delete" onclick="event.stopPropagation();removeBookmark('${b.id}')">×</div>
      </div>
    `).join('') : '<div class="empty">NO BOOKMARKS</div>'}</div>
  `;
}

function renderApps(content) {
  const filtered = data.apps.filter(a => a.mode === data.currentMode);
  content.innerHTML = `
    <button class="btn" onclick="addApp()" style="margin-bottom:20px">+ ADD APP</button>
    <div>${filtered.length ? filtered.map(a => `
      <div class="file-item" onclick="launchApp('${a.path.replace(/\\/g, '\\\\')}')">
        <span class="file-icon">⚡</span>
        <div class="file-info">
          <div class="file-name">${a.name}</div>
        </div>
        <div class="file-delete" onclick="event.stopPropagation();removeApp('${a.id}')">×</div>
      </div>
    `).join('') : '<div class="empty">NO APPS</div>'}</div>
  `;
}

function renderTasks(content) {
  document.getElementById('tabsContainer').classList.add('hidden');
  const filtered = data.tasks.filter(t => t.mode === data.currentMode);
  const active = filtered.filter(t => !t.completed);
  const completed = filtered.filter(t => t.completed);
  
  content.innerHTML = `
    <div class="quick-add">
      <input type="text" id="taskIn" class="input" placeholder="New task... (press Enter)">
      <button class="btn" onclick="addTask()">+</button>
    </div>
    <div>${active.length ? active.map(t => `
      <div class="file-item">
        <span onclick="toggleTask('${t.id}')" style="cursor:pointer;font-size:20px">☐</span>
        <div class="file-info"><div class="file-name">${t.title}</div></div>
        <div class="file-delete" onclick="deleteTask('${t.id}')">×</div>
      </div>
    `).join('') : '<div class="empty">NO TASKS</div>'}</div>
    ${completed.map(t => `
      <div class="file-item" style="opacity:0.5">
        <span onclick="toggleTask('${t.id}')" style="cursor:pointer;font-size:20px">☑</span>
        <div class="file-info"><div class="file-name" style="text-decoration:line-through">${t.title}</div></div>
        <div class="file-delete" onclick="deleteTask('${t.id}')">×</div>
      </div>
    `).join('')}
  `;
  
  const input = document.getElementById('taskIn');
  if (input) {
    input.focus();
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addTask();
    });
  }
}

function setupDrop() {
  const zone = document.getElementById('drop');
  if (!zone) return;
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    for (const file of Array.from(e.dataTransfer.files)) {
      await window.panelAPI.addFile({
        id: Date.now() + Math.random(),
        name: file.name,
        path: file.path,
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
      name: p.split(/[\\\/]/).pop(),
      path: p,
      mode: data.currentMode,
      date: new Date().toISOString()
    });
  }
}

async function openFile(filePath) {
  if (!filePath || filePath === 'undefined') {
    alert('File path is missing');
    return;
  }
  await window.panelAPI.openFile(filePath);
}

async function removeFile(id) {
  await window.panelAPI.removeFile(id);
}

async function addBookmark() {
  const urlInput = document.getElementById('bookmarkUrl');
  const url = urlInput.value.trim();
  if (!url) return;
  await window.panelAPI.addBookmark({
    id: Date.now(),
    name: url,
    url: url,
    mode: data.currentMode,
    date: new Date().toISOString()
  });
  urlInput.value = '';
}

async function openBookmark(url) {
  await window.panelAPI.openBookmark(url);
}

async function removeBookmark(id) {
  await window.panelAPI.removeBookmark(id);
}

async function addApp() {
  const paths = await window.panelAPI.selectFiles();
  if (paths.length > 0) {
    await window.panelAPI.addApp({
      id: Date.now(),
      name: paths[0].split(/[\\\/]/).pop(),
      path: paths[0],
      mode: data.currentMode
    });
  }
}

async function launchApp(appPath) {
  await window.panelAPI.launchApp(appPath);
}

async function removeApp(id) {
  await window.panelAPI.removeApp(id);
}

async function addTask() {
  const inp = document.getElementById('taskIn');
  if (!inp || !inp.value.trim()) return;
  await window.panelAPI.addTask({
    id: Date.now(),
    title: inp.value,
    mode: data.currentMode,
    completed: false,
    date: new Date().toISOString()
  });
  inp.value = '';
}

async function toggleTask(id) {
  await window.panelAPI.toggleTask(id);
}

async function deleteTask(id) {
  await window.panelAPI.deleteTask(id);
}

init();