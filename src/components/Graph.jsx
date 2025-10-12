import React, { useEffect, useState, useCallback, useRef } from 'react';

export default function FileGraphView({ data }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 150, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (data) {
      loadWorkspaces();
    }
  }, [data?.currentMode, data]);

  const loadWorkspaces = async () => {
    const ws = await window.panelAPI.getFileWorkspaces(data?.currentMode || 'default');
    setWorkspaces(ws || []);
  };

  const loadFolderContents = useCallback(async (folderPath) => {
    return await window.panelAPI.getFolderContents(folderPath) || [];
  }, []);

  const toggleNode = useCallback((nodePath) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodePath)) {
        newSet.delete(nodePath);
      } else {
        newSet.add(nodePath);
      }
      return newSet;
    });
  }, []);

  const handleNodeClick = useCallback((node, e) => {
    e.stopPropagation();
    if (node.isDirectory) {
      toggleNode(node.path);
    } else {
      window.panelAPI.openFile(node.path);
    }
    setSelectedNode(node.path);
  }, [toggleNode]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(2, prev * delta)));
  }, []);

  const handleMouseDown = useCallback((e) => {
    // Only start panning if clicking on the background, not on nodes
    if (e.button === 0 && !e.target.closest('.graph-node')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 150, y: 50 });
  }, []);

  if (workspaces.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: '11px'
      }}>
        No folders added. Add folders to see the graph.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(10, 10, 15, 0.5)',
        borderRadius: '8px',
        userSelect: 'none',
        cursor: isPanning ? 'grabbing' : 'grab'
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Controls */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        display: 'flex',
        gap: '4px',
        zIndex: 1000
      }}>
        <button onClick={() => setZoom(prev => Math.min(2, prev * 1.2))} style={btnStyle}>+</button>
        <button onClick={() => setZoom(prev => Math.max(0.3, prev * 0.8))} style={btnStyle}>−</button>
        <button onClick={resetView} style={btnStyle}>⟲</button>
      </div>

      {/* Graph content */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '200%',
          height: '200%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {workspaces.map((workspace, idx) => (
          <WorkspaceNode
            key={workspace.id}
            workspace={workspace}
            expandedNodes={expandedNodes}
            selectedNode={selectedNode}
            onNodeClick={handleNodeClick}
            loadFolderContents={loadFolderContents}
            yOffset={idx * 400}
          />
        ))}
      </div>

      {/* Info */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        fontSize: '8px',
        color: 'rgba(255, 255, 255, 0.4)',
        padding: '4px 8px',
        background: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: 1000
      }}>
        Click to expand • Drag to pan • Scroll to zoom
      </div>
    </div>
  );
}

