// Debug Logger
const debugLogs = [];
function debugLog(message, data) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}` + (data ? ` ${JSON.stringify(data)}` : '');
  debugLogs.push(logEntry);
  console.log(message, data || '');

  const debugLogsEl = document.getElementById('debug-logs');
  if (debugLogsEl) {
    debugLogsEl.innerHTML = debugLogs.slice(-50).map(log => 
      `<div style="color: #0f0; padding: 2px 0; font-size: 10px;">${log}</div>`
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
