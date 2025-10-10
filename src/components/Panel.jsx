import React, { useState, useEffect, useRef } from 'react';

export default function Panel() {
  const [data, setData] = useState(null);
  const [widgets, setWidgets] = useState([]);

  useEffect(() => {
    const init = async () => {
      const fetchedData = await window.panelAPI.getData();
      setData(fetchedData);
    };

    init();

    window.panelAPI.onSetPanel(async (section) => {
      const fetchedData = await window.panelAPI.getData();
      setData(fetchedData);

      // Check if widget already exists
      const exists = widgets.find(w => w.id === section);
      if (!exists) {
        const newWidget = {
          id: section,
          type: section,
          x: 80 + widgets.length * 30,
          y: 60 + widgets.length * 30,
          width: 380,
          height: 500,
          minimized: false
        };
        setWidgets([...widgets, newWidget]);
      }
    });

    window.panelAPI.onDataUpdated(async () => {
      const fetchedData = await window.panelAPI.getData();
      setData(fetchedData);
    });
  }, [widgets]);

  if (!data) return null;

  const closeWidget = (id) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const updateWidget = (id, updates) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  return (
    <div className="widgets-container">
      {widgets.map(widget => (
        <Widget
          key={widget.id}
          widget={widget}
          data={data}
          onClose={() => closeWidget(widget.id)}
          onUpdate={(updates) => updateWidget(widget.id, updates)}
        />
      ))}
    </div>
  );
}

function Widget({ widget, data, onClose, onUpdate }) {
  const widgetRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentTab, setCurrentTab] = useState('files');

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('widget-header') || e.target.closest('.widget-title')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - widget.x,
        y: e.clientY - widget.y
      });
    }
  };

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        onUpdate({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      } else if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        onUpdate({
          width: Math.max(300, widget.width + deltaX),
          height: Math.max(200, widget.height + deltaY)
        });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, widget]);

  const toggleMinimize = () => {
    onUpdate({ minimized: !widget.minimized });
  };

  const openModeSelector = () => {
    window.panelAPI.openModeSelector();
  };

  const currentMode = data.modes.find(m => m.id === data.currentMode);

  return (
    <div
      ref={widgetRef}
      className={`widget ${widget.minimized ? 'minimized' : ''}`}
      style={{
        left: `${widget.x}px`,
        top: `${widget.y}px`,
        width: widget.minimized ? 'auto' : `${widget.width}px`,
        height: widget.minimized ? 'auto' : `${widget.height}px`
      }}
    >
      <div className="widget-header" onMouseDown={handleMouseDown}>
        <div className="widget-title">{widget.type.toUpperCase()}</div>
        <div className="widget-controls">
          <div className="widget-mode" onClick={openModeSelector}>
            {currentMode ? currentMode.name : 'Work'}
          </div>
          <button className="widget-btn" onClick={toggleMinimize}>
            {widget.minimized ? '□' : '_'}
          </button>
          <button className="widget-btn" onClick={onClose}>×</button>
        </div>
      </div>

      {!widget.minimized && (
        <>
          <div className="widget-content">
            {widget.type === 'files' ? (
              <FilesWidget data={data} currentTab={currentTab} setCurrentTab={setCurrentTab} />
            ) : widget.type === 'tasks' ? (
              <TasksWidget data={data} />
            ) : null}
          </div>
          <div className="widget-resize-handle" onMouseDown={handleResizeMouseDown}>⋰</div>
        </>
      )}
    </div>
  );
}

