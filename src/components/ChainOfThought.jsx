import React from 'react';

export default function ChainOfThought({ thoughts }) {
  const getThoughtColor = (type) => {
    switch (type) {
      case 'thinking':
        return 'rgba(100, 150, 255, 0.8)';
      case 'tool_check':
        return 'rgba(150, 100, 255, 0.8)';
      case 'tool_call':
        return 'rgba(255, 200, 100, 0.8)';
      case 'tool_result':
        return 'rgba(100, 255, 150, 0.8)';
      case 'reasoning':
        return 'rgba(255, 150, 200, 0.8)';
      case 'analyzing':
        return 'rgba(100, 255, 255, 0.8)';
      case 'error':
        return 'rgba(255, 100, 100, 0.8)';
      default:
        return 'rgba(200, 200, 200, 0.8)';
    }
  };

  if (!thoughts || thoughts.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.15)',
        borderRadius: '8px',
        fontSize: '9px',
        color: 'rgba(255, 255, 255, 0.7)'
      }}
    >
      {thoughts.map((thought, index) => (
        <React.Fragment key={index}>
          {/* Small Dot */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title={thought.content}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getThoughtColor(thought.type),
                boxShadow: `0 0 6px ${getThoughtColor(thought.type)}`,
                flexShrink: 0
              }}
            />
            <span
              style={{
                fontSize: '8px',
                color: 'rgba(255, 255, 255, 0.6)',
                whiteSpace: 'nowrap',
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {thought.content}
            </span>
          </div>

          {/* Thin Connecting Line */}
          {index < thoughts.length - 1 && (
            <div
              style={{
                width: '16px',
                height: '1px',
                background: 'rgba(255, 255, 255, 0.2)',
                flexShrink: 0
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
