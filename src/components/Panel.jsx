import React, { useState, useEffect, useRef } from 'react';
import { ChatContainer, ChatMessages, ChatForm, PromptSuggestions } from './ui/chat';
import { MessageList } from './ui/message-list';
import { MessageInput } from './ui/message-input';
import FileTreeView from './FileTreeView';
import FileGraphView from './Graph';
import MCPSettings, { MCPDialog } from './MCPSettings';
import ChainOfThought from './ChainOfThought';
import TaskWidget from './TaskWidget';

export default function Panel() {
  const [data, setData] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState({ title: '', message: '', onConfirm: null });
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);

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

  const showCustomDialog = (type, props) => {
    if (type === 'mcp') {
      setMcpDialogOpen(true);
    }
  };

  // Get only active (non-completed) tasks for current mode
  const activeTasks = (data?.tasks || []).filter(task => !task.done && task.mode === data.currentMode);

  const handleTaskUpdate = async (updatedTask) => {
    // Update task in database
    const updatedTasks = data.tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    const updatedData = { ...data, tasks: updatedTasks };
    await window.panelAPI.saveData(updatedData);
    // Trigger re-render by updating state
    setData(updatedData);
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
            showCustomDialog={showCustomDialog}
          />
        ))}
      </div>

      {/* Sticky Note Task Widgets - only active tasks */}
      {activeTasks.map((task, index) => (
        <TaskWidget
          key={task.id}
          task={task}
          onUpdate={handleTaskUpdate}
          position={{ x: 100 + index * 30, y: 100 + index * 30 }}
          zIndex={2000 + index}
        />
      ))}

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

      {mcpDialogOpen && (
        <MCPDialog onClose={() => setMcpDialogOpen(false)} />
      )}
    </>
  );
}

