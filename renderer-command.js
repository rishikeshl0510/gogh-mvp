const input = document.getElementById('input');
const resultsContainer = document.getElementById('results');
const loading = document.getElementById('loading');

let currentSearchType = 'local';
let allResults = [];
let selectedIndex = -1;
let searchTimer = null;

input.focus();

function switchSearchType(type) {
  currentSearchType = type;
  document.querySelectorAll('.search-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.type === type);
  });
  
  if (input.value.trim()) {
    performSearch(input.value.trim());
  }
}

input.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  
  if (!query) {
    resultsContainer.classList.add('hidden');
    loading.classList.add('hidden');
    return;
  }
  
  resultsContainer.classList.add('hidden');
  loading.classList.remove('hidden');
  
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    performSearch(query);
  }, 300);
});

async function performSearch(query) {
  try {
    allResults = [];
    
    if (currentSearchType === 'local') {
      const localResults = await window.commandAPI.searchLocal(query);
      allResults = [...localResults.files, ...localResults.apps];
    } else if (currentSearchType === 'ai') {
      allResults = await window.commandAPI.searchAI(query);
    } else if (currentSearchType === 'google') {
      allResults = await window.commandAPI.searchGoogle(query);
    }
    
    showResults();
  } catch (error) {
    console.error('Search error:', error);
    loading.classList.add('hidden');
  }
}

function showResults() {
  loading.classList.add('hidden');
  
  if (!allResults || allResults.length === 0) {
    resultsContainer.innerHTML = '<div class="loading">No results found</div>';
    resultsContainer.classList.remove('hidden');
    return;
  }
  
  let html = '';
  allResults.forEach((item, i) => {
    const icons = {
      'ai': '🤖',
      'web': '🌐',
      'file': '📄',
      'folder': '📁',
      'app': '⚡'
    };
    const icon = icons[item.type] || '📄';
    
    html += `
      <div class="item" data-index="${i}">
        <div class="item-icon">${icon}</div>
        <div class="item-content">
          <div class="item-title">${item.title}</div>
          <div class="item-desc">${item.description || ''}</div>
        </div>
      </div>
    `;
  });
  
  resultsContainer.innerHTML = html;
  resultsContainer.classList.remove('hidden');
  selectedIndex = 0;
  updateSelection();
  
  document.querySelectorAll('.item').forEach((el, i) => {
    el.onclick = () => {
      selectedIndex = i;
      executeSelected();
    };
  });
}

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

function selectNext() {
  if (allResults.length === 0) return;
  selectedIndex = (selectedIndex + 1) % allResults.length;
  updateSelection();
}

function selectPrev() {
  if (allResults.length === 0) return;
  selectedIndex = selectedIndex <= 0 ? allResults.length - 1 : selectedIndex - 1;
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
  if (selectedIndex >= 0 && allResults[selectedIndex]) {
    await window.commandAPI.executeResult(allResults[selectedIndex]);
    window.commandAPI.hide();
  }
}