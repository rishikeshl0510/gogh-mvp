import React, { useState, useEffect } from 'react';

export default function Mode() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const init = async () => {
      const fetchedData = await window.modeAPI.getData();
      setData(fetchedData);
    };

    init();

    window.modeAPI.onDataUpdated(async () => {
      const fetchedData = await window.modeAPI.getData();
      setData(fetchedData);
    });
  }, []);

  if (!data) return null;

  const switchMode = async (id) => {
    await window.modeAPI.switchMode(id);
    window.close();
  };

  const addMode = async () => {
    const name = prompt('Mode name:');
    if (name && name.trim()) {
      await window.modeAPI.addMode({
        id: 'mode_' + Date.now(),
        name: name.trim(),
        color: '#ffffff'
      });
    }
  };

  return (
    <div className="mode-container">
      <div className="mode-header">
        <div className="mode-title">Switch Mode</div>
        <div className="mode-close" onClick={() => window.close()}>×</div>
      </div>
      <div className="mode-list">
        {data.modes.map(m => (
          <div 
            key={m.id}
            className={`mode-item ${m.id === data.currentMode ? 'active' : ''}`}
            onClick={() => switchMode(m.id)}
          >
            <span className="mode-name">{m.name}</span>
            <span className="mode-indicator"></span>
          </div>
        ))}
      </div>
      <button className="mode-add-btn" onClick={addMode}>+ New Mode</button>
    </div>
  );
}

