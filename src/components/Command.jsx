import React, { useState, useEffect } from 'react';

export default function Command() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [aiResult, setAiResult] = useState(null);
  const [aiStreaming, setAiStreaming] = useState(false);

  useEffect(() => {
    // Set up AI streaming listener
    const unsubscribe = window.commandAPI.onAISearchChunk((chunk) => {
      setAiResult(prev => ({
        ...prev,
        description: chunk
      }));
    });

    const timer = setTimeout(() => {
      if (input.trim()) {
        performSearch(input.trim());
      } else {
        setResults([]);
        setAiResult(null);
        setLoading(false);
      }
    }, aiEnabled ? 800 : 200);

    return () => {
      clearTimeout(timer);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [input, aiEnabled]);

  const performSearch = async (query) => {
    setLoading(true);
    setAiResult(null);

    try {
      // Start local search immediately
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
      setLoading(false);

      // Start AI search with streaming if enabled
      if (aiEnabled) {
        setAiStreaming(true);
        setAiResult({
          type: 'ai',
          title: query,
          description: '',
          action: 'copy'
        });

        const aiSearchResult = await window.commandAPI.searchAI(query);

        // Update with final result
        if (aiSearchResult) {
          setAiResult(aiSearchResult);
        }
        setAiStreaming(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setAiResult(null);
      setLoading(false);
      setAiStreaming(false);
    }
  };

  const executeResult = async (result) => {
    await window.commandAPI.executeResult(result);
    await window.commandAPI.hide();
  };

  const copyAIResponse = (e) => {
    e.stopPropagation();
    if (aiResult && aiResult.description) {
      navigator.clipboard.writeText(aiResult.description);
      e.target.textContent = '✓';
      setTimeout(() => {
        e.target.textContent = '⎘';
      }, 2000);
    }
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

  return (
    <div className="command-widget">
      <div className="command-header">
        <div className="command-title">COMMAND</div>
        <div className="ai-toggle">
          <label className="crt-toggle">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb"></span>
            </span>
          </label>
          <span className="toggle-text">AI</span>
        </div>
      </div>

      <div className="command-search">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          autoFocus
          className="command-input"
        />
      </div>

      {loading && <div className="command-loading">Searching...</div>}

      {/* AI Result Section - Separate from other results */}
      {aiResult && (
        <div className="ai-result-section">
          <div className="ai-result-header">AI Response</div>
          <div className="command-result ai-result">
            <div className="result-title">{aiResult.title || 'Untitled'}</div>
            <div className="result-path ai-response">
              {aiResult.description || (aiStreaming ? 'Thinking...' : '')}
            </div>
            <button className="ai-copy-btn" onClick={copyAIResponse}>⎘</button>
          </div>
        </div>
      )}

      {/* Local Results Section */}
      {!loading && results.length > 0 && (
        <div className="command-results">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={`command-result ${selectedIndex === idx ? 'selected' : ''}`}
              onClick={() => executeResult(result)}
            >
              <div className="result-title">{result.title || 'Untitled'}</div>
              {result.description && (
                <div className="result-path">{result.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && input && results.length === 0 && !aiResult && (
        <div className="command-empty">No results</div>
      )}
    </div>
  );
}

