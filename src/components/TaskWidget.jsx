import React, { useState, useEffect, useRef } from 'react';

export default function TaskWidget({ task, onUpdate, position, zIndex }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [pos, setPos] = useState(position || { x: 100, y: 100 });
  const [size, setSize] = useState({ width: 280, height: 200 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(task.description || '');
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, selectedText: '' });
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const widgetRef = useRef(null);
  const textareaRef = useRef(null);

  // Check if task is due now
  const isDueNow = () => {
    if (!task.dueDate) return true; // Show if no due date

    const now = new Date();
    const dueDate = new Date(task.dueDate);

    // Show if within 15 minutes of due time
    const diff = dueDate - now;
    return diff <= 15 * 60 * 1000 && diff >= -30 * 60 * 1000; // 15 min before to 30 min after
  };

  const [isVisible, setIsVisible] = useState(isDueNow());

  // Check visibility every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(isDueNow());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [task.dueDate]);

  if (!isVisible) return null;

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    } else if (isResizing) {
      const rect = widgetRef.current.getBoundingClientRect();
      setSize({
        width: Math.max(200, e.clientX - rect.left),
        height: Math.max(150, e.clientY - rect.top)
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset]);

  const handleComplete = async () => {
    // Use the proper API to toggle the task
    await window.panelAPI.toggleTask(task.id);
  };

  const handleColorChange = (newColor) => {
    onUpdate({ ...task, color: newColor });
  };

  const handleDescriptionClick = (e) => {
    e.stopPropagation();
    setIsEditingDescription(true);
    setEditedDescription(task.description || '');
  };

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
    if (editedDescription !== task.description) {
      onUpdate({ ...task, description: editedDescription });
    }
  };

  const handleDescriptionKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditingDescription(false);
      setEditedDescription(task.description || '');
    }
  };

  useEffect(() => {
    if (isEditingDescription && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editedDescription.length, editedDescription.length);
    }
  }, [isEditingDescription]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu({ visible: false, x: 0, y: 0, selectedText: '' });
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);

    if (selectedText) {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        selectedText: selectedText,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd
      });
    }
  };

  const handleAiAction = async (action) => {
    setContextMenu({ visible: false, x: 0, y: 0, selectedText: '' });
    setIsAiProcessing(true);

    try {
      let prompt = '';
      const selectedText = contextMenu.selectedText;

      switch (action) {
        case 'improve':
          prompt = `Improve this text: "${selectedText}"`;
          break;
        case 'expand':
          prompt = `Expand on this idea with more detail: "${selectedText}"`;
          break;
        case 'summarize':
          prompt = `Summarize this text concisely: "${selectedText}"`;
          break;
        case 'fix':
          prompt = `Fix grammar and spelling: "${selectedText}"`;
          break;
      }

      const response = await window.panelAPI.chatWithOllama(prompt);

      // Replace selected text with AI response
      const before = editedDescription.substring(0, contextMenu.selectionStart);
      const after = editedDescription.substring(contextMenu.selectionEnd);
      const newDescription = before + response + after;

      setEditedDescription(newDescription);
      onUpdate({ ...task, description: newDescription });
    } catch (error) {
      alert(`AI processing failed: ${error.message}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div
      ref={widgetRef}
      className="widget"
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        background: 'rgba(20, 20, 25, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '16px',
        backdropFilter: 'blur(40px) saturate(180%)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
        zIndex: zIndex || 1000,
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        opacity: task.done ? 0.5 : 1,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        className="widget-header"
        onMouseDown={handleMouseDown}
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'move',
          background: 'rgba(255, 255, 255, 0.12)',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#9333EA'].map(color => (
            <div
              key={color}
              onClick={(e) => {
                e.stopPropagation();
                handleColorChange(color);
              }}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: color,
                cursor: 'pointer',
                border: task.color === color ? '2px solid rgba(255, 255, 255, 0.9)' : '2px solid rgba(255, 255, 255, 0.2)',
                transition: 'all 0.15s',
                boxShadow: task.color === color ? '0 0 12px rgba(255, 255, 255, 0.6)' : 'none'
              }}
            />
          ))}
        </div>
        <div style={{
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.85)',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '1.5px'
        }}>
          {task.routinePattern || 'TASK'}
        </div>
      </div>

      {/* Task content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h3 style={{
          fontSize: '13px',
          fontWeight: '600',
          color: 'white',
          marginBottom: '10px',
          textDecoration: task.done ? 'line-through' : 'none',
          letterSpacing: '0.3px'
        }}>
          {task.title}
        </h3>
        {isEditingDescription ? (
          <>
            <textarea
              ref={textareaRef}
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              onKeyDown={handleDescriptionKeyDown}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={handleContextMenu}
              disabled={isAiProcessing}
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.95)',
                lineHeight: '1.5',
                marginBottom: '12px',
                flex: 1,
                background: isAiProcessing ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '10px',
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
                opacity: isAiProcessing ? 0.6 : 1
              }}
            />
            {isAiProcessing && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                fontSize: '12px',
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '8px 16px',
                borderRadius: '8px'
              }}>
                🤖 AI processing...
              </div>
            )}
          </>
        ) : (
          <p
            onClick={handleDescriptionClick}
            style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: '1.5',
              marginBottom: '12px',
              flex: 1,
              cursor: 'text',
              padding: '10px',
              borderRadius: '8px',
              minHeight: '40px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.08)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.05)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            {task.description || 'Click to add notes...'}
          </p>
        )}
        <div style={{
          fontSize: '9px',
          color: 'rgba(255, 255, 255, 0.6)',
          padding: '6px 10px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          letterSpacing: '0.3px'
        }}>
          📅 {new Date(task.dueDate).toLocaleString()}
        </div>
      </div>

      {/* Complete button */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255, 255, 255, 0.15)' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          style={{
            width: '100%',
            padding: '9px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '6px',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '10px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.15s',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.12)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.target.style.color = 'rgba(255, 255, 255, 0.95)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.08)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            e.target.style.color = 'rgba(255, 255, 255, 0.85)';
          }}
        >
          ✓ Mark Complete
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="resize-handle"
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsResizing(true);
        }}
        style={{
          position: 'absolute',
          bottom: '0',
          right: '0',
          width: '16px',
          height: '16px',
          cursor: 'nwse-resize',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '0 0 12px 0',
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.2)';
        }}
      />

      {/* AI Context Menu */}
      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            background: 'rgba(20, 20, 25, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '4px',
            zIndex: 10000,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', padding: '4px 8px', fontWeight: '600' }}>
            🤖 AI ACTIONS
          </div>
          {[
            { action: 'improve', label: '✨ Improve' },
            { action: 'expand', label: '📝 Expand' },
            { action: 'summarize', label: '📋 Summarize' },
            { action: 'fix', label: '🔧 Fix Grammar' }
          ].map(({ action, label }) => (
            <button
              key={action}
              onClick={(e) => {
                e.stopPropagation();
                handleAiAction(action);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '11px',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
