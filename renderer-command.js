const input = document.getElementById('input');
const resultsContainer = document.getElementById('results');
const loading = document.getElementById('loading');

let allResults = { ai: [], web: [], files: [], apps: [] };
let selectedIndex = -1;
let allItems = [];
let searchTimer = null;

input.focus();

input.addEventListener('input', async (e) => {
  const query = e.target.value.trim();
  
  if (!query) {
    resultsContainer.classList.add('hidden');
    loading.classList.add('hidden');
    return;
  }
  
  resultsContainer.classList.add('hidden');
  loading.classList.remove('hidden');
  
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    allResults = await window.commandAPI.unifiedSearch(query);
    showResults();
  }, 300);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectNext();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectPrev();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    executeSelected();
  } else if (e.key === 'Escape') {
    window.commandAPI.hide();
  }
});

function showResults() {
  loading.classList.add('hidden');
  
  allItems = [];
  let html = '';
  
  // AI Results
  if (allResults.ai && allResults.ai.length > 0) {
    html += '<div class="category"><div class="category-title">AI Response</div>';
    allResults.ai.forEach(item => {
      html += createItem(item, '🤖');
      allItems.push(item);
    });
    html += '</div>';
  }
  
  // Web Results
  if (allResults.web && allResults.web.length > 0) {
    html += '<div class="category"><div class="category-title">Web Results</div>';
    allResults.web.forEach(item => {
      html += createItem(item, '🌐');
      allItems.push(item);
    });
    html += '</div>';
  }
  
  // File Results
  if (allResults.files && allResults.files.length > 0) {
    html += '<div class="category"><div class="category-title">Files</div>';
    allResults.files.forEach(item => {
      const icon = item.type === 'folder' ? '📁' : '📄';
      html += createItem(item, icon);
      allItems.push(item);
    });
    html += '</div>';
  }
  
  // App Results
  if (allResults.apps && allResults.apps.length > 0) {
    html += '<div class="category"><div class="category-title">Apps</div>';
    allResults.apps.forEach(item => {
      html += createItem(item, '⚡');
      allItems.push(item);
    });
    html += '</div>';
  }
  
  if (html) {
    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
    selectedIndex = 0;
    updateSelection();
    
    // Add click handlers
    document.querySelectorAll('.item').forEach((el, i) => {
      el.onclick = () => {
        selectedIndex = i;
        executeSelected();
      };
    });
  } else {
    resultsContainer.innerHTML = '<div class="empty" style="padding:40px;text-align:center;color:rgba(255,255,255,0.3)">No results found</div>';
    resultsContainer.classList.remove('hidden');
  }
}

function createItem(item, icon) {
  return `
    <div class="item">
      <div class="item-icon">${icon}</div>
      <div class="item-content">
        <div class="item-title">${item.title}</div>
        <div class="item-desc">${item.description || ''}</div>
      </div>
    </div>
  `;
}

function selectNext() {
  if (allItems.length === 0) return;
  selectedIndex = (selectedIndex + 1) % allItems.length;
  updateSelection();
}

function selectPrev() {
  if (allItems.length === 0) return;
  selectedIndex = selectedIndex <= 0 ? allItems.length - 1 : selectedIndex - 1;
  updateSelection();
}

function updateSelection() {
  document.querySelectorAll('.item').forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
    if (i === selectedIndex) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

async function executeSelected() {
  if (selectedIndex >= 0 && allItems[selectedIndex]) {
    await window.commandAPI.executeResult(allItems[selectedIndex]);
    window.commandAPI.hide();
  }
}