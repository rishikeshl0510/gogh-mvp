import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const init = async () => {
      const fetchedSettings = await window.settingsAPI.getSettings();
      setSettings(fetchedSettings);
    };

    init();
  }, []);

  if (!settings) return null;

  const addDirectory = async () => {
    const updated = await window.settingsAPI.addSearchDirectory();
    setSettings(updated);
  };

  const removeDirectory = async (dir) => {
    const updated = await window.settingsAPI.removeSearchDirectory(dir);
    setSettings(updated);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <div className="settings-title">Settings</div>
        <div className="settings-close" onClick={() => window.close()}>×</div>
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
      </div>
    </div>
  );
}

