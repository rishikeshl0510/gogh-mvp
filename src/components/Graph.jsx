import React, { useEffect, useRef, useState } from 'react';

export default function Graph() {
  const canvasRef = useRef(null);
  const nodesContainerRef = useRef(null);
  const [data, setData] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [lines, setLines] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const init = async () => {
      const fetchedData = await window.graphAPI.getData();
      setData(fetchedData);
      createGraph(fetchedData);
    };

    init();

    window.graphAPI.onDataUpdated(async () => {
      const updatedData = await window.graphAPI.getData();
      setData(updatedData);
      createGraph(updatedData);
    });

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    animate();
  }, [nodes, lines, offset, scale]);

  const createGraph = (fetchedData) => {
    const canvas = canvasRef.current;
    if (!canvas || !fetchedData) return;

    const intents = fetchedData.intents.filter(i => i.mode === fetchedData.currentMode);

    if (!intents.length) {
      nodesContainerRef.current.innerHTML = '<div class="empty-state">No intents yet. Create tasks from the panel to see them here.</div>';
      setLines([]);
      return;
    }

    nodesContainerRef.current.innerHTML = '';
    const newNodes = [];
    const newLines = [];

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radiusIntent = Math.min(canvas.width, canvas.height) * 0.3;

    intents.forEach((intent, i) => {
      const angle = (i / intents.length) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radiusIntent;
      const y = centerY + Math.sin(angle) * radiusIntent;

      const tasks = fetchedData.tasks.filter(t => t.intentId === intent.id);
      const completedTasks = tasks.filter(t => t.completed).length;

      const node = {
        id: intent.id,
        type: 'intent',
        x,
        y,
        title: intent.description,
        meta: `${tasks.length} tasks • ${completedTasks} completed`,
        element: null
      };

      const div = createNodeElement(node);
      node.element = div;
      newNodes.push(node);

      const radiusTask = 120;
      tasks.forEach((task, ti) => {
        const taskAngle = (ti / tasks.length) * Math.PI * 2;
        const taskX = x + Math.cos(taskAngle) * radiusTask;
        const taskY = y + Math.sin(taskAngle) * radiusTask;

        const taskNode = {
          id: task.id,
          type: 'task',
          x: taskX,
          y: taskY,
          title: task.title,
          meta: new Date(task.endDate).toLocaleDateString(),
          completed: task.completed,
          parentId: intent.id,
          element: null
        };

        const taskDiv = createNodeElement(taskNode);
        taskNode.element = taskDiv;
        newNodes.push(taskNode);
        newLines.push({ from: node, to: taskNode });
      });
    });

    setNodes(newNodes);
    setLines(newLines);
  };

  const createNodeElement = (config) => {
    const div = document.createElement('div');
    div.className = config.type === 'task' ? 'node node-task' : 'node';
    if (config.completed) div.classList.add('completed');

    if (config.type === 'intent') {
      div.innerHTML = `
        <div class="node-header">INTENT</div>
        <div class="node-title">${config.title}</div>
        <div class="node-meta">${config.meta}</div>
      `;
    } else {
      div.innerHTML = `
        <div class="node-task-title">${config.title}</div>
        <div class="node-task-meta">${config.meta}</div>
      `;
    }

    div.style.left = (config.x - 100) + 'px';
    div.style.top = (config.y - 50) + 'px';

    div.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        setIsDragging(true);
        setDraggedNode(config);
        e.preventDefault();
      }
    });

    nodesContainerRef.current.appendChild(div);
    return div;
  };

  const animate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    lines.forEach(line => {
      const { from, to } = line;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const controlPointOffset = distance * 0.3;
      const angle = Math.atan2(dy, dx);
      const perpAngle = angle + Math.PI / 2;

      const cpX = (from.x + to.x) / 2 + Math.cos(perpAngle) * controlPointOffset;
      const cpY = (from.y + to.y) / 2 + Math.sin(perpAngle) * controlPointOffset;

      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, 'rgba(100, 255, 150, 0.4)');
      gradient.addColorStop(0.5, 'rgba(100, 200, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 100, 200, 0.4)');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(100, 255, 150, 0.3)';

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);
      ctx.stroke();

      ctx.shadowBlur = 0;
    });

    ctx.restore();
  };

  const handleMouseMove = (e) => {
    if (isDragging && draggedNode) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / scale;
      const y = (e.clientY - rect.top - offset.y) / scale;

      draggedNode.x = x;
      draggedNode.y = y;

      if (draggedNode.element) {
        draggedNode.element.style.left = (x - 100) + 'px';
        draggedNode.element.style.top = (y - 50) + 'px';
      }

      animate();
    } else if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setOffset({ x: offset.x + dx, y: offset.y + dy });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNode(null);
    setIsPanning(false);
  };

  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.3, Math.min(3, scale * delta));
    setScale(newScale);
  };

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="graph-container">
      <div className="graph-header">
        <div className="graph-title">Intent Graph</div>
        <div className="close-btn" onClick={handleClose}>×</div>
      </div>
      <div 
        id="graphContent"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} id="canvas"></canvas>
        <div 
          ref={nodesContainerRef} 
          id="nodes"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0'
          }}
        ></div>
      </div>
      <div className="graph-info">
        Drag nodes • Middle-click/Shift+drag to pan • Scroll to zoom
      </div>
    </div>
  );
}

