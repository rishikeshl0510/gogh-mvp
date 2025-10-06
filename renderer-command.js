const input = document.getElementById('input');
const list = document.getElementById('list');
const loading = document.getElementById('loading');
let results = [];
let selected = -1;
let searchTimer = null;

input.focus();

input.addEventListener('input', async (e) => {
  const query = e.target.value.trim();
  
  if (!query) {
    list.classList.add('hidden');
    loading.classList.add('hidden');
    return;
  }
  
  // Show loading
  list.classList.add('hidden');
  loading.classList.remove('hidden');
  
  // Debounce search
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    results = await window.commandAPI.searchLocal(query);
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
    execute();
  } else if (e.key === 'Escape') {
    window.commandAPI.hide();
  }
});

function showResults() {
  loading.classList.add('hidden');
  
  if (!results.length) {
    list.classList.add('hidden');
    return;
  }
  
  list.innerHTML = '';
  results.forEach((result, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div class="item-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          ${result.isDirectory ? 
            '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' :
            '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>'
          }
        </svg>
      </div>
      <div class="item-content">
        <div class="item-title">${result.name}</div>
        <div class="item-desc">${result.path}</div>
      </div>
    `;
    item.onclick = () => {
      selected = i;
      execute();
    };
    list.appendChild(item);
  });
  
  list.classList.remove('hidden');
  selected = 0;
  updateSelection();
}

function selectNext() {
  if (!results.length) return;
  selected = (selected + 1) % results.length;
  updateSelection();
}

function selectPrev() {
  if (!results.length) return;
  selected = selected <= 0 ? results.length - 1 : selected - 1;
  updateSelection();
}

function updateSelection() {
  document.querySelectorAll('.item').forEach((el, i) => {
    el.classList.toggle('selected', i === selected);
  });
}

async function execute() {
  if (selected >= 0 && results[selected]) {
    await window.commandAPI.openFile(results[selected].path);
    window.commandAPI.hide();
  }
}