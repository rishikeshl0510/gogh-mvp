import React, { useState } from 'react';

export function ToolCallMessage({ toolName, args, result, query }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const formatJSON = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  };

  const extractResultText = (result) => {
    if (!result) return 'No result';
    if (result.content) {
      const content = Array.isArray(result.content) ? result.content : [result.content];
      return content.map(c => {
        if (typeof c === 'object' && c.text) return c.text;
        if (typeof c === 'string') return c;
        return formatJSON(c);
      }).join('\n');
    }
    return formatJSON(result);
  };

  return (
    <div style={{
      background: 'rgba(100, 200, 255, 0.05)',
      border: '1px solid rgba(100, 200, 255, 0.15)',
      borderRadius: '8px',
      marginBottom: '12px',
      overflow: 'hidden'
    }}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '10px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          background: 'rgba(100, 200, 255, 0.08)',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🔧</span>
          <span style={{ fontSize: '10px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' }}>
            Tool Call: {toolName}
          </span>
        </div>
        <div style={{
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.6)',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: '12px' }}>
          {/* User Query */}
          {query && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '8px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                fontWeight: '600'
              }}>
                🔍 Query
              </div>
              <div style={{
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.8)',
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '4px',
                fontFamily: 'monospace'
              }}>
                {query}
              </div>
            </div>
          )}

          {/* LLM Input (Arguments) */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              fontSize: '8px',
              color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              LLM Input
            </div>
            <div style={{
              fontSize: '9px',
              color: 'rgba(100, 200, 255, 0.9)',
              padding: '8px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {formatJSON(args)}
            </div>
          </div>

          {/* Server Output (Result) */}
          {result && (
            <div>
              <div style={{
                fontSize: '8px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                fontWeight: '600'
              }}>
                Server Output
              </div>
              <div style={{
                fontSize: '9px',
                color: 'rgba(150, 255, 150, 0.9)',
                padding: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '4px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {extractResultText(result)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
