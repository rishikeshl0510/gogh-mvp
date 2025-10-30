import React, { useState, useCallback, memo } from 'react';
import { Handle, Position } from '@xyflow/react';

// Custom File Node with advanced features
const CustomFileNode = memo(({ data, id, isConnectable = true }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDragStart = useCallback((evt) => {
    evt.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDelete = useCallback((evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    console.log(`Delete node: ${id}, label: ${data.label}`);
    // Deletion is handled by the parent component, not here
  }, [id, data.label]);

  const handleOpen = useCallback((evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (data.path && window.panelAPI) {
      window.panelAPI.openFile(data.path);
    }
  }, [data.path]);

  const isDirectory = data.isDirectory || false;
  const fileColor = isDirectory ? 'rgba(100, 150, 255, 0.9)' : 'rgba(150, 200, 255, 0.9)';
  const bgColor = isDirectory ? 'rgba(100, 100, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)';
  const borderColor = isDirectory ? 'rgba(100, 100, 255, 0.4)' : 'rgba(255, 255, 255, 0.25)';

  return (
    <div
      className="custom-file-node"
      style={{
        background: isHovered ? 'rgba(100, 150, 255, 0.2)' : bgColor,
        border: `2px solid ${isHovered ? 'rgba(100, 150, 255, 0.6)' : borderColor}`,
        borderRadius: isDirectory ? '10px' : '6px',
        padding: isDirectory ? '12px' : '8px 12px',
        minWidth: isDirectory ? '180px' : '140px',
        maxWidth: '220px',
        boxShadow: isDragging
          ? '0 8px 24px rgba(0, 0, 0, 0.5)'
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: isDragging ? 'grabbing' : 'grab',
        transform: isDragging ? 'scale(1.05)' : 'scale(1)',
        position: 'relative'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{
          background: fileColor,
          width: isDirectory ? '12px' : '8px',
          height: isDirectory ? '12px' : '8px',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      />

      {/* Drag Handle */}
      <div
        className="drag-handle__custom"
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          cursor: 'grab',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={fileColor} strokeWidth="2">
          <circle cx="12" cy="5" r="1" fill={fileColor} />
          <circle cx="12" cy="12" r="1" fill={fileColor} />
          <circle cx="12" cy="19" r="1" fill={fileColor} />
          <circle cx="5" cy="5" r="1" fill={fileColor} />
          <circle cx="5" cy="12" r="1" fill={fileColor} />
          <circle cx="5" cy="19" r="1" fill={fileColor} />
          <circle cx="19" cy="5" r="1" fill={fileColor} />
          <circle cx="19" cy="12" r="1" fill={fileColor} />
          <circle cx="19" cy="19" r="1" fill={fileColor} />
        </svg>
      </div>

      {/* Main Content */}
      <div style={{ paddingLeft: isHovered ? '24px' : '0', transition: 'padding 0.2s' }}>
        {isDirectory && (
          <div style={{
            fontWeight: '700',
            fontSize: '11px',
            marginBottom: '6px',
            color: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            📁 {data.label}
          </div>
        )}

        {isDirectory && (
          <div style={{
            fontSize: '9px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: '600',
            marginBottom: '4px'
          }}>
            {data.fileCount || 0} files
          </div>
        )}

        {!isDirectory && (
          <div
            onClick={handleOpen}
            style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.95)',
              fontWeight: '500',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = fileColor}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)'}
          >
            📄 {data.label}
          </div>
        )}

        {/* Actions */}
        {isHovered && (
          <div style={{
            display: 'flex',
            gap: '4px',
            marginTop: '6px',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {!isDirectory && (
              <button
                onClick={handleOpen}
                style={{
                  padding: '4px 8px',
                  fontSize: '8px',
                  background: 'rgba(100, 200, 255, 0.2)',
                  border: '1px solid rgba(100, 200, 255, 0.4)',
                  borderRadius: '4px',
                  color: fileColor,
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(100, 200, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(100, 200, 255, 0.2)';
                }}
              >
                Open
              </button>
            )}
            <button
              onClick={handleDelete}
              style={{
                padding: '4px 8px',
                fontSize: '8px',
                background: 'rgba(255, 100, 100, 0.2)',
                border: '1px solid rgba(255, 100, 100, 0.4)',
                borderRadius: '4px',
                color: 'rgba(255, 150, 150, 0.9)',
                cursor: 'pointer',
                fontWeight: '600',
                marginLeft: 'auto',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 100, 100, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 100, 100, 0.2)';
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{
          background: fileColor,
          width: isDirectory ? '12px' : '8px',
          height: isDirectory ? '12px' : '8px',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      />
    </div>
  );
});

CustomFileNode.displayName = 'CustomFileNode';

export default CustomFileNode;
