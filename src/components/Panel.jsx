import React, { useState, useEffect, useRef } from 'react';
import { ChatContainer, ChatMessages, ChatForm, PromptSuggestions } from './ui/chat';
import { MessageList } from './ui/message-list';
import { MessageInput } from './ui/message-input';

export default function Panel() {
  const [data, setData] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState({ title: '', message: '', onConfirm: null });

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

  const showDialog = (title, message, onConfirm) => {
    setDialogData({ title, message, onConfirm });
    setDialogOpen(true);
  };

  return (
    <>
      <div className="widgets-container">
        {widgets.map(widget => (
          <Widget
            key={widget.id}
            widget={widget}
            data={data}
            onClose={() => closeWidget(widget.id)}
            onUpdate={(updates) => updateWidget(widget.id, updates)}
            showDialog={showDialog}
          />
        ))}
      </div>

      {dialogOpen && (
        <CustomDialog
          title={dialogData.title}
          message={dialogData.message}
          onClose={(result) => {
            setDialogOpen(false);
            if (dialogData.onConfirm) dialogData.onConfirm(result);
          }}
        />
      )}
    </>
  );
}

function Widget({ widget, data, onClose, onUpdate, showDialog }) {
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
              <TasksWidget data={data} showDialog={showDialog} />
            ) : widget.type === 'modes' ? (
              <ModesWidget data={data} />
            ) : widget.type === 'settings' ? (
              <SettingsWidget data={data} />
            ) : widget.type === 'chat' ? (
              <ChatWidget data={data} />
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
  const [searchQuery, setSearchQuery] = useState('');
  const [installedApps, setInstalledApps] = useState([]);
  const [showAll, setShowAll] = useState(false);

  const filtered = data.apps.filter(a => a.mode === data.currentMode);

  // Search both saved apps and installed apps
  const searchResults = searchQuery.trim() ?
    installedApps.filter(app =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 20) : [];

  useEffect(() => {
    // Load installed apps on mount
    const loadApps = async () => {
      const apps = await window.panelAPI.getInstalledApps();
      setInstalledApps(apps || []);
    };
    loadApps();
  }, []);

  const launchApp = async (path) => {
    await window.panelAPI.launchApp(path);
  };

  const removeApp = async (id) => {
    await window.panelAPI.removeApp(id);
  };

  const addAppToSaved = async (app) => {
    await window.panelAPI.addApp({
      id: Date.now(),
      name: app.name,
      path: app.path,
      mode: data.currentMode
    });
    setSearchQuery('');
  };

  return (
    <>
      <div className="quick-add">
        <input
          type="text"
          className="quick-input"
          placeholder="Search apps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Search Results */}
      {searchQuery && searchResults.length > 0 && (
        <div className="search-results">
          <div className="search-results-title">Search Results</div>
          {searchResults.map((app, idx) => (
            <div key={idx} className="item search-item">
              <span className="item-name" onClick={() => launchApp(app.path)}>
                {app.name}
              </span>
              <button
                className="item-add"
                onClick={() => addAppToSaved(app)}
                title="Add to saved apps"
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Saved Apps */}
      {!searchQuery && (
        <>
          <div className="section-title">Saved Apps</div>
          {filtered.length ? filtered.map(a => (
            <div key={a.id} className="item" onClick={() => launchApp(a.path)}>
              <span className="item-name">{a.name.replace(/\.(exe|lnk|app)$/i, '')}</span>
              <button className="item-delete" onClick={(e) => { e.stopPropagation(); removeApp(a.id); }}>×</button>
            </div>
          )) : <div className="empty">No saved apps. Search to add apps.</div>}
        </>
      )}
    </>
  );
}

function TasksWidget({ data, showDialog }) {
  const [intentInput, setIntentInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('compact'); // 'compact', 'list', 'eisenhower', 'lno'
  const intents = data.intents.filter(i => i.mode === data.currentMode);

  const showCustomDialog = (title, message) => {
    return new Promise((resolve) => {
      showDialog(title, message, resolve);
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

function EisenhowerMatrix({ intents, data }) {
  const allTasks = [];
  intents.forEach(intent => {
    const tasks = data.tasks.filter(t => t.intentId === intent.id && !t.completed);
    tasks.forEach(task => {
      allTasks.push({ ...task, intentDesc: intent.description });
    });
  });

  const categorize = (task) => {
    const now = new Date();
    const end = new Date(task.endDate);
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    const isUrgent = daysLeft <= 3;
    const isImportant = task.title.toLowerCase().includes('important') || daysLeft <= 7;

    if (isUrgent && isImportant) return 'do';
    if (!isUrgent && isImportant) return 'schedule';
    if (isUrgent && !isImportant) return 'delegate';
    return 'delete';
  };

  const tasks = {
    do: allTasks.filter(t => categorize(t) === 'do'),
    schedule: allTasks.filter(t => categorize(t) === 'schedule'),
    delegate: allTasks.filter(t => categorize(t) === 'delegate'),
    delete: allTasks.filter(t => categorize(t) === 'delete'),
  };

  const toggleTask = async (id) => {
    await window.panelAPI.toggleTask(id);
  };

  return (
    <div className="matrix-grid">
      <div className="matrix-cell do">
        <div className="matrix-label">DO</div>
        {tasks.do.map(task => (
          <MatrixTask key={task.id} task={task} onToggle={toggleTask} />
        ))}
      </div>
      <div className="matrix-cell schedule">
        <div className="matrix-label">SCHEDULE</div>
        {tasks.schedule.map(task => (
          <MatrixTask key={task.id} task={task} onToggle={toggleTask} />
        ))}
      </div>
      <div className="matrix-cell delegate">
        <div className="matrix-label">DELEGATE</div>
        {tasks.delegate.map(task => (
          <MatrixTask key={task.id} task={task} onToggle={toggleTask} />
        ))}
      </div>
      <div className="matrix-cell delete">
        <div className="matrix-label">ELIMINATE</div>
        {tasks.delete.map(task => (
          <MatrixTask key={task.id} task={task} onToggle={toggleTask} />
        ))}
      </div>
    </div>
  );
}

function LNOMatrix({ intents, data }) {
  const allTasks = [];
  intents.forEach(intent => {
    const tasks = data.tasks.filter(t => t.intentId === intent.id && !t.completed);
    tasks.forEach(task => {
      allTasks.push({ ...task, intentDesc: intent.description });
    });
  });

  const categorize = (task) => {
    const titleLower = task.title.toLowerCase();
    const now = new Date();
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const isLeverage = titleLower.includes('leverage') || titleLower.includes('scale') || titleLower.includes('automat');
    const isNeutral = duration <= 3;

    if (isLeverage) return 'leverage';
    if (isNeutral) return 'neutral';
    return 'overhead';
  };

  const tasks = {
    leverage: allTasks.filter(t => categorize(t) === 'leverage'),
    neutral: allTasks.filter(t => categorize(t) === 'neutral'),
    overhead: allTasks.filter(t => categorize(t) === 'overhead'),
  };

  const toggleTask = async (id) => {
    await window.panelAPI.toggleTask(id);
  };

  return (
    <div className="lno-grid">
      <div className="lno-cell leverage">
        <div className="lno-label">LEVERAGE</div>
        <div className="lno-desc">High impact, scales</div>
        {tasks.leverage.map(task => (
          <MatrixTask key={task.id} task={task} onToggle={toggleTask} />
        ))}
      </div>
      <div className="lno-cell neutral">
        <div className="lno-label">NEUTRAL</div>
        <div className="lno-desc">Necessary work</div>
        {tasks.neutral.map(task => (
          <MatrixTask key={task.id} task={task} onToggle={toggleTask} />
        ))}
      </div>
      <div className="lno-cell overhead">
        <div className="lno-label">OVERHEAD</div>
        <div className="lno-desc">Minimize or eliminate</div>
        {tasks.overhead.map(task => (
          <MatrixTask key={task.id} task={task} onToggle={toggleTask} />
        ))}
      </div>
    </div>
  );
}

function MatrixTask({ task, onToggle }) {
  const now = new Date();
  const end = new Date(task.endDate);
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

  return (
    <div className="matrix-task">
      <input type="checkbox" className="task-check" onChange={() => onToggle(task.id)} />
      <div className="matrix-task-text">
        <div className="matrix-task-title">{task.title}</div>
        <div className="matrix-task-due">{daysLeft}d</div>
      </div>
    </div>
  );
}

function ModesWidget({ data }) {
  const [newModeName, setNewModeName] = useState('');

  const switchMode = async (id) => {
    await window.panelAPI.switchMode(id);
  };

  const addMode = async () => {
    if (!newModeName.trim()) return;
    const newMode = {
      id: Date.now().toString(),
      name: newModeName.trim(),
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    };
    await window.panelAPI.addMode(newMode);
    setNewModeName('');
  };

  const deleteMode = async (id) => {
    if (id === 'default') {
      alert('Cannot delete default mode');
      return;
    }
    if (confirm('Delete this mode? All associated data will be moved to default mode.')) {
      await window.panelAPI.deleteMode(id);
    }
  };

  return (
    <>
      <div className="modes-list">
        {data.modes.map(mode => (
          <div
            key={mode.id}
            className={`mode-item ${mode.id === data.currentMode ? 'active' : ''}`}
            onClick={() => switchMode(mode.id)}
          >
            <div className="mode-color" style={{ background: mode.color }}></div>
            <span className="mode-name">{mode.name}</span>
            {mode.id !== 'default' && (
              <button
                className="mode-delete"
                onClick={(e) => { e.stopPropagation(); deleteMode(mode.id); }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="quick-add">
        <input
          type="text"
          className="quick-input"
          placeholder="New mode name..."
          value={newModeName}
          onChange={(e) => setNewModeName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMode()}
        />
        <button className="quick-btn" onClick={addMode}>+</button>
      </div>
    </>
  );
}

function SettingsWidget({ data }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      const s = await window.panelAPI.getSettings();
      setSettings(s);
    };
    loadSettings();
  }, []);

  const addDirectory = async () => {
    const updated = await window.panelAPI.addSearchDirectory();
    if (updated) setSettings(updated);
  };

  const removeDirectory = async (dir) => {
    const updated = await window.panelAPI.removeSearchDirectory(dir);
    if (updated) setSettings(updated);
  };

  const resetDatabase = async () => {
    if (confirm('Reset all data? This cannot be undone!')) {
      await window.panelAPI.resetDatabase();
    }
  };

  if (!settings) return <div className="empty">Loading...</div>;

  return (
    <>
      <div className="settings-section">
        <div className="settings-label">Search Directories</div>
        <div className="settings-desc">Folders to search for files</div>
        {settings.searchDirectories && settings.searchDirectories.map(dir => (
          <div key={dir} className="item">
            <span className="item-name">{dir}</span>
            <button className="item-delete" onClick={() => removeDirectory(dir)}>×</button>
          </div>
        ))}
        <button className="add-btn" onClick={addDirectory}>+ Add Directory</button>
      </div>

      <div className="settings-section danger">
        <div className="settings-label">Danger Zone</div>
        <div className="settings-desc">Irreversible actions</div>
        <button className="add-btn danger-btn" onClick={resetDatabase}>Reset All Data</button>
      </div>
    </>
  );
}

function ChatWidget({ data }) {
  const [chatWindows, setChatWindows] = useState([{ id: 'default', name: 'Chat 1', messages: [] }]);
  const [activeChat, setActiveChat] = useState('default');
  const [input, setInput] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState('stopped');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [modelStatus, setModelStatus] = useState('');

  const messages = chatWindows.find(c => c.id === activeChat)?.messages || [];
  const setMessages = (newMessages) => {
    setChatWindows(prev => prev.map(c =>
      c.id === activeChat
        ? { ...c, messages: typeof newMessages === 'function' ? newMessages(c.messages) : newMessages }
        : c
    ));
  };

  // Load chat windows from database for current mode
  useEffect(() => {
    const loadHistory = async () => {
      const history = await window.panelAPI.getChatHistory(data.currentMode);
      if (history && history.chatWindows && history.chatWindows.length > 0) {
        setChatWindows(history.chatWindows);
        setActiveChat(history.activeChat || history.chatWindows[0].id);
      } else if (history && Array.isArray(history) && history.length > 0) {
        // Migrate old format
        setChatWindows([{ id: 'default', name: 'Chat 1', messages: history }]);
        setActiveChat('default');
      }
    };
    loadHistory();
  }, [data.currentMode]);

  // Save chat windows to database whenever they change
  useEffect(() => {
    if (chatWindows.length > 0) {
      window.panelAPI.saveChatHistory(data.currentMode, { chatWindows, activeChat });
    }
  }, [chatWindows, activeChat, data.currentMode]);

  useEffect(() => {
    // Check Ollama status
    const checkStatus = async () => {
      const result = await window.panelAPI.checkOllamaStatus();
      setOllamaStatus(result.isRunning ? 'active' : 'down');
    };
    checkStatus();

    // Listen for streaming chunks
    window.panelAPI.onOllamaChunk((chunk) => {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content += chunk;
        }
        return newMessages;
      });
    });

    // Listen for completion
    window.panelAPI.onOllamaDone(() => {
      setIsGenerating(false);
      setModelStatus('');
    });

    // Listen for download progress
    window.panelAPI.onOllamaDownloadProgress((data) => {
      setDownloadProgress(data.percent);
    });

    // Listen for model download/install logs
    window.panelAPI.onOllamaLog((message) => {
      setModelStatus(message);
    });
  }, []);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleEditMessage = (messageId, newContent) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, content: newContent } : msg
    ));
  };

  const addNewChat = () => {
    const newId = 'chat-' + Date.now();
    const newChat = {
      id: newId,
      name: `Chat ${chatWindows.length + 1}`,
      messages: []
    };
    setChatWindows(prev => [...prev, newChat]);
    setActiveChat(newId);
  };

  const closeChat = (chatId) => {
    if (chatWindows.length === 1) return; // Don't close last chat
    setChatWindows(prev => prev.filter(c => c.id !== chatId));
    if (activeChat === chatId) {
      const remaining = chatWindows.filter(c => c.id !== chatId);
      setActiveChat(remaining[0]?.id);
    }
  };

  const renameChat = (chatId, newName) => {
    setChatWindows(prev => prev.map(c =>
      c.id === chatId ? { ...c, name: newName } : c
    ));
  };

  // Build context from recent messages, files, tasks for RAG
  const buildContext = () => {
    const recentFiles = data.files.slice(-5).map(f => f.name).join(', ');
    const recentTasks = data.tasks.slice(-5).map(t => t.title).join(', ');
    const recentMessages = messages.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');

    let context = '';
    if (recentFiles) context += `Recent files: ${recentFiles}\n`;
    if (recentTasks) context += `Recent tasks: ${recentTasks}\n`;
    if (recentMessages) context += `Conversation history:\n${recentMessages}\n`;

    return context;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isGenerating || ollamaStatus !== 'active') return;

    const userMessage = {
      id: Date.now() + '-user',
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    // Add thinking message
    const thinkingMessage = {
      id: Date.now() + '-thinking',
      role: 'thinking',
      content: 'Thinking...'
    };

    setMessages(prev => [...prev, thinkingMessage]);

    // Build context for RAG
    const context = buildContext();
    const enhancedPrompt = context ? `Context:\n${context}\n\nUser question: ${userMessage.content}` : userMessage.content;

    const assistantMessage = {
      id: Date.now() + '-assistant',
      role: 'assistant',
      content: ''
    };

    // Remove thinking message and add assistant message
    setMessages(prev => prev.filter(m => m.role !== 'thinking').concat([assistantMessage]));
    await window.panelAPI.chatWithOllama(enhancedPrompt);
  };

  const append = (message) => {
    setInput(message.content);
  };

  // Get context-aware suggestions based on mode and recent data
  const getSuggestions = () => {
    const mode = data.modes.find(m => m.id === data.currentMode);
    const modeName = mode?.name || 'default';

    const baseSuggestions = {
      'Work': [
        data.tasks.length > 0 ? `Summarize my ${data.tasks.length} tasks` : 'Help me plan my work tasks',
        data.files.length > 0 ? 'What files am I working on?' : 'Organize my project files',
        'Create a productivity report',
        'Suggest ways to improve efficiency'
      ],
      'Personal': [
        'Help me plan my day',
        'Give me learning recommendations',
        'Suggest hobbies to try',
        'What should I focus on today?'
      ],
      'default': [
        data.tasks.length > 0 ? `I have ${data.tasks.length} tasks, what should I prioritize?` : 'What should I work on?',
        data.files.length > 0 ? `Explain my recent files` : 'Help me organize',
        'Give me productivity tips',
        'What can you help me with?'
      ]
    };

    return baseSuggestions[modeName] || baseSuggestions['default'];
  };

  const startOllama = async () => {
    setOllamaStatus('starting');
    const result = await window.panelAPI.startOllama();

    if (result.status === 'started' || result.status === 'running') {
      setOllamaStatus('active');
    } else if (result.status === 'error') {
      setOllamaStatus('down');
      alert('Failed to start Ollama: ' + result.message);
    }
  };

  const isEmpty = messages.length === 0;
  const lastMessage = messages.at(-1);
  const isTyping = lastMessage?.role === 'user' || lastMessage?.role === 'thinking';

  // Map status to user-friendly labels
  const getStatusLabel = () => {
    switch(ollamaStatus) {
      case 'active': return 'Active';
      case 'down': return 'Down';
      case 'starting': return 'Starting';
      default: return 'Unknown';
    }
  };

  if (ollamaStatus !== 'active') {
    return (
      <div className="chat-status">
        <div className="status-message">
          Status: {getStatusLabel()}
          {ollamaStatus === 'starting' && ` - ${downloadProgress}%`}
        </div>
        {ollamaStatus !== 'starting' && (
          <button className="start-btn" onClick={startOllama}>
            Start Ollama
          </button>
        )}
      </div>
    );
  }

  const getStatusInfo = () => {
    if (isGenerating) {
      return { type: 'active', text: 'Generating response...', show: true };
    }
    if (modelStatus) {
      // Check if it's a download/pull message
      if (modelStatus.includes('Downloading') || modelStatus.includes('pulling')) {
        return { type: 'downloading', text: modelStatus, show: true };
      }
      // Check for errors
      if (modelStatus.includes('error') || modelStatus.includes('failed')) {
        return { type: 'error', text: modelStatus, show: true };
      }
      // Other status messages
      return { type: 'info', text: modelStatus, show: true };
    }
    return { type: 'active', text: '', show: false };
  };

  const statusInfo = getStatusInfo();

  return (
    <ChatContainer>
      {/* Chat Tabs */}
      <div className="chat-tabs">
        {chatWindows.map(chat => (
          <div
            key={chat.id}
            className={`chat-tab ${activeChat === chat.id ? 'active' : ''}`}
            onClick={() => setActiveChat(chat.id)}
          >
            <span className="chat-tab-name">{chat.name}</span>
            {chatWindows.length > 1 && (
              <button
                className="chat-tab-close"
                onClick={(e) => { e.stopPropagation(); closeChat(chat.id); }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="chat-tab-add" onClick={addNewChat} title="New chat">
          +
        </button>
      </div>

      {statusInfo.show && (
        <div className={`model-status status-${statusInfo.type}`}>
          <div className={`status-indicator status-${statusInfo.type}`}></div>
          {statusInfo.text}
        </div>
      )}

      {isEmpty ? (
        <PromptSuggestions
          append={append}
          suggestions={getSuggestions()}
        />
      ) : null}

      {!isEmpty ? (
        <ChatMessages>
          <MessageList
            messages={messages}
            isTyping={isTyping && isGenerating}
            onEditMessage={handleEditMessage}
          />
        </ChatMessages>
      ) : null}

      <ChatForm
        className="mt-auto"
        isPending={isGenerating || isTyping}
        handleSubmit={handleSubmit}
      >
        {() => (
          <MessageInput
            value={input}
            onChange={handleInputChange}
            isGenerating={isGenerating}
          />
        )}
      </ChatForm>
    </ChatContainer>
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
