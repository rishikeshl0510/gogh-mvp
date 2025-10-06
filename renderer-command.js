const input = document.getElementById('input');
input.focus();
input.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.commandAPI.hide(); });