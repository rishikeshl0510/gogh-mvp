import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const onConnect = (params) => console.log('handle onConnect', params);

function DragHandleNode({ data, dragHandle }) {
  return (
    <div style={{
      padding: '10px',
      background: 'rgba(20, 20, 30, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      minWidth: '150px'
    }}>
      <Handle
        type="target"
        position={Position.Left}
        onConnect={onConnect}
        style={{
          background: 'rgba(100, 150, 255, 0.8)',
          width: '10px',
          height: '10px'
        }}
      />

      <div className="drag-handle__label">
        {/* The drag handle element */}
        <button
          className={dragHandle || "drag-handle__custom-button"}
          style={{
            padding: '6px 12px',
            fontSize: '11px',
            cursor: 'grab',
            background: 'rgba(76, 175, 80, 0.8)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '6px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ⋮⋮ {data?.label || 'Drag Me'}
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'rgba(100, 150, 255, 0.8)',
          width: '10px',
          height: '10px'
        }}
      />
    </div>
  );
}

export default memo(DragHandleNode);
