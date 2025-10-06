const input = document.getElementById('input');
const list = document.getElementById('list');
let commands = [];
let selected = -1;

input.focus();

input.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  if (!query) {
    list.classList.add('hidden');
    return;
  }
  
  commands = [
    {
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      title: 'AI: ' + query,
      desc: 'Ask AI about this...'
    },
    {
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      title: 'Copy: ' + query,
      desc: 'Copy to clipboard'
    },
    {
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
      title: 'Search Web',
      desc: 'Google: ' + query
    }
  ];
  
  showCommands();
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selected = (selected + 1) % commands.length;
    updateSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selected = selected <= 0 ? commands.length - 1 : selected - 1;
    updateSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    execute();
  } else if (e.key === 'Escape') {
    window.commandAPI.hide();
  }
});

function showCommands() {
  list.innerHTML = '';
  commands.forEach((cmd, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div class="item-icon">${cmd.icon}</div>
      <div class="item-content">
        <div class="item-title">${cmd.title}</div>
        <div class="item-desc">${cmd.desc}</div>
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

function updateSelection() {
  document.querySelectorAll('.item').forEach((el, i) => {
    el.classList.toggle('selected', i === selected);
  });
}

function execute() {
  console.log('Execute:', commands[selected]);
  window.commandAPI.hide();
}