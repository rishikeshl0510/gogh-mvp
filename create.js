#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🎨 Creating CRT-style UI...\n');

// ============================================
// CREATE CRT-STYLE COMMAND.HTML
// ============================================

const crtHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      background: transparent;
      color: white;
      overflow: hidden;
    }

    .container {
      width: 700px;
      height: 520px;
      background: rgba(10, 10, 10, 0.95);
      backdrop-filter: blur(40px) saturate(150%);
      border-radius: 16px;
      box-shadow: 
        0 0 80px rgba(255, 255, 255, 0.15),
        0 0 40px rgba(255, 255, 255, 0.1),
        0 20px 60px rgba(0, 0, 0, 0.5),
        inset 0 0 100px rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }

    /* CRT Scanline effect */
    .container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: repeating-linear-gradient(
        0deg,
        rgba(255, 255, 255, 0.03) 0px,
        transparent 1px,
        transparent 2px
      );
      pointer-events: none;
      z-index: 1000;
    }

    /* CRT Glow effect */
    .container::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(
        ellipse at center,
        rgba(255, 255, 255, 0.08) 0%,
        transparent 70%
      );
      pointer-events: none;
      z-index: 999;
    }

    .search-header {
      padding: 16px 20px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      z-index: 10;
    }

    .search-title {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    .ai-toggle-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .toggle-label {
      color: rgba(255, 255, 255, 0.5);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* CRT-style toggle switch */
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.08);
      transition: 0.3s;
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 
        0 0 20px rgba(255, 255, 255, 0.05),
        inset 0 0 10px rgba(0, 0, 0, 0.3);
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background-color: rgba(255, 255, 255, 0.3);
      transition: 0.3s;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    }

    input:checked + .toggle-slider {
      background-color: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.4);
      box-shadow: 
        0 0 30px rgba(255, 255, 255, 0.2),
        0 0 15px rgba(255, 255, 255, 0.1),
        inset 0 0 20px rgba(255, 255, 255, 0.05);
    }

    input:checked + .toggle-slider:before {
      transform: translateX(20px);
      background-color: white;
      box-shadow: 
        0 0 20px rgba(255, 255, 255, 0.6),
        0 0 10px rgba(255, 255, 255, 0.4),
        0 2px 4px rgba(0, 0, 0, 0.4);
    }

    .search-input {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
      z-index: 10;
    }

    #input {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      outline: none;
      color: white;
      font-size: 15px;
      padding: 12px 16px;
      border-radius: 10px;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      box-shadow: 
        0 0 20px rgba(255, 255, 255, 0.05),
        inset 0 0 20px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    }

    #input:focus {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.25);
      box-shadow: 
        0 0 30px rgba(255, 255, 255, 0.1),
        0 0 15px rgba(255, 255, 255, 0.05),
        inset 0 0 20px rgba(0, 0, 0, 0.2);
    }

    #input::placeholder {
      color: rgba(255, 255, 255, 0.25);
    }

    #loading {
      padding: 12px 20px;
      color: rgba(255, 255, 255, 0.4);
      font-size: 12px;
      text-align: center;
      position: relative;
      z-index: 10;
    }

    #results {
      flex: 1;
      overflow-y: auto;
      position: relative;
      z-index: 10;
    }

    #results::-webkit-scrollbar {
      width: 8px;
    }

    #results::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.02);
    }

    #results::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }

    #results::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .hidden {
      display: none !important;
    }

    .no-results {
      padding: 60px 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.3);
      font-size: 13px;
      letter-spacing: 0.5px;
    }

    .category-header {
      padding: 14px 20px 8px;
      color: rgba(255, 255, 255, 0.35);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      background: rgba(0, 0, 0, 0.2);
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .result-item {
      display: flex;
      align-items: center;
      padding: 14px 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 2px solid transparent;
      position: relative;
    }

    .result-item::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 0;
      height: 100%;
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent);
      transition: width 0.3s ease;
    }

    .result-item:hover::before {
      width: 100%;
    }

    .result-item:hover {
      background: rgba(255, 255, 255, 0.03);
      border-left-color: rgba(255, 255, 255, 0.4);
      box-shadow: 
        0 0 20px rgba(255, 255, 255, 0.05),
        inset 0 0 20px rgba(255, 255, 255, 0.02);
    }

    .result-item.selected {
      background: rgba(255, 255, 255, 0.06);
      border-left-color: white;
      box-shadow: 
        0 0 30px rgba(255, 255, 255, 0.08),
        inset 0 0 30px rgba(255, 255, 255, 0.03);
    }

    .result-icon {
      width: 36px;
      height: 36px;
      margin-right: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 
        0 0 15px rgba(255, 255, 255, 0.03),
        inset 0 0 10px rgba(0, 0, 0, 0.2);
    }

    .result-icon img {
      width: 28px;
      height: 28px;
      object-fit: contain;
      border-radius: 6px;
    }

    .result-content {
      flex: 1;
      min-width: 0;
    }

    .result-title {
      color: rgba(255, 255, 255, 0.9);
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      letter-spacing: 0.3px;
    }

    .result-description {
      color: rgba(255, 255, 255, 0.35);
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #debug-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 150px;
      background: rgba(0,0,0,0.95);
      color: #0f0;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      padding: 8px;
      overflow-y: auto;
      border-top: 1px solid #0f0;
      display: none;
      z-index: 1000;
    }

    #debug-panel::-webkit-scrollbar {
      width: 6px;
    }

    #debug-panel::-webkit-scrollbar-thumb {
      background: #0f0;
      border-radius: 3px;
    }

    .debug-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      padding-bottom: 4px;
      border-bottom: 1px solid #0f0;
    }

    .debug-title {
      color: #0ff;
      font-weight: bold;
    }

    .debug-close {
      background: transparent;
      border: 1px solid #0f0;
      color: #0f0;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 10px;
    }

    .debug-close:hover {
      background: #0f0;
      color: #000;
    }

    #debug-toggle {
      position: fixed;
      bottom: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(0,255,0,0.2);
      border: 1px solid #0f0;
      color: #0f0;
      cursor: pointer;
      font-size: 14px;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: monospace;
    }

    #debug-toggle:hover {
      background: rgba(0,255,0,0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="search-header">
      <div class="search-title">Command Palette</div>
      <div class="ai-toggle-container">
        <label class="toggle-switch">
          <input type="checkbox" id="ai-toggle">
          <span class="toggle-slider"></span>
        </label>
        <span class="toggle-label">AI</span>
      </div>
    </div>

    <div class="search-input">
      <input type="text" id="input" placeholder="Search apps, files..." autofocus>
    </div>

    <div id="loading" class="hidden">Searching...</div>

    <div id="results" class="hidden"></div>
  </div>

  <div id="debug-panel">
    <div class="debug-header">
      <span class="debug-title">Debug Console</span>
      <button class="debug-close" onclick="document.getElementById('debug-panel').style.display='none'">Close</button>
    </div>
    <div id="debug-logs"></div>
  </div>

  <button id="debug-toggle">D</button>

  <script src="renderer-command.js"></script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'command.html'), crtHtml);
