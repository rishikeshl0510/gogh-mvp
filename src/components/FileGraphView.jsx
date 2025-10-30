import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomFileNode from './CustomFileNode';

const nodeTypes = {
  customFile: CustomFileNode,
};

export default function FileGraphView({ data, searchQuery }) {
  const appExtensions = ['.exe', '.lnk', '.app', '.dmg'];

  // Filter files
  const files = data.files.filter(f => {
    if (f.mode !== data.currentMode) return false;
    const ext = f.name.toLowerCase().substring(f.name.lastIndexOf('.'));
    if (appExtensions.includes(ext)) return false;
    if (searchQuery && searchQuery.trim()) {
      return f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             (f.path && f.path.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return true;
  });

  // Group files by directory
  const filesByDir = useMemo(() => {
    const groups = {};
    files.forEach(file => {
      if (!file.path) return;
      const dir = file.path.substring(0, file.path.lastIndexOf(/[\\\/]/.exec(file.path)?.[0] || '/'));
      if (!groups[dir]) groups[dir] = [];
      groups[dir].push(file);
    });
    return groups;
  }, [files]);

  // Create nodes and edges
  const initialNodes = useMemo(() => {
    const nodes = [];
    const dirs = Object.keys(filesByDir);

    // Create directory nodes with enhanced custom type
    dirs.forEach((dir, index) => {
      const dirName = dir.split(/[\\\/]/).pop() || 'Root';
      nodes.push({
        id: `dir-${index}`,
        type: 'customFile',
        data: {
          label: dirName,
          fileCount: filesByDir[dir].length,
          isDirectory: true,
          path: dir
        },
        position: {
          x: (index % 3) * 280,
          y: Math.floor(index / 3) * 220
        },
        draggable: true,
      });
    });

    // Create file nodes with enhanced custom type
    let fileIndex = 0;
    dirs.forEach((dir, dirIndex) => {
      filesByDir[dir].forEach((file, fIndex) => {
        nodes.push({
          id: `file-${file.id}`,
          type: 'customFile',
          data: {
            label: file.name,
            path: file.path,
            isDirectory: false
          },
          position: {
            x: (dirIndex % 3) * 280 + (fIndex * 75) - 60,
            y: Math.floor(dirIndex / 3) * 220 + 130
          },
          draggable: true,
        });
        fileIndex++;
      });
    });

    return nodes;
  }, [filesByDir]);

  // Create edges connecting directories to files
  const initialEdges = useMemo(() => {
    const edges = [];
    const dirs = Object.keys(filesByDir);

    dirs.forEach((dir, dirIndex) => {
      filesByDir[dir].forEach((file) => {
        edges.push({
          id: `edge-dir${dirIndex}-file${file.id}`,
          source: `dir-${dirIndex}`,
          target: `file-${file.id}`,
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: 'rgba(100, 150, 255, 0.3)',
            strokeWidth: 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'rgba(100, 150, 255, 0.3)',
            width: 15,
            height: 15,
          },
        });
      });
    });

    return edges;
  }, [filesByDir]);

  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  // Update nodes and edges when initialNodes/initialEdges change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onNodeClick = useCallback((event, node) => {
    // Find file and open it
    const fileId = node.id.replace('file-', '');
    const file = files.find(f => f.id == fileId);
    if (file && file.path) {
      window.panelAPI.openFile(file.path);
    }
  }, [files]);

  if (!files.length) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: '10px'
      }}>
        No files to display
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '400px',
      background: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '8px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: 'rgba(100, 150, 255, 0.6)' },
          animated: true
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="rgba(255, 255, 255, 0.15)"
          gap={20}
          size={1}
          variant="dots"
        />
        <Controls
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          style={{
            button: {
              backgroundColor: 'rgba(50, 50, 60, 0.9)',
              color: 'white',
              borderColor: 'rgba(255, 255, 255, 0.2)'
            }
          }}
        />
        <MiniMap
          nodeColor={(node) => {
            if (node.id.startsWith('dir-')) return 'rgba(100, 100, 255, 0.6)';
            return 'rgba(150, 200, 255, 0.5)';
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        />
      </ReactFlow>
    </div>
  );
}