function FilesWidget({ data, currentTab, setCurrentTab }) {
  return (
    <>
      <div className="widget-tabs">
        <div
          className={`widget-tab ${currentTab === 'files' ? 'active' : ''}`}
          onClick={() => setCurrentTab('files')}
        >
          Files
        </div>
        <div
          className={`widget-tab ${currentTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setCurrentTab('bookmarks')}
        >
          Bookmarks
        </div>
        <div
          className={`widget-tab ${currentTab === 'apps' ? 'active' : ''}`}
          onClick={() => setCurrentTab('apps')}
        >
          Apps
        </div>
      </div>
      {currentTab === 'files' && <FilesTab data={data} />}
      {currentTab === 'bookmarks' && <BookmarksTab data={data} />}
      {currentTab === 'apps' && <AppsTab data={data} />}
    </>
  );
}

function FilesTab({ data }) {
  const [isDragging, setIsDragging] = useState(false);
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

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      const fileName = file.name;
      const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));

      if (!appExtensions.includes(ext)) {
        await window.panelAPI.addFile({
          id: Date.now() + Math.random(),
          name: fileName,
          path: file.path,
          mode: data.currentMode,
          date: new Date().toISOString()
        });
      }
    }
  };

  return (
    <>
      <div
        className={`drop-zone ${isDragging ? 'drag-over' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={addFiles}
      >
        {isDragging ? 'Drop here' : '+ Add Files'}
      </div>
      {filtered.length ? filtered.map(f => (
        <div key={f.id} className="item" onClick={() => openFile(f.path)}>
          <span className="item-name">{f.name}</span>
          <button className="item-delete" onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}>×</button>
        </div>
      )) : <div className="empty">No files</div>}
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
          className="quick-input"
          placeholder="URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addBookmark()}
        />
        <button className="quick-btn" onClick={addBookmark}>+</button>
      </div>
      {filtered.length ? filtered.map(b => (
        <div key={b.id} className="item" onClick={() => openBookmark(b.url)}>
          <span className="item-name">{b.name || b.url}</span>
          <button className="item-delete" onClick={(e) => { e.stopPropagation(); removeBookmark(b.id); }}>×</button>
        </div>
      )) : <div className="empty">No bookmarks</div>}
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
      alert('No installed apps found');
      return;
    }

    const appList = apps.slice(0, 30).map((a, i) => `${i + 1}. ${a.name}`).join('\n');
    const choice = prompt(`Select app:\n${appList}\n\nEnter number:`);

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
      <button className="add-btn" onClick={addAppFromList}>+ Add App</button>
      {filtered.length ? filtered.map(a => (
        <div key={a.id} className="item" onClick={() => launchApp(a.path)}>
          <span className="item-name">{a.name.replace(/\.(exe|lnk|app)$/i, '')}</span>
          <button className="item-delete" onClick={(e) => { e.stopPropagation(); removeApp(a.id); }}>×</button>
        </div>
      )) : <div className="empty">No apps</div>}
    </>
  );
}