console.log('✅ CRT-style command.html created\n');

// ============================================
// UPDATE RENDERER TO REMOVE EMOJIS AND AI CATEGORY
// ============================================

const rendererContent = `// Debug Logger
const debugLogs = [];
function debugLog(message, data) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = \`[\${timestamp}] \${message}\` + (data ? \` \${JSON.stringify(data)}\` : '');
  debugLogs.push(logEntry);
  console.log(message, data || '');

  const debugLogsEl = document.getElementById('debug-logs');
  if (debugLogsEl) {
    debugLogsEl.innerHTML = debugLogs.slice(-50).map(log => 
      \`<div style="color: #0f0; padding: 2px 0; font-size: 10px;">\${log}</div>\`
    ).join('');
    debugLogsEl.scrollTop = debugLogsEl.scrollHeight;
  }
}

// Toggle debug panel
setTimeout(() => {
  const debugToggle = document.getElementById('debug-toggle');
  const debugPanel = document.getElementById('debug-panel');
  if (debugToggle && debugPanel) {
    debugToggle.addEventListener('click', () => {
      const isHidden = debugPanel.style.display === 'none' || !debugPanel.style.display;
      debugPanel.style.display = isHidden ? 'block' : 'none';
      debugLog('Debug panel toggled', { visible: isHidden });
    });
  }
}, 100);

// Main variables
const input = document.getElementById('input');
const resultsContainer = document.getElementById('results');
const loading = document.getElementById('loading');
const aiToggle = document.getElementById('ai-toggle');

let allResults = [];
let selectedIndex = -1;
let searchTimer = null;
let aiEnabled = false;

debugLog('Command palette initialized');
input.focus();

// AI Toggle handler
if (aiToggle) {
  debugLog('AI toggle element found');
  aiToggle.addEventListener('change', (e) => {
    aiEnabled = e.target.checked;
    debugLog('AI toggle changed', { enabled: aiEnabled });
    if (input.value.trim()) {
      performSearch(input.value.trim());
    }
  });

  aiToggle.addEventListener('click', () => {
    debugLog('AI toggle clicked');
  });
} else {
  debugLog('ERROR: AI toggle element not found!');
}

// Input handler
input.addEventListener('input', (e) => {
  const query = e.target.value.trim();

  if (!query) {
    resultsContainer.classList.add('hidden');
    resultsContainer.innerHTML = '';
    loading.classList.add('hidden');
    debugLog('Query empty - cleared results');
    return;
  }

  debugLog('Input changed', { query });

  resultsContainer.classList.add('hidden');
  loading.classList.remove('hidden');

  clearTimeout(searchTimer);

  const debounceTime = aiEnabled ? 800 : 200;
  debugLog('Debouncing', { time: debounceTime + 'ms', aiEnabled });

  searchTimer = setTimeout(() => {
    performSearch(query);
  }, debounceTime);
});

async function performSearch(query) {
  debugLog('performSearch START', { query });

  try {
    allResults = [];

    // Always do local search
    debugLog('Calling window.commandAPI.searchLocal');
    const localResults = await window.commandAPI.searchLocal(query);
    debugLog('searchLocal returned', { type: typeof localResults, isArray: Array.isArray(localResults) });

    // Handle object response { files: [], apps: [] }
    if (localResults && typeof localResults === 'object' && !Array.isArray(localResults)) {
      debugLog('Converting object to array');
      const apps = localResults.apps || [];
      const files = localResults.files || [];
      allResults = [...apps, ...files];
      debugLog('Converted to array', { apps: apps.length, files: files.length, total: allResults.length });
    } else if (Array.isArray(localResults)) {
      allResults = localResults;
      debugLog('Already array', { count: allResults.length });
    }

    // If AI is enabled, REPLACE results with AI response (not add to them)
    if (aiEnabled) {
      debugLog('AI enabled - calling searchAI');
      loading.textContent = 'Asking AI...';
      try {
        const aiResults = await window.commandAPI.searchAI(query);
        debugLog('AI results received', { count: aiResults?.length || 0 });
        // Show ONLY local results - AI is for different purpose
        // Don't add AI results to the list
      } catch (aiError) {
        debugLog('AI search error', { error: aiError.message });
      }
    }

    debugLog('performSearch END', { totalResults: allResults.length });
    showResults();
  } catch (error) {
    debugLog('ERROR in performSearch', { error: error.message, stack: error.stack });
    console.error('Search error:', error);
    showResults();
  }
}

function showResults() {
  debugLog('showResults START', { resultCount: allResults.length });
  loading.classList.add('hidden');

  if (!allResults || allResults.length === 0) {
    resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
    resultsContainer.classList.remove('hidden');
    debugLog('No results to display');
    return;
  }

  resultsContainer.innerHTML = '';
  selectedIndex = -1;

  // Group by category (exclude AI category)
  const categories = {};
  allResults.forEach(result => {
    const cat = result.type || 'other';
    if (cat === 'ai') return; // Skip AI results
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(result);
  });

  debugLog('Categories', Object.keys(categories).map(k => k + ':' + categories[k].length));

  const categoryOrder = ['app', 'file', 'folder', 'web'];
  const categoryNames = {
    'app': 'Applications',
    'file': 'Files',
    'folder': 'Folders',
    'web': 'Web'
  };

  let totalRendered = 0;

  categoryOrder.forEach(catKey => {
    if (!categories[catKey]) return;

    // Category header
    const header = document.createElement('div');
    header.className = 'category-header';
    header.textContent = categoryNames[catKey] || catKey.toUpperCase();
    resultsContainer.appendChild(header);

    // Items
    categories[catKey].forEach((result) => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.dataset.index = totalRendered;

      // Icon (no emoji, just box)
      const iconEl = document.createElement('div');
      iconEl.className = 'result-icon';

      if (result.icon) {
        const img = document.createElement('img');
        img.src = result.icon;
        img.onerror = () => {
          iconEl.innerHTML = '';
        };
        iconEl.appendChild(img);
      }

      // Content
      const content = document.createElement('div');
      content.className = 'result-content';

      const title = document.createElement('div');
      title.className = 'result-title';
      title.textContent = result.title || 'Untitled';

      content.appendChild(title);

      if (result.description) {
        const desc = document.createElement('div');
        desc.className = 'result-description';
        desc.textContent = result.description;
        content.appendChild(desc);
      }

      item.appendChild(iconEl);
      item.appendChild(content);

      item.addEventListener('click', () => executeResult(result));

      resultsContainer.appendChild(item);
      totalRendered++;
    });
  });

  debugLog('showResults END', { rendered: totalRendered });
  resultsContainer.classList.remove('hidden');
}

async function executeResult(result) {
  debugLog('Executing', { title: result.title, type: result.type });
  await window.commandAPI.executeResult(result);
  await window.commandAPI.hide();
}

// Keyboard navigation
input.addEventListener('keydown', (e) => {
  const items = document.querySelectorAll('.result-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (selectedIndex < items.length - 1) {
      selectedIndex++;
      updateSelection(items);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (selectedIndex > 0) {
      selectedIndex--;
      updateSelection(items);
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedIndex >= 0 && items[selectedIndex]) {
      items[selectedIndex].click();
    }
  } else if (e.key === 'Escape') {
    window.commandAPI.hide();
  }
});

function updateSelection(items) {
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

debugLog('All event listeners attached - ready!');
`;

fs.writeFileSync(path.join(__dirname, 'renderer-command.js'), rendererContent);
console.log('✅ renderer-command.js updated\n');

console.log('🎉 CRT-STYLE UI CREATED!\n');
console.log('📋 Features:');
console.log('   ✓ CRT scanline effect');
console.log('   ✓ White glow/blur aesthetic');
console.log('   ✓ CRT-style AI toggle with glow');
console.log('   ✓ NO emojis anywhere');
console.log('   ✓ NO AI results category');
console.log('   ✓ Monospace font for retro feel');
console.log('   ✓ Smooth animations and glows');
console.log('\n⚡ Restart your app to see the CRT aesthetic!');