function Widget({ widget, data, onClose, onUpdate, showDialog, showCustomDialog }) {
  const widgetRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentTab, setCurrentTab] = useState('files');
  const [showModeDropdown, setShowModeDropdown] = useState(false);

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

  const switchMode = async (modeId) => {
    await window.panelAPI.switchMode(modeId);
    setShowModeDropdown(false);
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
          <div style={{ position: 'relative' }}>
            <div className="widget-mode" onClick={() => setShowModeDropdown(!showModeDropdown)}>
              {currentMode ? currentMode.name : 'Work'}
            </div>
            {showModeDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: 'rgba(20, 20, 25, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '6px',
                minWidth: '140px',
                zIndex: 10000,
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
              }}>
                {data.modes.map(mode => (
                  <div
                    key={mode.id}
                    onClick={() => switchMode(mode.id)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: mode.id === data.currentMode ? 'rgba(100, 200, 255, 0.15)' : 'transparent',
                      border: mode.id === data.currentMode ? '1px solid rgba(100, 200, 255, 0.3)' : '1px solid transparent',
                      color: 'rgba(255, 255, 255, 0.9)',
                      transition: 'all 0.15s',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (mode.id !== data.currentMode) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (mode.id !== data.currentMode) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: mode.color || '#666'
                    }}></div>
                    <span>{mode.name}</span>
                    {mode.id === data.currentMode && (
                      <span style={{ marginLeft: 'auto', fontSize: '9px' }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              <SettingsWidget data={data} showCustomDialog={showCustomDialog} />
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
  const [aiSummary, setAiSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const cleanup = window.panelAPI.onFileContextAction(async (actionData) => {
      const { action, item } = actionData;

      if (action === 'ai-summary') {
        const summary = await window.panelAPI.readFileWithAI(item.path);
        setAiSummary({ file: item.name, content: summary });
        setShowSummary(true);
      } else if (action === 'tag-with-ai') {
        await window.panelAPI.tagFileWithAI(item.path);
      } else if (action === 'import-bookmarks') {
        const result = await window.panelAPI.importBookmarksFromFolder(item.path);
        if (result.success) {
          alert(`Imported ${result.count} bookmarks`);
          setCurrentTab('bookmarks');
        } else {
          alert(`Failed to import: ${result.error}`);
        }
      } else if (action === 'properties') {
        const props = await window.panelAPI.getFileProperties(item.path);
        alert(`Name: ${props.name}\nSize: ${(props.size / 1024).toFixed(2)} KB\nModified: ${new Date(props.modified).toLocaleString()}`);
      }
    });

    return cleanup;
  }, []);

  return (
    <>
      {showSummary && aiSummary && (
        <div
          className="dialog-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000
          }}
          onClick={() => setShowSummary(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '80%',
              maxWidth: '600px',
              background: 'rgba(20, 20, 25, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '20px',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'rgba(255, 255, 255, 0.95)' }}>
              AI Summary: {aiSummary.file}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {aiSummary.content}
            </div>
            <button
              onClick={() => setShowSummary(false)}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                background: 'rgba(100, 200, 255, 0.2)',
                border: '1px solid rgba(100, 200, 255, 0.4)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

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
      <div style={{ display: currentTab === 'files' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <FilesTab data={data} />
      </div>
      <div style={{ display: currentTab === 'bookmarks' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <BookmarksTab data={data} />
      </div>
      <div style={{ display: currentTab === 'apps' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <AppsTab data={data} />
      </div>
    </>
  );
}

function FilesTab({ data }) {
  const [viewMode, setViewMode] = useState('tree');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <>
      <input
        type="text"
        className="quick-input"
        placeholder="Search files..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ marginBottom: '8px', padding: '6px 10px', fontSize: '10px', width: '100%' }}
      />
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <button
          className={`toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
          onClick={() => setViewMode('tree')}
          style={{ flex: 1, fontSize: '9px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Tree
        </button>
        <button
          className={`toggle-btn ${viewMode === 'graph' ? 'active' : ''}`}
          onClick={() => setViewMode('graph')}
          style={{ flex: 1, fontSize: '9px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="18" r="3"/>
            <circle cx="6" cy="6" r="3"/>
            <circle cx="18" cy="6" r="3"/>
            <line x1="9" y1="6" x2="15" y2="6"/>
            <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
          </svg>
          Graph
        </button>
      </div>

      {viewMode === 'tree' ? (
        <FileTreeView data={data} searchQuery={searchQuery} />
      ) : (
        <FileGraphView data={data} searchQuery={searchQuery} />
      )}
    </>
  );
}

function FileListView({ data, searchQuery }) {
  const [isDragging, setIsDragging] = useState(false);
  const appExtensions = ['.exe', '.lnk', '.app', '.dmg'];
  const filtered = data.files.filter(f => {
    if (f.mode !== data.currentMode) return false;
    const ext = f.name.toLowerCase().substring(f.name.lastIndexOf('.'));
    if (appExtensions.includes(ext)) return false;
    if (searchQuery && searchQuery.trim()) {
      return f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             (f.path && f.path.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return true;
  });

  const openFile = async (path) => {
    await window.panelAPI.openFile(path);
  };

  const removeFile = async (id) => {
    await window.panelAPI.removeFile(id);
  };

  const addFiles = async () => {
    const paths = await window.panelAPI.selectFiles();
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
        style={{ fontSize: '9px', padding: '12px' }}
      >
        {isDragging ? 'Drop here' : '+ Add Files'}
      </div>
      {filtered.length ? filtered.map(f => (
        <div
          key={f.id}
          className="item"
          onClick={() => openFile(f.path)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', f.path);
          }}
          style={{ cursor: 'grab' }}
        >
          <span className="item-name">{f.name}</span>
          <button className="item-delete" onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}>×</button>
        </div>
      )) : <div className="empty">No files</div>}
    </>
  );
}

function BookmarksTab({ data }) {
  const [url, setUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [browserBookmarks, setBrowserBookmarks] = useState([]);
  const [selectedBookmarks, setSelectedBookmarks] = useState(new Set());
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

  const handleImport = () => {
    const mockBookmarks = [
      { id: 1, name: 'GitHub', url: 'https://github.com' },
      { id: 2, name: 'Stack Overflow', url: 'https://stackoverflow.com' },
      { id: 3, name: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
      { id: 4, name: 'Reddit Programming', url: 'https://reddit.com/r/programming' },
      { id: 5, name: 'YouTube', url: 'https://youtube.com' }
    ];
    setBrowserBookmarks(mockBookmarks);
    setSelectedBookmarks(new Set());
    setShowImport(true);
  };

  const toggleBookmark = (id) => {
    const newSelected = new Set(selectedBookmarks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedBookmarks(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedBookmarks.size === browserBookmarks.length) {
      setSelectedBookmarks(new Set());
    } else {
      setSelectedBookmarks(new Set(browserBookmarks.map(b => b.id)));
    }
  };

  const importSelected = async () => {
    for (const bookmark of browserBookmarks) {
      if (selectedBookmarks.has(bookmark.id)) {
        await window.panelAPI.addBookmark({
          id: Date.now() + Math.random(),
          name: bookmark.name,
          url: bookmark.url,
          mode: data.currentMode,
          date: new Date().toISOString()
        });
      }
    }
    setShowImport(false);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <div className="quick-add" style={{ flex: 1, marginBottom: 0 }}>
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
        <button onClick={handleImport} style={{
          background: 'rgba(100, 150, 255, 0.15)',
          border: '1px solid rgba(100, 150, 255, 0.3)',
          borderRadius: '6px',
          padding: '6px 10px',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '9px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: '500'
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Import
        </button>
      </div>

      {showImport && (
        <ImportDialog
          bookmarks={browserBookmarks}
          selectedBookmarks={selectedBookmarks}
          onToggle={toggleBookmark}
          onToggleAll={toggleSelectAll}
          onImport={importSelected}
          onClose={() => setShowImport(false)}
        />
      )}

      {filtered.length ? filtered.map(b => (
        <div key={b.id} className="item" onClick={() => openBookmark(b.url)}>
          <span className="item-name">{b.name || b.url}</span>
          <button className="item-delete" onClick={(e) => { e.stopPropagation(); removeBookmark(b.id); }}>×</button>
        </div>
      )) : <div className="empty">No bookmarks</div>}
    </>
  );
}

function ImportDialog({ bookmarks, selectedBookmarks, onToggle, onToggleAll, onImport, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        width: '100vw', height: '100vh',
        background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100000, pointerEvents: 'all'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
        width: '90%', maxWidth: '500px', maxHeight: '70vh',
        background: 'rgba(20, 20, 25, 0.98)', backdropFilter: 'blur(40px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '16px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.95)' }}>Import Bookmarks</div>
        </div>

        <div onClick={onToggleAll} style={{
          padding: '14px 20px', background: 'rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', cursor: 'pointer'
        }}>
          <input type="checkbox" checked={selectedBookmarks.size === bookmarks.length && bookmarks.length > 0}
            onChange={() => {}} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
          <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>Select All</span>
          <span style={{ color: 'rgba(100, 200, 255, 0.8)', marginLeft: 'auto' }}>
            {selectedBookmarks.size} of {bookmarks.length}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {bookmarks.map(bookmark => (
            <div key={bookmark.id} onClick={() => onToggle(bookmark.id)} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              background: selectedBookmarks.has(bookmark.id) ? 'rgba(100, 200, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${selectedBookmarks.has(bookmark.id) ? 'rgba(100, 200, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.15s'
            }}>
              <input type="checkbox" checked={selectedBookmarks.has(bookmark.id)}
                onChange={() => {}} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.95)', marginBottom: '4px', fontWeight: '500' }}>
                  {bookmark.name}
                </div>
                <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {bookmark.url}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          padding: '16px 20px', background: 'rgba(255, 255, 255, 0.05)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex', gap: '10px', justifyContent: 'flex-end'
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px',
            color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px', cursor: 'pointer', fontWeight: '600'
          }}>Cancel</button>
          <button onClick={onImport} disabled={selectedBookmarks.size === 0} style={{
            padding: '8px 16px',
            background: selectedBookmarks.size > 0 ? 'rgba(100, 200, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${selectedBookmarks.size > 0 ? 'rgba(100, 200, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: '8px',
            color: selectedBookmarks.size > 0 ? 'rgba(100, 200, 255, 0.95)' : 'rgba(255, 255, 255, 0.3)',
            fontSize: '11px', cursor: selectedBookmarks.size > 0 ? 'pointer' : 'not-allowed', fontWeight: '600'
          }}>
            Import {selectedBookmarks.size > 0 ? `(${selectedBookmarks.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppsTab({ data }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [installedApps, setInstalledApps] = useState([]);

  const filtered = data.apps.filter(a => a.mode === data.currentMode);

  const searchResults = searchQuery.trim() ?
    installedApps.filter(app =>
      app && app.name && app.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) : [];

  useEffect(() => {
    // Load installed apps on mount
    const loadApps = async () => {
      const apps = await window.panelAPI.getInstalledApps();
      setInstalledApps(apps || []);
      console.log(`📱 Loaded ${apps?.length || 0} installed apps`);
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
      <div className="quick-add" style={{ marginBottom: '8px' }}>
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
        <>
          <div className="search-results-title">Found {searchResults.length} apps</div>
          {searchResults.map((app, idx) => (
            <div key={idx} className="item search-item">
              <span className="item-name" onClick={() => launchApp(app.path)}>
                {app.name.replace(/\.(exe|lnk|app)$/i, '')}
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
        </>
      )}

      {/* No Results */}
      {searchQuery && searchResults.length === 0 && (
        <div className="empty">No apps found for "{searchQuery}"</div>
      )}

      {!searchQuery && (
        <>
          <div className="section-title" style={{ fontSize: '9px', padding: '4px 8px' }}>Saved Apps</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length ? filtered.map(a => (
              <div key={a.id} className="item" onClick={() => launchApp(a.path)}>
                <span className="item-name">{a.name.replace(/\.(exe|lnk|app)$/i, '')}</span>
                <button className="item-delete" onClick={(e) => { e.stopPropagation(); removeApp(a.id); }}>×</button>
              </div>
            )) : <div className="empty">No saved apps. Search to add apps.</div>}
          </div>
        </>
      )}
    </>
  );
}

function TasksWidget({ data, showDialog }) {
  const [intentInput, setIntentInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRoutine, setIsRoutine] = useState(false);
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

      const result = await window.panelAPI.generateTasks(clarified.intent, isRoutine);

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
        description: t.description || '',
        dueDate: t.dueDate || null,
        color: t.color || '#3B82F6',
        isRoutine: t.isRoutine || false,
        routinePattern: t.routinePattern || null,
        startDate: t.startDate,
        endDate: t.endDate,
        mode: data.currentMode,
        completed: false,
        done: false,
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

      <div className="task-add" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.7)',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}>
          <input
            type="checkbox"
            checked={isRoutine}
            onChange={(e) => setIsRoutine(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Routine
        </label>
        <input
          type="text"
          className="quick-input"
          placeholder={isRoutine ? "Add routine task..." : "Add task..."}
          value={intentInput}
          onChange={(e) => setIntentInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && processIntent()}
          disabled={isGenerating}
          style={{ flex: 1 }}
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

function SettingsWidget({ data, showCustomDialog }) {
  const [settings, setSettings] = useState(null);
  const [currentTab, setCurrentTab] = useState('general');

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
      <div className="widget-tabs" style={{ marginBottom: '12px' }}>
        <div
          className={`widget-tab ${currentTab === 'general' ? 'active' : ''}`}
          onClick={() => setCurrentTab('general')}
        >
          General
        </div>
        <div
          className={`widget-tab ${currentTab === 'mcp' ? 'active' : ''}`}
          onClick={() => setCurrentTab('mcp')}
        >
          MCP
        </div>
      </div>

      {currentTab === 'general' ? (
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
      ) : (
        <MCPSettings showCustomDialog={showCustomDialog} />
      )}
    </>
  );
}

function ChatWidget({ data }) {
  const [chatWindows, setChatWindows] = useState([{ id: 'default', name: 'Chat 1', messages: [] }]);
  const [activeChat, setActiveChat] = useState('default');
  const [generatingChatId, setGeneratingChatId] = useState(null);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [ollamaStatus, setOllamaStatus] = useState('stopped');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [modelStatus, setModelStatus] = useState('');
  const [thoughts, setThoughts] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);
  const [enabledTools, setEnabledTools] = useState(new Set());
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [showToolsPanel, setShowToolsPanel] = useState(false);

  const messages = chatWindows.find(c => c.id === activeChat)?.messages || [];
  const setMessages = (newMessages) => {
    setChatWindows(prev => prev.map(c =>
      c.id === activeChat
        ? { ...c, messages: typeof newMessages === 'function' ? newMessages(c.messages) : newMessages }
        : c
    ));
  };

  const setMessagesForChat = (chatId, newMessages) => {
    setChatWindows(prev => prev.map(c =>
      c.id === chatId
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

    // Load available MCP tools
    const loadTools = async () => {
      const tools = await window.panelAPI.getMCPTools();
      setAvailableTools(tools);
      // Enable all tools by default
      setEnabledTools(new Set(tools.map(t => t.name)));
    };
    loadTools();
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
    const removeChunkListener = window.panelAPI.onOllamaChunk((chunk) => {
      // Update the chat that's currently generating, not necessarily the active one
      const targetChatId = generatingChatId || activeChat;
      setMessagesForChat(targetChatId, (prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        const lastMsg = newMessages[lastIndex];
        if (lastMsg && lastMsg.role === 'assistant') {
          // Create new message object to trigger React re-render
          newMessages[lastIndex] = {
            ...lastMsg,
            content: lastMsg.content + chunk
          };
        }
        return newMessages;
      });
    });

    // Listen for completion
    const removeDoneListener = window.panelAPI.onOllamaDone(() => {
      setIsGenerating(false);
      setGeneratingChatId(null);
      setModelStatus('');
    });

    // Listen for download progress
    const removeProgressListener = window.panelAPI.onOllamaDownloadProgress((data) => {
      setDownloadProgress(data.percent);
    });

    // Listen for model download/install logs
    const removeLogListener = window.panelAPI.onOllamaLog((message) => {
      setModelStatus(message);
    });

    // Listen for thought events
    const removeThoughtListener = window.panelAPI.onOllamaThought((thought) => {
      setThoughts(prev => [...prev, thought]);
    });

    // Listen for tool call start
    const removeToolStartListener = window.panelAPI.onToolCallStart((data) => {
      const targetChatId = generatingChatId || activeChat;
      setMessagesForChat(targetChatId, (prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        const lastMsg = newMessages[lastIndex];
        if (lastMsg && lastMsg.role === 'assistant') {
          if (!lastMsg.toolCalls) {
            lastMsg.toolCalls = [];
          }
          lastMsg.toolCalls.push({
            toolName: data.toolName,
            args: data.args,
            query: data.query,
            result: null
          });
        }
        return newMessages;
      });
    });

    // Listen for tool call result
    const removeToolResultListener = window.panelAPI.onToolCallResult((data) => {
      const targetChatId = generatingChatId || activeChat;
      setMessagesForChat(targetChatId, (prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        const lastMsg = newMessages[lastIndex];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.toolCalls) {
          const lastToolCall = lastMsg.toolCalls[lastMsg.toolCalls.length - 1];
          if (lastToolCall) {
            lastToolCall.result = data.result;
          }
        }
        return newMessages;
      });
    });

    // Cleanup listeners on unmount
    return () => {
      if (removeChunkListener) removeChunkListener();
      if (removeDoneListener) removeDoneListener();
      if (removeProgressListener) removeProgressListener();
      if (removeLogListener) removeLogListener();
      if (removeThoughtListener) removeThoughtListener();
      if (removeToolStartListener) removeToolStartListener();
      if (removeToolResultListener) removeToolResultListener();
    };
  }, [generatingChatId, activeChat]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleEditMessage = (messageId, newContent) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, content: newContent } : msg
    ));
  };

  const handleRetryMessage = async (messageId) => {
    // Find the message and retry generation
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Remove all messages after the one being retried
    const messagesToKeep = messages.slice(0, messageIndex);
    setMessages(messagesToKeep);

    // Find the last user message to retry with
    const lastUserMessage = messagesToKeep.reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;

    setIsGenerating(true);
    setGeneratingChatId(activeChat); // Track which chat is generating

    // Add thinking message
    const thinkingMessage = {
      id: Date.now() + '-thinking',
      role: 'thinking',
      content: 'Thinking...'
    };

    setMessages(prev => [...prev, thinkingMessage]);

    // Build context for RAG
    const context = buildContext();
    const enhancedPrompt = context ? `Context:\n${context}\n\nUser question: ${lastUserMessage.content}` : lastUserMessage.content;

    const assistantMessage = {
      id: Date.now() + '-assistant',
      role: 'assistant',
      content: ''
    };

    // Remove thinking message and add assistant message
    setMessages(prev => prev.filter(m => m.role !== 'thinking').concat([assistantMessage]));
    await window.panelAPI.chatWithOllama(enhancedPrompt);
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

  const toggleTool = (toolName) => {
    setEnabledTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolName)) {
        newSet.delete(toolName);
      } else {
        newSet.add(toolName);
      }
      return newSet;
    });
  };

  const toggleAllTools = () => {
    if (toolsEnabled) {
      setEnabledTools(new Set());
      setToolsEnabled(false);
    } else {
      setEnabledTools(new Set(availableTools.map(t => t.name)));
      setToolsEnabled(true);
    }
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
    setGeneratingChatId(activeChat); // Track which chat is generating
    setThoughts([]); // Clear previous thoughts

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
      <div className="chat-tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto' }}>
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

        {/* Tools Button */}
        {availableTools.length > 0 && (
          <button
            onClick={() => setShowToolsPanel(!showToolsPanel)}
            style={{
              padding: '6px 12px',
              background: showToolsPanel ? 'rgba(100, 200, 255, 0.3)' : 'rgba(100, 150, 255, 0.15)',
              border: '1px solid rgba(100, 150, 255, 0.3)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '8px',
              flexShrink: 0
            }}
            title="MCP Tools"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            Tools ({enabledTools.size}/{availableTools.length})
          </button>
        )}
      </div>

      {/* Tools Panel */}
      {showToolsPanel && availableTools.length > 0 && (
        <div style={{
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          marginBottom: '12px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' }}>
              Available MCP Tools
            </div>
            <button
              onClick={toggleAllTools}
              style={{
                padding: '4px 10px',
                background: toolsEnabled ? 'rgba(100, 255, 150, 0.2)' : 'rgba(255, 100, 100, 0.2)',
                border: `1px solid ${toolsEnabled ? 'rgba(100, 255, 150, 0.4)' : 'rgba(255, 100, 100, 0.4)'}`,
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {toolsEnabled ? 'Disable All' : 'Enable All'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {availableTools.map(tool => (
              <div
                key={tool.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: enabledTools.has(tool.name) ? 'rgba(100, 200, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${enabledTools.has(tool.name) ? 'rgba(100, 200, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '2px' }}>
                    {tool.name}
                  </div>
                  <div style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {tool.description || 'No description'}
                  </div>
                  <div style={{ fontSize: '7px', color: 'rgba(100, 200, 255, 0.6)', marginTop: '2px' }}>
                    {tool.serverName}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginLeft: '12px' }}>
                  <input
                    type="checkbox"
                    checked={enabledTools.has(tool.name)}
                    onChange={() => toggleTool(tool.name)}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                      accentColor: 'rgba(100, 200, 255, 0.8)'
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

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
            onRetryMessage={handleRetryMessage}
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
            files={attachedFiles}
            setFiles={setAttachedFiles}
            onStop={async () => {
              await window.panelAPI.stopOllamaGeneration();
              setIsGenerating(false);
              setGeneratingChatId(null);
            }}
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