function WorkspaceNode({ workspace, expandedNodes, selectedNode, onNodeClick, loadFolderContents, yOffset }) {
  const [children, setChildren] = useState([]);
  const isExpanded = expandedNodes.has(workspace.rootPath);

  useEffect(() => {
    if (isExpanded && children.length === 0) {
      loadFolderContents(workspace.rootPath).then(setChildren);
    }
  }, [isExpanded, workspace.rootPath, loadFolderContents, children.length]);

  // Separate folders and files
  const folders = children.filter(c => c.isDirectory);
  const files = children.filter(c => !c.isDirectory);

  return (
    <div style={{ position: 'absolute', top: yOffset, left: 50 }}>
      {/* Workspace Node */}
      <div style={{ marginBottom: '80px' }}>
        <Node
          node={{
            name: workspace.name,
            path: workspace.rootPath,
            isDirectory: true,
            type: 'workspace'
          }}
          isExpanded={isExpanded}
          isSelected={selectedNode === workspace.rootPath}
          onClick={onNodeClick}
        />
      </div>

      {isExpanded && (
        <>
          {/* Vertical line down from workspace */}
          <svg style={{ position: 'absolute', left: '90px', top: '52px', pointerEvents: 'none' }}>
            <line x1="0" y1="0" x2="0" y2="30" stroke="rgba(100, 150, 255, 0.5)" strokeWidth="2" />
          </svg>

          {/* Folders row */}
          {folders.length > 0 && (
            <>
              {/* Horizontal line connecting all folders */}
              <svg style={{
                position: 'absolute',
                left: folders.length > 1 ? '90px' : '90px',
                top: '82px',
                width: folders.length > 1 ? `${(folders.length - 1) * 250}px` : '1px',
                pointerEvents: 'none'
              }}>
                {folders.length > 1 && (
                  <line
                    x1="0"
                    y1="0"
                    x2={(folders.length - 1) * 250}
                    y2="0"
                    stroke="rgba(100, 150, 255, 0.5)"
                    strokeWidth="2"
                  />
                )}
              </svg>

              <div style={{ display: 'flex', gap: '70px', marginLeft: '0px', marginTop: '0px' }}>
                {folders.map((folder, idx) => (
                  <div key={folder.path} style={{ position: 'relative' }}>
                    {/* Vertical line to folder */}
                    <svg style={{ position: 'absolute', left: '90px', top: '-30px', pointerEvents: 'none' }}>
                      <line x1="0" y1="0" x2="0" y2="30" stroke="rgba(100, 150, 255, 0.5)" strokeWidth="2" />
                    </svg>

                    <TreeNode
                      node={folder}
                      expandedNodes={expandedNodes}
                      selectedNode={selectedNode}
                      onNodeClick={onNodeClick}
                      loadFolderContents={loadFolderContents}
                      depth={1}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Files row (leaf nodes) */}
          {files.length > 0 && (
            <>
              {/* Horizontal line connecting all files */}
              <svg style={{
                position: 'absolute',
                left: '90px',
                top: folders.length > 0 ? '350px' : '82px',
                width: files.length > 1 ? `${(files.length - 1) * 200}px` : '1px',
                pointerEvents: 'none'
              }}>
                {files.length > 1 && (
                  <line
                    x1="0"
                    y1="0"
                    x2={(files.length - 1) * 200}
                    y2="0"
                    stroke="rgba(100, 150, 255, 0.5)"
                    strokeWidth="2"
                  />
                )}
              </svg>

              <div style={{
                display: 'flex',
                gap: '20px',
                marginLeft: '0px',
                marginTop: folders.length > 0 ? '268px' : '0px'
              }}>
                {files.map((file, idx) => (
                  <div key={file.path} style={{ position: 'relative' }}>
                    {/* Vertical line to file */}
                    <svg style={{ position: 'absolute', left: '90px', top: '-30px', pointerEvents: 'none' }}>
                      <line x1="0" y1="0" x2="0" y2="30" stroke="rgba(100, 150, 255, 0.5)" strokeWidth="2" />
                    </svg>

                    <Node
                      node={file}
                      isExpanded={false}
                      isSelected={selectedNode === file.path}
                      onClick={onNodeClick}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function TreeNode({ node, expandedNodes, selectedNode, onNodeClick, loadFolderContents, depth }) {
  const [children, setChildren] = useState([]);
  const isExpanded = expandedNodes.has(node.path);

  useEffect(() => {
    if (isExpanded && node.isDirectory && children.length === 0) {
      loadFolderContents(node.path).then(setChildren);
    }
  }, [isExpanded, node.isDirectory, node.path, loadFolderContents, children.length]);

  if (depth > 3) return null;

  // Separate folders and files
  const folders = children.filter(c => c.isDirectory);
  const files = children.filter(c => !c.isDirectory);

  return (
    <div style={{ position: 'relative' }}>
      {/* Folder Node */}
      <div style={{ marginBottom: isExpanded ? '80px' : '0' }}>
        <Node
          node={node}
          isExpanded={isExpanded}
          isSelected={selectedNode === node.path}
          onClick={onNodeClick}
        />
      </div>

      {isExpanded && (
        <>
          {/* Vertical line down from folder */}
          <svg style={{ position: 'absolute', left: '90px', top: '52px', pointerEvents: 'none' }}>
            <line x1="0" y1="0" x2="0" y2="30" stroke="rgba(100, 150, 255, 0.4)" strokeWidth="2" />
          </svg>

          {/* Subfolders row */}
          {folders.length > 0 && (
            <>
              {/* Horizontal line connecting all subfolders */}
              <svg style={{
                position: 'absolute',
                left: folders.length > 1 ? '90px' : '90px',
                top: '82px',
                width: folders.length > 1 ? `${(folders.length - 1) * 250}px` : '1px',
                pointerEvents: 'none'
              }}>
                {folders.length > 1 && (
                  <line
                    x1="0"
                    y1="0"
                    x2={(folders.length - 1) * 250}
                    y2="0"
                    stroke="rgba(100, 150, 255, 0.4)"
                    strokeWidth="2"
                  />
                )}
              </svg>

              <div style={{ display: 'flex', gap: '70px', position: 'absolute', top: '82px' }}>
                {folders.map((folder, idx) => (
                  <div key={folder.path} style={{ position: 'relative' }}>
                    {/* Vertical line to subfolder */}
                    <svg style={{ position: 'absolute', left: '90px', top: '-30px', pointerEvents: 'none' }}>
                      <line x1="0" y1="0" x2="0" y2="30" stroke="rgba(100, 150, 255, 0.4)" strokeWidth="2" />
                    </svg>

                    <TreeNode
                      node={folder}
                      expandedNodes={expandedNodes}
                      selectedNode={selectedNode}
                      onNodeClick={onNodeClick}
                      loadFolderContents={loadFolderContents}
                      depth={depth + 1}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Files row (leaf nodes) */}
          {files.length > 0 && (
            <>
              {/* Horizontal line connecting all files */}
              <svg style={{
                position: 'absolute',
                left: '90px',
                top: folders.length > 0 ? '350px' : '82px',
                width: files.length > 1 ? `${(files.length - 1) * 200}px` : '1px',
                pointerEvents: 'none'
              }}>
                {files.length > 1 && (
                  <line
                    x1="0"
                    y1="0"
                    x2={(files.length - 1) * 200}
                    y2="0"
                    stroke="rgba(100, 150, 255, 0.4)"
                    strokeWidth="2"
                  />
                )}
              </svg>

              <div style={{
                display: 'flex',
                gap: '20px',
                position: 'absolute',
                top: folders.length > 0 ? '350px' : '82px'
              }}>
                {files.map((file, idx) => (
                  <div key={file.path} style={{ position: 'relative' }}>
                    {/* Vertical line to file */}
                    <svg style={{ position: 'absolute', left: '90px', top: '-30px', pointerEvents: 'none' }}>
                      <line x1="0" y1="0" x2="0" y2="30" stroke="rgba(100, 150, 255, 0.4)" strokeWidth="2" />
                    </svg>

                    <Node
                      node={file}
                      isExpanded={false}
                      isSelected={selectedNode === file.path}
                      onClick={onNodeClick}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Node({ node, isExpanded, isSelected, onClick }) {
  const isWorkspace = node.type === 'workspace';

  return (
    <div
      className="graph-node"
      onClick={(e) => onClick(node, e)}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        padding: '12px 16px',
        minWidth: '160px',
        maxWidth: '180px',
        background: isSelected
          ? 'rgba(100, 200, 255, 0.25)'
          : isWorkspace
          ? 'rgba(100, 150, 255, 0.15)'
          : 'rgba(255, 255, 255, 0.06)',
        border: `2px solid ${isSelected ? 'rgba(100, 200, 255, 0.7)' : isWorkspace ? 'rgba(100, 150, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: isSelected ? '0 0 20px rgba(100, 200, 255, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'all'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = isWorkspace ? 'rgba(100, 150, 255, 0.25)' : 'rgba(255, 255, 255, 0.12)';
          e.currentTarget.style.borderColor = 'rgba(100, 200, 255, 0.6)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(100, 150, 255, 0.3)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = isWorkspace ? 'rgba(100, 150, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)';
          e.currentTarget.style.borderColor = isWorkspace ? 'rgba(100, 150, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
        }
      }}
    >
      {/* Icon and expand indicator row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        {/* Icon */}
        {node.isDirectory ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isWorkspace ? 'rgba(100, 200, 255, 0.95)' : 'rgba(150, 200, 255, 0.85)'} strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(150, 200, 255, 0.75)" strokeWidth="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
        )}

        {/* Expand indicator */}
        {node.isDirectory && (
          <div style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: 'rgba(150, 200, 255, 0.8)',
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </div>
        )}
      </div>

      {/* Text content */}
      <div style={{ width: '100%' }}>
        <div style={{
          fontSize: isWorkspace ? '12px' : '10px',
          fontWeight: isWorkspace ? '600' : '500',
          color: 'rgba(255, 255, 255, 0.95)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center'
        }}>
          {node.name}
        </div>
        {node.tags && node.tags.length > 0 && (
          <div style={{
            fontSize: '8px',
            color: 'rgba(100, 200, 255, 0.7)',
            marginTop: '4px',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {node.tags.slice(0, 2).join(' • ')}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  width: '32px',
  height: '32px',
  background: 'rgba(100, 150, 255, 0.15)',
  border: '1px solid rgba(100, 150, 255, 0.4)',
  borderRadius: '8px',
  color: 'rgba(255, 255, 255, 0.9)',
  fontSize: '18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s',
  fontWeight: '600',
  backdropFilter: 'blur(8px)'
};
