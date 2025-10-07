import React, { useState, useEffect, useRef } from 'react';

export default function Panel() {
  const [data, setData] = useState(null);
  const [currentSection, setCurrentSection] = useState(null);
  const [currentTab, setCurrentTab] = useState('files');

  useEffect(() => {
    const init = async () => {
      const fetchedData = await window.panelAPI.getData();
      setData(fetchedData);
    };

    init();

    window.panelAPI.onSetPanel(async (section) => {
      setCurrentSection(section);
      const fetchedData = await window.panelAPI.getData();
      setData(fetchedData);
    });

    window.panelAPI.onDataUpdated(async () => {
      const fetchedData = await window.panelAPI.getData();
      setData(fetchedData);
    });
  }, []);

  if (!data || !currentSection) return null;

  const openModeSelector = () => {
    window.panelAPI.openModeSelector();
  };

  const currentMode = data.modes.find(m => m.id === data.currentMode);

  return (
    <div className="panel">
      <div className="header">
        <div className="title">{currentSection.toUpperCase()}</div>
        <div className="mode-indicator" onClick={openModeSelector}>
          {currentMode ? currentMode.name : 'Work'}
        </div>
      </div>
      {currentSection === 'files' ? (
        <FilesSection 
          data={data} 
          currentTab={currentTab} 
          setCurrentTab={setCurrentTab} 
        />
      ) : currentSection === 'tasks' ? (
        <TasksSection data={data} />
      ) : null}
    </div>
  );
}

