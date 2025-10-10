import React, { useEffect, useRef, useState } from 'react';

export default function Graph() {
  const canvasRef = useRef(null);
  const nodesContainerRef = useRef(null);
  const [data, setData] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [lines, setLines] = useState([]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const animationFrame = useRef(null);

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
      createMindmap(fetchedData);
    };

    init();

    window.graphAPI.onDataUpdated(async () => {
      const updatedData = await window.graphAPI.getData();
      setData(updatedData);
      createMindmap(updatedData);
    });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    animate();
  }, [nodes, lines, offset, scale]);

  const createMindmap = (fetchedData) => {
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

    // Create center node (root)
    const centerNode = {
      id: 'center',
      type: 'center',
      x: centerX,
      y: centerY,
      title: 'My Intents',
      element: null
    };

    const centerDiv = createNodeElement(centerNode);
    centerNode.element = centerDiv;
    newNodes.push(centerNode);

    // Auto-layout algorithm for better spacing
    const totalIntents = intents.length;
    const totalTasks = intents.reduce((sum, intent) => {
      return sum + fetchedData.tasks.filter(t => t.intentId === intent.id).length;
    }, 0);

    // Calculate optimal spacing based on content
    const baseRadius = Math.min(canvas.width, canvas.height) * 0.15;
    const intentRadius = Math.max(baseRadius, totalIntents * 20);
    const taskRadius = Math.max(80, totalTasks * 8);

    // Distribute intents in a circle
    intents.forEach((intent, i) => {
      const angle = (i / totalIntents) * Math.PI * 2 - Math.PI / 2;
      const intentX = centerX + Math.cos(angle) * intentRadius;
      const intentY = centerY + Math.sin(angle) * intentRadius;

      const tasks = fetchedData.tasks.filter(t => t.intentId === intent.id);
      const completedCount = tasks.filter(t => t.completed).length;

      const intentNode = {
        id: intent.id,
        type: 'intent',
        x: intentX,
        y: intentY,
        title: intent.description,
        meta: `${tasks.length} tasks • ${completedCount} done`,
        angle: angle,
        element: null
      };

      const intentDiv = createNodeElement(intentNode);
      intentNode.element = intentDiv;
      newNodes.push(intentNode);
      newLines.push({ from: centerNode, to: intentNode });

      // Auto-layout tasks around each intent
      if (tasks.length > 0) {
        const taskAngleStep = Math.PI * 2 / Math.max(tasks.length, 1);
        const taskStartAngle = angle - Math.PI / 4;
        
        tasks.forEach((task, ti) => {
          const taskAngle = taskStartAngle + (ti * taskAngleStep);
          const taskX = intentX + Math.cos(taskAngle) * taskRadius;
          const taskY = intentY + Math.sin(taskAngle) * taskRadius;

          const taskNode = {
            id: task.id,
            type: 'task',
            x: taskX,
            y: taskY,
            title: task.title,
            completed: task.completed,
            parentId: intent.id,
            element: null
          };

          const taskDiv = createNodeElement(taskNode);
          taskNode.element = taskDiv;
          newNodes.push(taskNode);
          newLines.push({ from: intentNode, to: taskNode });
        });
      }
    });

    setNodes(newNodes);
    setLines(newLines);
  };

  const createNodeElement = (config) => {
    const div = document.createElement('div');
    
    if (config.type === 'center') {
      div.className = 'node node-center';
      div.innerHTML = `<div class="node-title">${config.title}</div>`;
    } else if (config.type === 'intent') {
      div.className = 'node node-intent';
      div.innerHTML = `
        <div class="node-title">${config.title}</div>
        <div class="node-meta">${config.meta}</div>
      `;
    } else {
      div.className = 'node node-task';
      if (config.completed) div.classList.add('completed');
      div.innerHTML = `<div class="node-task-title">${config.title}</div>`;
    }

    div.style.left = (config.x - 100) + 'px';
    div.style.top = (config.y - 40) + 'px';

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

    // Draw slime-like connections
    lines.forEach((line, index) => {
      const { from, to } = line;
      
      const time = Date.now() / 1000;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Multiple control points for slime effect
      const numSegments = Math.floor(distance / 40);
      const points = [from];
      
      for (let i = 1; i < numSegments; i++) {
        const t = i / numSegments;
        const wobble = Math.sin(time * 2 + index + i) * 15;
        const perpAngle = angle + Math.PI / 2;
        points.push({
          x: from.x + dx * t + Math.cos(perpAngle) * wobble,
          y: from.y + dy * t + Math.sin(perpAngle) * wobble
        });
      }
      points.push(to);

      // Draw thick slime base
      ctx.strokeStyle = `rgba(100, 255, 200, 0.15)`;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.quadraticCurveTo(points[points.length - 1].x, points[points.length - 1].y, to.x, to.y);
      ctx.stroke();

      // Draw animated slime core
      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, `rgba(100, 255, 200, 0.6)`);
      gradient.addColorStop(0.5, `rgba(150, 200, 255, 0.8)`);
      gradient.addColorStop(1, `rgba(200, 150, 255, 0.6)`);
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.quadraticCurveTo(points[points.length - 1].x, points[points.length - 1].y, to.x, to.y);
      ctx.stroke();

      // Animated slime blobs
      for (let i = 0; i < 3; i++) {
        const blobPos = (time * 0.2 + index * 0.3 + i * 0.33) % 1;
        const segmentIdx = Math.floor(blobPos * (points.length - 1));
        const segmentT = (blobPos * (points.length - 1)) % 1;
        
        if (segmentIdx < points.length - 1) {
          const p1 = points[segmentIdx];
          const p2 = points[segmentIdx + 1];
          const bx = p1.x + (p2.x - p1.x) * segmentT;
          const by = p1.y + (p2.y - p1.y) * segmentT;
          
          const blobGradient = ctx.createRadialGradient(bx, by, 0, bx, by, 8);
          blobGradient.addColorStop(0, 'rgba(200, 255, 255, 0.9)');
          blobGradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
          
          ctx.fillStyle = blobGradient;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(bx, by, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;
    });

    ctx.restore();

    animationFrame.current = requestAnimationFrame(animate);
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setOffset({ x: offset.x + dx, y: offset.y + dy });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseDown = (e) => {
    if (e.button === 0 && e.shiftKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, scale * delta));
    setScale(newScale);
  };

  const handleClose = () => {
    window.close();
  };

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomIn = () => {
    setScale(prev => Math.min(5, prev * 1.2));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(0.1, prev / 1.2));
  };

  const autoLayout = () => {
    if (!data) return;
    // Reset to center view
    resetView();
    // Force recreate with optimal spacing
    setTimeout(() => {
      createMindmap(data);
    }, 100);
  };

  return (
    <div className="graph-container">
      <div className="graph-header">
        <div className="graph-title">Intent Mindmap</div>
        <div className="graph-controls">
          <button className="control-btn" onClick={autoLayout} title="Auto Layout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <button className="control-btn" onClick={zoomOut} title="Zoom Out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <button className="control-btn" onClick={resetView} title="Reset View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <circle cx="11" cy="11" r="3"/>
            </svg>
          </button>
          <button className="control-btn" onClick={zoomIn} title="Zoom In">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <div className="zoom-indicator">{Math.round(scale * 100)}%</div>
        </div>
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
        Shift+drag to pan • Scroll to zoom
      </div>
    </div>
  );
}
