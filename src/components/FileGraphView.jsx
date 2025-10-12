import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

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

    // Create directory nodes
    dirs.forEach((dir, index) => {
      const dirName = dir.split(/[\\\/]/).pop() || 'Root';
      nodes.push({
        id: `dir-${index}`,
        type: 'default',
        data: {
          label: (
            <div style={{ padding: '8px' }}>
              <div style={{ fontWeight: '600', fontSize: '10px', marginBottom: '4px' }}>
                📁 {dirName}
              </div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.6)' }}>
                {filesByDir[dir].length} files
              </div>
            </div>
          )
        },
        position: {
          x: (index % 3) * 250,
          y: Math.floor(index / 3) * 150
        },
        style: {
          background: 'rgba(100, 100, 255, 0.1)',
          border: '1px solid rgba(100, 100, 255, 0.3)',
          borderRadius: '8px',
          padding: 0,
          width: 180,
        },
      });
    });

    // Create file nodes
    let fileIndex = 0;
    dirs.forEach((dir, dirIndex) => {
      filesByDir[dir].forEach((file, fIndex) => {
        const ext = file.name.substring(file.name.lastIndexOf('.'));
        nodes.push({
          id: `file-${file.id}`,
          type: 'default',
          data: {
            label: (
              <div style={{ fontSize: '9px', padding: '4px 8px' }}>
                {file.name}
              </div>
            )
          },
          position: {
            x: (dirIndex % 3) * 250 + (fIndex * 60) - 40,
            y: Math.floor(dirIndex / 3) * 150 + 80
          },
          style: {
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            padding: 0,
            width: 120,
            fontSize: '9px',
          },
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

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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
    <div style={{ width: '100%', height: '500px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-left"
        style={{ background: 'transparent' }}
      >
        <Background color="rgba(255, 255, 255, 0.1)" gap={16} />
        <Controls
          style={{
            button: {
              background: 'rgba(50, 50, 50, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white'
            }
          }}
        />
        <MiniMap
          nodeColor={() => 'rgba(100, 150, 255, 0.3)'}
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        />
      </ReactFlow>
    </div>
  );
}
