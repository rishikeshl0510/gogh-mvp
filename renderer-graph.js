const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

let data = null;
let nodes = [];
let edges = [];
let selectedNode = null;
let connectFrom = null;
let isDragging = false;
let draggedNode = null;
let mouseX = 0;
let mouseY = 0;

function resizeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

async function init() {
  data = await window.graphAPI.getData();
  createGraph();
  animate();
  
  window.graphAPI.onDataUpdated(async () => {
    data = await window.graphAPI.getData();
    createGraph();
  });
}

function createGraph() {
  nodes = [];
  edges = [];
  
  const allItems = [
    ...data.files.map(f => ({ ...f, type: 'file', label: f.name })),
    ...data.tasks.map(t => ({ ...t, type: 'task', label: t.title })),
    ...data.bookmarks.map(b => ({ ...b, type: 'bookmark', label: b.name || b.url }))
  ];
  
  allItems.forEach((item, i) => {
    const angle = (i / allItems.length) * Math.PI * 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.3;
    
    nodes.push({
      id: item.id,
      x: canvas.width / 2 + Math.cos(angle) * radius,
      y: canvas.height / 2 + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      radius: 15,
      type: item.type,
      label: (item.label || 'Node').substring(0, 20)
    });
  });
  
  data.connections.forEach(conn => {
    const source = nodes.find(n => n.id === conn.from);
    const target = nodes.find(n => n.id === conn.to);
    if (source && target) {
      edges.push({ source, target, id: conn.id });
    }
  });
}

function applyForces() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  nodes.forEach(node => {
    // Center force
    node.vx += (centerX - node.x) * 0.0005;
    node.vy += (centerY - node.y) * 0.0005;
    
    // Repulsion
    nodes.forEach(other => {
      if (node === other) return;
      const dx = other.x - node.x;
      const dy = other.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 150) {
        const force = (150 - dist) / dist * 0.3;
        node.vx -= dx * force;
        node.vy -= dy * force;
      }
    });
    
    // Edge attraction
    edges.forEach(edge => {
      if (edge.source === node) {
        const dx = edge.target.x - node.x;
        const dy = edge.target.y - node.y;
        node.vx += dx * 0.005;
        node.vy += dy * 0.005;
      }
      if (edge.target === node) {
        const dx = edge.source.x - node.x;
        const dy = edge.source.y - node.y;
        node.vx += dx * 0.005;
        node.vy += dy * 0.005;
      }
    });
    
    // Apply velocity
    node.x += node.vx;
    node.y += node.vy;
    node.vx *= 0.85;
    node.vy *= 0.85;
    
    // Bounds
    node.x = Math.max(node.radius, Math.min(canvas.width - node.radius, node.x));
    node.y = Math.max(node.radius, Math.min(canvas.height - node.radius, node.y));
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw edges
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  edges.forEach(edge => {
    if (edge.source && edge.target) {
      ctx.beginPath();
      ctx.moveTo(edge.source.x, edge.source.y);
      ctx.lineTo(edge.target.x, edge.target.y);
      ctx.stroke();
    }
  });
  
  // Draw connection line
  if (connectFrom) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(connectFrom.x, connectFrom.y);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // Draw nodes
  nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    
    const colors = {
      file: 'rgba(100, 150, 255, 0.7)',
      task: 'rgba(100, 255, 150, 0.7)',
      bookmark: 'rgba(255, 150, 100, 0.7)'
    };
    
    ctx.fillStyle = colors[node.type] || 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
    
    ctx.strokeStyle = node === selectedNode ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = node === selectedNode ? 2 : 1;
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + node.radius + 10);
  });
}

function animate() {
  applyForces();
  draw();
  requestAnimationFrame(animate);
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  
  if (isDragging && draggedNode) {
    draggedNode.x = mouseX;
    draggedNode.y = mouseY;
    draggedNode.vx = 0;
    draggedNode.vy = 0;
  }
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  draggedNode = nodes.find(node => {
    const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
    return dist < node.radius;
  });
  
  if (draggedNode) {
    selectedNode = draggedNode;
    isDragging = true;
  }
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
  draggedNode = null;
});

canvas.addEventListener('dblclick', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const node = nodes.find(n => {
    const dist = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
    return dist < n.radius;
  });
  
  if (node) {
    if (!connectFrom) {
      connectFrom = node;
    } else if (connectFrom !== node) {
      window.graphAPI.addConnection({
        id: Date.now(),
        from: connectFrom.id,
        to: node.id
      });
      connectFrom = null;
    } else {
      connectFrom = null;
    }
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  edges.forEach((edge, i) => {
    const midX = (edge.source.x + edge.target.x) / 2;
    const midY = (edge.source.y + edge.target.y) / 2;
    const dist = Math.sqrt((midX - x) ** 2 + (midY - y) ** 2);
    
    if (dist < 10) {
      window.graphAPI.removeConnection(edge.id);
    }
  });
});

init();