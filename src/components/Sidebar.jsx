import React, { useState, useEffect } from 'react';

export default function Sidebar() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const init = async () => {
      const fetchedData = await window.sidebarAPI.getData();
      setData(fetchedData);
    };

    init();

    window.sidebarAPI.onDataUpdated(async () => {
      const fetchedData = await window.sidebarAPI.getData();
      setData(fetchedData);
    });
  }, []);

  if (!data) return null;

  const openPanel = (section) => {
    window.sidebarAPI.openPanel(section);
  };

  const openGraphView = () => {
    window.sidebarAPI.openGraphView();
  };

  const openModeSelector = () => {
    openPanel('modes');
  };

  const openSettings = () => {
    openPanel('settings');
  };

  const m = data.currentMode;
  const totalFiles = data.files.filter(f => f.mode === m).length + 
                     data.bookmarks.filter(b => b.mode === m).length + 
                     data.apps.filter(a => a.mode === m).length;
  const activeTasks = data.tasks.filter(t => t.mode === m && !t.completed).length;

  return (
    <div className="sidebar">
      <div className="sidebar-icon" onClick={() => openPanel('chat')}>
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div className="sidebar-icon" onClick={() => openPanel('files')}>
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="badge">{totalFiles}</span>
      </div>
      <div className="sidebar-icon" onClick={() => openPanel('tasks')}>
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <span className="badge">{activeTasks}</span>
      </div>
      <div className="sidebar-icon" onClick={openModeSelector}>
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>
      <div className="sidebar-icon" onClick={openSettings}>
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
        </svg>
      </div>
    </div>
  );
}

