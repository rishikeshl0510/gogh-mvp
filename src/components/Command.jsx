import React, { useState, useEffect } from 'react';

export default function Command() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.trim()) {
        performSearch(input.trim());
      } else {
        setResults([]);
        setLoading(false);
      }
    }, aiEnabled ? 800 : 200);

    return () => clearTimeout(timer);
  }, [input, aiEnabled]);

  const performSearch = async (query) => {
    setLoading(true);
    try {
      const localResults = await window.commandAPI.searchLocal(query);
      
      let resultArray = [];
      if (localResults && typeof localResults === 'object' && !Array.isArray(localResults)) {
        const apps = localResults.apps || [];
        const files = localResults.files || [];
        resultArray = [...apps, ...files];
      } else if (Array.isArray(localResults)) {
        resultArray = localResults;
      }
      
      setResults(resultArray);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    }
    setLoading(false);
  };

  const executeResult = async (result) => {
    await window.commandAPI.executeResult(result);
    await window.commandAPI.hide();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        executeResult(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      window.commandAPI.hide();
    }
  };

  const groupedResults = {};
  results.forEach(result => {
    const cat = result.type || 'other';
    if (cat === 'ai') return;
    if (!groupedResults[cat]) groupedResults[cat] = [];
    groupedResults[cat].push(result);
  });

  const categoryOrder = ['app', 'file', 'folder', 'web'];
  const categoryNames = {
    'app': 'Applications',
    'file': 'Files',
    'folder': 'Folders',
    'web': 'Web'
  };

  return (
    <div className="container">
      <div className="search-header">
        <div className="search-title">Command Palette</div>
        <div className="ai-toggle-container">
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className="toggle-label">AI</span>
        </div>
      </div>

      <div className="search-input">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search apps, files..." 
          autoFocus
        />
      </div>

      {loading && <div className="loading">Searching...</div>}

      {!loading && results.length > 0 && (
        <div className="results">
          {categoryOrder.map(catKey => {
            if (!groupedResults[catKey]) return null;
            return (
              <React.Fragment key={catKey}>
                <div className="category-header">{categoryNames[catKey] || catKey.toUpperCase()}</div>
                {groupedResults[catKey].map((result, idx) => (
                  <div
                    key={idx}
                    className={`result-item ${selectedIndex === idx ? 'selected' : ''}`}
                    onClick={() => executeResult(result)}
                  >
                    <div className="result-icon">
                      {result.icon && <img src={result.icon} alt="" />}
                    </div>
                    <div className="result-content">
                      <div className="result-title">{result.title || 'Untitled'}</div>
                      {result.description && (
                        <div className="result-description">{result.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {!loading && input && results.length === 0 && (
        <div className="no-results">No results found</div>
      )}
    </div>
  );
}

