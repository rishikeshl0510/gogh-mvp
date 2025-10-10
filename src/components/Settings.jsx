import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const init = async () => {
      const fetchedSettings = await window.settingsAPI.getSettings();
      setSettings(fetchedSettings);
    };

    init();
  }, []);

  if (!settings) return null;

  const closeSettings = () => {
    setIsOpen(false);
    setTimeout(() => window.close(), 300);
  };

  const addDirectory = async () => {
    const updated = await window.settingsAPI.addSearchDirectory();
    setSettings(updated);
  };

  const removeDirectory = async (dir) => {
    const updated = await window.settingsAPI.removeSearchDirectory(dir);
    setSettings(updated);
  };

  const deleteAllData = async () => {
    const confirmed = confirm('⚠️ WARNING: This will delete ALL your data including:\n\n• All files and bookmarks\n• All tasks and intents\n• All apps\n• All modes (except default)\n\nThis action cannot be undone. Are you sure?');
    
    if (confirmed) {
      const doubleConfirm = confirm('This is your last chance. Delete everything?');
      if (doubleConfirm) {
        await window.settingsAPI.deleteAllData();
        alert('All data has been deleted.');
      }
    }
  };

  return (
    <div className={`settings-container ${isOpen ? 'settings-open' : ''}`}>
      <div className="settings-header">
        <div className="settings-title">Settings</div>
        <div className="settings-close" onClick={closeSettings}>×</div>
      </div>
      <div className="settings-content">
        <div className="settings-section">
          <div className="settings-section-title">Search Directories</div>
          <div className="settings-section-desc">
            Choose directories to search for files
          </div>
          <div className="dir-list">
            {settings.searchDirectories && settings.searchDirectories.map((dir, idx) => (
              <div key={idx} className="dir-item">
                <span className="dir-path">{dir}</span>
                <span className="remove-btn" onClick={() => removeDirectory(dir)}>Remove</span>
              </div>
            ))}
          </div>
          <button className="settings-btn" onClick={addDirectory}>+ Add Directory</button>
        </div>

        <div className="settings-section danger-zone">
          <div className="settings-section-title">Danger Zone</div>
          <div className="settings-section-desc">
            Permanently delete all application data
          </div>
          <button className="settings-btn danger-btn" onClick={deleteAllData}>
            Delete All Data
          </button>
        </div>
      </div>
    </div>
  );
}

