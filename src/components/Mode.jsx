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
    <div className="mode-widget">
      <div className="mode-header">
        <div className="mode-title">SWITCH MODE</div>
        <div className="mode-close" onClick={() => window.close()}>×</div>
      </div>
      <div className="mode-content">
        <div className="mode-list">
          {data.modes.map(m => (
            <div
              key={m.id}
              className={`mode-item ${m.id === data.currentMode ? 'active' : ''}`}
              onClick={() => switchMode(m.id)}
            >
              <div className="mode-radio">
                <div className={`radio-outer ${m.id === data.currentMode ? 'active' : ''}`}>
                  {m.id === data.currentMode && <div className="radio-inner"></div>}
                </div>
              </div>
              <span className="mode-name">{m.name}</span>
            </div>
          ))}
        </div>
        <button className="mode-add-btn" onClick={addMode}>+ New Mode</button>
      </div>
    </div>
  );
}