function TasksWidget({ data }) {
  const [intentInput, setIntentInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState({ title: '', message: '', onConfirm: null });
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('compact'); // 'compact', 'list', 'eisenhower', 'lno'
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
    if (!intentInput.trim() || isGenerating) return;

    const text = intentInput.trim();
    setIsGenerating(true);

    try {
      const clarified = await window.panelAPI.clarifyIntent(text);

      if (!clarified || !clarified.intent) {
        alert('Could not understand intent');
        setIsGenerating(false);
        return;
      }

      const confirmed = await showCustomDialog(
        'Confirm Intent',
        `<strong>Intent:</strong><br><br>${clarified.intent}<br><br>Generate tasks?`
      );

      if (!confirmed) {
        setIsGenerating(false);
        return;
      }

      const result = await window.panelAPI.generateTasks(clarified.intent);

      if (!result || !result.tasks || !result.tasks.length) {
        alert('Could not generate tasks');
        setIsGenerating(false);
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
      alert(`AI processing failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="task-toggle">
        <button className={`toggle-btn ${viewMode === 'compact' ? 'active' : ''}`} onClick={() => setViewMode('compact')}>
          Compact
        </button>
        <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
          List
        </button>
        <button className={`toggle-btn ${viewMode === 'eisenhower' ? 'active' : ''}`} onClick={() => setViewMode('eisenhower')}>
          Matrix
        </button>
        <button className={`toggle-btn ${viewMode === 'lno' ? 'active' : ''}`} onClick={() => setViewMode('lno')}>
          LNO
        </button>
      </div>

      {viewMode === 'compact' ? (
        <CompactTaskList intents={intents} data={data} />
      ) : viewMode === 'list' ? (
        <DetailedTaskList intents={intents} data={data} />
      ) : viewMode === 'eisenhower' ? (
        <EisenhowerMatrix intents={intents} data={data} />
      ) : (
        <LNOMatrix intents={intents} data={data} />
      )}

      <div className="task-add">
        <input
          type="text"
          className="quick-input"
          placeholder="Add task..."
          value={intentInput}
          onChange={(e) => setIntentInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && processIntent()}
          disabled={isGenerating}
        />
        <button className="quick-btn" onClick={processIntent} disabled={isGenerating}>
          {isGenerating ? '⏳' : '+'}
        </button>
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

function CompactTaskList({ intents, data }) {
  const allTasks = [];
  intents.forEach(intent => {
    const tasks = data.tasks.filter(t => t.intentId === intent.id && !t.completed);
    tasks.forEach(task => {
      allTasks.push({ ...task, intentDesc: intent.description });
    });
  });

  const toggleTask = async (id) => {
    await window.panelAPI.toggleTask(id);
  };

  if (!allTasks.length) return <div className="empty">No tasks</div>;

  return (
    <div className="compact-list">
      {allTasks.map(task => {
        const now = new Date();
        const end = new Date(task.endDate);
        const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

        return (
          <div key={task.id} className="compact-task">
            <input type="checkbox" className="task-check" onChange={() => toggleTask(task.id)} />
            <span className="task-title">{task.title}</span>
            <span className="task-due">{daysLeft > 0 ? `${daysLeft}d` : daysLeft === 0 ? 'Today' : 'Late'}</span>
          </div>
        );
      })}
    </div>
  );
}

function DetailedTaskList({ intents, data }) {
  if (!intents.length) return <div className="empty">No intents</div>;

  return (
    <div className="detailed-list">
      {intents.map(intent => (
        <IntentBlock key={intent.id} intent={intent} data={data} />
      ))}
    </div>
  );
}

function IntentBlock({ intent, data }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const tasks = data.tasks.filter(t => t.intentId === intent.id);
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const deleteIntent = async (id) => {
    if (confirm('Delete intent and all tasks?')) {
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
      <div className="intent-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="intent-icon">{isCollapsed ? '▶' : '▼'}</span>
        <span className="intent-title">{intent.description}</span>
        <span className="intent-count">{activeTasks.length}</span>
        <button className="intent-delete" onClick={(e) => { e.stopPropagation(); deleteIntent(intent.id); }}>×</button>
      </div>
      {!isCollapsed && (
        <div className="intent-tasks">
          {activeTasks.map(t => (
            <TaskItem key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} />
          ))}
          {completedTasks.map(t => (
            <TaskItem key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} completed />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskItem({ task, onToggle, onDelete, completed }) {
  const now = new Date();
  const end = new Date(task.endDate);
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

  return (
    <div className={`task-item ${completed ? 'completed' : ''}`}>
      <input type="checkbox" className="task-check" checked={task.completed} onChange={() => onToggle(task.id)} />
      <div className="task-info">
        <div className="task-title">{task.title}</div>
        {!completed && (
          <div className="task-meta">{daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Today' : 'Overdue'}</div>
        )}
      </div>
      <button className="task-delete" onClick={() => onDelete(task.id)}>×</button>
    </div>
  );
}

function CustomDialog({ title, message, onClose }) {
  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <div className="dialog-title">{title}</div>
        <div className="dialog-message" dangerouslySetInnerHTML={{ __html: message }}></div>
        <div className="dialog-actions">
          <button className="dialog-btn cancel" onClick={() => onClose(false)}>Cancel</button>
          <button className="dialog-btn confirm" onClick={() => onClose(true)}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
