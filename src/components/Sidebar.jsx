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
    window.sidebarAPI.openModeSelector();
  };

  const openSettings = () => {
    window.sidebarAPI.openSettings();
  };

  const m = data.currentMode;
  const totalFiles = data.files.filter(f => f.mode === m).length + 
                     data.bookmarks.filter(b => b.mode === m).length + 
                     data.apps.filter(a => a.mode === m).length;
  const activeTasks = data.tasks.filter(t => t.mode === m && !t.completed).length;

  return (
    <div className="sidebar">
      <div className="sidebar-icon" onClick={() => openPanel('files')}>
        <span className="icon">📁</span>
        <span className="badge">{totalFiles}</span>
      </div>
      <div className="sidebar-icon" onClick={() => openPanel('tasks')}>
        <span className="icon">✓</span>
        <span className="badge">{activeTasks}</span>
      </div>
      <div className="sidebar-icon" onClick={openGraphView}>
        <span className="icon">◉</span>
      </div>
      <div className="sidebar-icon" onClick={openModeSelector}>
        <span className="icon">⚡</span>
      </div>
      <div className="sidebar-icon" onClick={openSettings}>
        <span className="icon">⚙</span>
      </div>
    </div>
  );
}