function FilesSection({ data, currentTab, setCurrentTab }) {
  return (
    <>
      <div className="tabs">
        <div 
          className={`tab ${currentTab === 'files' ? 'active' : ''}`}
          onClick={() => setCurrentTab('files')}
        >
          Files
        </div>
        <div 
          className={`tab ${currentTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setCurrentTab('bookmarks')}
        >
          Bookmarks
        </div>
        <div 
          className={`tab ${currentTab === 'apps' ? 'active' : ''}`}
          onClick={() => setCurrentTab('apps')}
        >
          Apps
        </div>
      </div>
      <div className="content">
        {currentTab === 'files' && <FilesTab data={data} />}
        {currentTab === 'bookmarks' && <BookmarksTab data={data} />}
        {currentTab === 'apps' && <AppsTab data={data} />}
      </div>
    </>
  );
}

function FilesTab({ data }) {
  const appExtensions = ['.exe', '.lnk', '.app', '.dmg'];
  const filtered = data.files.filter(f => {
    if (f.mode !== data.currentMode) return false;
    const ext = f.name.toLowerCase().substring(f.name.lastIndexOf('.'));
    return !appExtensions.includes(ext);
  });

  const openFile = async (path) => {
    await window.panelAPI.openFile(path);
  };

  const removeFile = async (id) => {
    await window.panelAPI.removeFile(id);
  };

  const addFiles = async () => {
    const paths = await window.panelAPI.selectFiles();
    const appExtensions = ['.exe', '.lnk', '.app', '.dmg'];
    
    for (const p of paths) {
      const fileName = p.split(/[\\\/]/).pop();
      const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
      
      if (!appExtensions.includes(ext)) {
        await window.panelAPI.addFile({
          id: Date.now() + Math.random(),
          name: fileName,
          path: p,
          mode: data.currentMode,
          date: new Date().toISOString()
        });
      }
    }
  };

  return (
    <>
      <div className="drop-zone">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 10c0-1.1-.9-2-2-2h-6.5l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V10z"/>
          <line x1="12" y1="13" x2="12" y2="19"/>
          <line x1="9" y1="16" x2="15" y2="16"/>
        </svg>
        Drop files here
      </div>
      <div>
        {filtered.length ? filtered.map(f => (
          <div key={f.id} className="file-item" onClick={() => openFile(f.path)}>
            <span className="file-icon">📄</span>
            <div className="file-info">
              <div className="file-name">{f.name}</div>
            </div>
            <div 
              className="file-delete" 
              onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
            >
              ×
            </div>
          </div>
        )) : <div className="empty">NO FILES</div>}
      </div>
      <button className="btn" onClick={addFiles}>+ ADD FILES</button>
    </>
  );
}

function BookmarksTab({ data }) {
  const [url, setUrl] = useState('');
  const filtered = data.bookmarks.filter(b => b.mode === data.currentMode);

  const addBookmark = async () => {
    if (!url.trim()) return;
    
    await window.panelAPI.addBookmark({
      id: Date.now(),
      name: url,
      url: url,
      mode: data.currentMode,
      date: new Date().toISOString()
    });
    setUrl('');
  };

  const openBookmark = async (bookmarkUrl) => {
    await window.panelAPI.openBookmark(bookmarkUrl);
  };

  const removeBookmark = async (id) => {
    await window.panelAPI.removeBookmark(id);
  };

  return (
    <>
      <div className="quick-add">
        <input 
          type="text" 
          className="input" 
          placeholder="Paste URL (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn" onClick={addBookmark}>+ ADD</button>
      </div>
      <div>
        {filtered.length ? filtered.map(b => (
          <div key={b.id} className="file-item" onClick={() => openBookmark(b.url)}>
            <span className="file-icon">🔖</span>
            <div className="file-info">
              <div className="file-name">{b.name || b.url}</div>
            </div>
            <div 
              className="file-delete" 
              onClick={(e) => { e.stopPropagation(); removeBookmark(b.id); }}
            >
              ×
            </div>
          </div>
        )) : <div className="empty">NO BOOKMARKS</div>}
      </div>
    </>
  );
}

function AppsTab({ data }) {
  const filtered = data.apps.filter(a => a.mode === data.currentMode);

  const launchApp = async (path) => {
    await window.panelAPI.launchApp(path);
  };

  const removeApp = async (id) => {
    await window.panelAPI.removeApp(id);
  };

  const addAppFromList = async () => {
    const apps = await window.panelAPI.getInstalledApps();
    if (!apps || apps.length === 0) {
      alert('No installed apps found. Use file picker instead.');
      return;
    }
    
    const appList = apps.slice(0, 30).map((a, i) => `${i + 1}. ${a.name}`).join('\n');
    const choice = prompt(`Select app to add:\n${appList}\n\nEnter number (or 0 to browse):`);
    
    if (!choice) return;
    
    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < apps.length) {
      await window.panelAPI.addApp({
        id: Date.now(),
        name: apps[idx].name,
        path: apps[idx].path,
        mode: data.currentMode
      });
    }
  };

  return (
    <>
      <button className="btn" onClick={addAppFromList} style={{ marginBottom: '20px' }}>
        + ADD APP
      </button>
      <div>
        {filtered.length ? filtered.map(a => (
          <div key={a.id} className="file-item" onClick={() => launchApp(a.path)}>
            <span className="file-icon">⚡</span>
            <div className="file-info">
              <div className="file-name">{a.name.replace(/\.(exe|lnk|app)$/i, '')}</div>
            </div>
            <div 
              className="file-delete" 
              onClick={(e) => { e.stopPropagation(); removeApp(a.id); }}
            >
              ×
            </div>
          </div>
        )) : <div className="empty">NO APPS</div>}
      </div>
    </>
  );
}

function TasksSection({ data }) {
  const [intentInput, setIntentInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState({ title: '', message: '', onConfirm: null });
  const intents = data.intents.filter(i => i.mode === data.currentMode);

  const showCustomDialog = (title, message) => {
    return new Promise((resolve) => {
      setDialogData({
        title,
        message,
        onConfirm: (result) => {
          setDialogOpen(false);
          resolve(result);
        }
      });
      setDialogOpen(true);
    });
  };

  const processIntent = async () => {
    if (!intentInput.trim()) return;
    
    const text = intentInput.trim();
    
    try {
      const clarified = await window.panelAPI.clarifyIntent(text);
      
      if (!clarified || !clarified.intent) {
        alert('Could not understand intent.\n\nCheck console for details (F12)');
        return;
      }
      
      const confirmed = await showCustomDialog(
        'Confirm Intent',
        `<strong>Intent:</strong><br><br>${clarified.intent}<br><br>Would you like to generate tasks for this intent?`
      );
      
      if (!confirmed) return;
      
      const result = await window.panelAPI.generateTasks(clarified.intent);
      
      if (!result || !result.tasks || !result.tasks.length) {
        alert('Could not generate tasks. Check console for details (F12)');
        return;
      }
      
      const intentId = Date.now();
      await window.panelAPI.addIntent({
        id: intentId,
        description: clarified.intent,
        originalInput: text,
        mode: data.currentMode,
        createdAt: new Date().toISOString()
      });
      
      const tasksToAdd = result.tasks.map((t, idx) => ({
        id: intentId + idx + 1,
        intentId: intentId,
        title: t.title,
        startDate: t.startDate,
        endDate: t.endDate,
        mode: data.currentMode,
        completed: false,
        attachments: [],
        createdAt: new Date().toISOString()
      }));
      
      await window.panelAPI.addTasksBatch(tasksToAdd);
      setIntentInput('');
    } catch (error) {
      alert(`AI processing failed.\n\nError: ${error.message}`);
    }
  };

  return (
    <>
      <div className="content">
        <div className="quick-add">
          <textarea 
            className="input intent-input" 
            placeholder="Describe what you want to accomplish..."
            rows="3"
            value={intentInput}
            onChange={(e) => setIntentInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                processIntent();
              }
            }}
          />
          <button className="btn btn-generate" onClick={processIntent}>
            Generate Tasks
          </button>
        </div>
        <IntentsList intents={intents} data={data} />
      </div>
      {dialogOpen && (
        <CustomDialog 
          title={dialogData.title}
          message={dialogData.message}
          onClose={(result) => dialogData.onConfirm(result)}
        />
      )}
    </>
  );
}

function IntentsList({ intents, data }) {
  if (!intents.length) return <div className="empty">NO INTENTS</div>;

  return intents.map(intent => (
    <IntentBlock key={intent.id} intent={intent} data={data} />
  ));
}

function IntentBlock({ intent, data }) {
  const tasks = data.tasks.filter(t => t.intentId === intent.id);
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const deleteIntent = async (id) => {
    if (confirm('Delete this intent and all its tasks?')) {
      await window.panelAPI.deleteIntent(id);
    }
  };

  const toggleTask = async (id) => {
    await window.panelAPI.toggleTask(id);
  };

  const deleteTask = async (id) => {
    await window.panelAPI.deleteTask(id);
  };

  return (
    <div className="intent-block">
      <div className="intent-header">
        <div className="intent-title">{intent.description}</div>
        <div className="file-delete" onClick={() => deleteIntent(intent.id)}>×</div>
      </div>
      <div className="tasks-list">
        {activeTasks.map((t, idx) => (
          <TaskItem 
            key={t.id} 
            task={t} 
            onToggle={toggleTask} 
            onDelete={deleteTask}
          />
        ))}
        {completedTasks.map(t => (
          <TaskItem 
            key={t.id} 
            task={t} 
            onToggle={toggleTask} 
            onDelete={deleteTask}
          />
        ))}
      </div>
    </div>
  );
}

function TaskItem({ task, onToggle, onDelete }) {
  const now = new Date();
  const end = new Date(task.endDate);
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  const dueDateText = daysLeft > 0 ? `${daysLeft}d` : daysLeft === 0 ? 'Today' : 'Late';

  return (
    <div className={`task-item ${task.completed ? 'completed' : ''}`} data-task-id={task.id}>
      <div className="task-content">
        <span onClick={() => onToggle(task.id)} className="task-checkbox">
          {task.completed ? '☑' : '☐'}
        </span>
        <div className="task-info">
          <div className="task-title">{task.title}</div>
          {!task.completed && (
            <div className="task-meta-hover">
              {new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()} • {dueDateText}
              {task.attachments && task.attachments.length ? ` • ${task.attachments.length} attachments` : ''}
            </div>
          )}
        </div>
      </div>
      <div className="task-actions-hover">
        <button className="task-delete-btn" onClick={() => onDelete(task.id)}>×</button>
      </div>
    </div>
  );
}

function CustomDialog({ title, message, onClose }) {
  return (
    <div className="custom-dialog">
      <div className="dialog-content">
        <div className="dialog-title">{title}</div>
        <div className="dialog-message" dangerouslySetInnerHTML={{ __html: message }}></div>
        <div className="dialog-buttons">
          <button className="dialog-btn dialog-btn-secondary" onClick={() => onClose(false)}>
            Cancel
          </button>
          <button className="dialog-btn dialog-btn-primary" onClick={() => onClose(true)}>
            Generate Tasks
          </button>
        </div>
      </div>
    </div>
  );
}

