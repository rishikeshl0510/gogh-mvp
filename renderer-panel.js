let data = null;
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
    `<div class="mode-tab ${m.id === data.currentMode ? 'active' : ''}" onclick="switchMode('${m.id}')">${m.name}</div>`
  ).join('');
}

async function switchMode(id) {
  data = await window.panelAPI.switchMode(id);
  render();
}

function renderFiles(content) {
  const filtered = data.files.filter(f => f.mode === data.currentMode);
  content.innerHTML = `
    <div class="drop-zone" id="drop">[ DROP FILES HERE ]</div>
    <div id="files">${filtered.length ? filtered.map(f => `
      <div class="file-item" onclick="openFile('${f.path}')">
        <div class="file-icon">📄</div>
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

function renderTasks(content) {
  const filtered = data.tasks.filter(t => t.mode === data.currentMode);
  const active = filtered.filter(t => !t.completed);
  const completed = filtered.filter(t => t.completed);
  
  content.innerHTML = `
    <div class="quick-add">
      <input type="text" id="taskIn" class="input" placeholder="New task... (press Enter)">
      <button class="btn" onclick="addTask()">+</button>
    </div>
    <div class="task-list">
      ${active.length ? active.map(t => `
        <div class="task-item">
          <div class="task-checkbox" onclick="toggleTask('${t.id}')"></div>
          <div class="task-content">
            <div class="task-title">${t.title}</div>
            <div class="task-meta">${new Date(t.date).toLocaleString()}</div>
          </div>
          <div class="task-delete" onclick="deleteTask('${t.id}')">×</div>
        </div>
      `).join('') : '<div class="empty">NO ACTIVE TASKS</div>'}
      ${completed.length ? '<div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(0,255,65,0.2)"></div>' : ''}
      ${completed.map(t => `
        <div class="task-item completed">
          <div class="task-checkbox checked" onclick="toggleTask('${t.id}')"></div>
          <div class="task-content">
            <div class="task-title">${t.title}</div>
            <div class="task-meta">${new Date(t.date).toLocaleString()}</div>
          </div>
          <div class="task-delete" onclick="deleteTask('${t.id}')">×</div>
        </div>
      `).join('')}
    </div>
  `;
  
  const input = document.getElementById('taskIn');
  input.focus();
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
  });
}

function renderCalendar(content) {
  const filtered = data.events.filter(e => e.mode === data.currentMode);
  content.innerHTML = `
    <input type="text" id="evTitle" class="input" placeholder="Event title..." style="margin-bottom:8px">
    <input type="datetime-local" id="evTime" class="input" style="margin-bottom:12px">
    <button class="btn" onclick="addEvent()">+ ADD EVENT</button>
    <div style="margin-top:20px">${filtered.length ? filtered.map(e => `
      <div class="file-item">
        <div class="file-icon">📅</div>
        <div class="file-info">
          <div class="file-name">${e.title}</div>
          <div style="font-size:10px;opacity:0.6;margin-top:4px">${new Date(e.time).toLocaleString()}</div>
        </div>
      </div>
    `).join('') : '<div class="empty">NO EVENTS</div>'}</div>
  `;
}

function renderModesPanel(content) {
  content.innerHTML = `
    <input type="text" id="modeName" class="input" placeholder="Mode name..." style="margin-bottom:12px">
    <button class="btn" onclick="addMode()">+ CREATE MODE</button>
    <div style="margin-top:20px">${data.modes.map(m => `
      <div class="file-item">
        <div class="file-icon">🎨</div>
        <div class="file-info">
          <div class="file-name">${m.name}</div>
        </div>
      </div>
    `).join('')}</div>
  `;
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
      name: p.split(/[\\\/]/).pop(),
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

init();