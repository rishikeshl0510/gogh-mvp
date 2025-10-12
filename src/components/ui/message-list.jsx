import React, { useState } from 'react';
import ChainOfThought from '../ChainOfThought';
import { ToolCallMessage } from '../ToolCallMessage';

// Simple markdown renderer for code blocks and formatting
function renderMarkdown(text) {
  if (!text) return '';

  // Code blocks with language
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="code-block"><div class="code-header"><span class="code-lang">${lang || 'code'}</span><button class="copy-code-btn" data-code="${escapedCode}">Copy</button></div><pre><code>${escapedCode.trim()}</code></pre></div>`;
  });

  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Line breaks
  text = text.replace(/\n/g, '<br/>');

  return text;
}

export function MessageList({ messages = [], isTyping = false, onEditMessage, onRetryMessage }) {
  const [copiedId, setCopiedId] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [exportDropdownId, setExportDropdownId] = useState(null);

  const copyToClipboard = (content, id) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDoubleClick = (message) => {
    if (message.role === 'user') {
      setEditingId(message.id);
      setEditContent(message.content);
    }
  };

  const handleEditSave = (id) => {
    if (onEditMessage && editContent.trim()) {
      onEditMessage(id, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleExport = async (content, id, format) => {
    setExportingId(id);
    setExportDropdownId(null);
    await window.panelAPI.exportResponse(content, format);
    setExportingId(null);
  };

  const toggleExportDropdown = (id) => {
    setExportDropdownId(exportDropdownId === id ? null : id);
  };

  // Handle code block copy buttons
  React.useEffect(() => {
    const handleCodeCopy = (e) => {
      if (e.target.classList.contains('copy-code-btn')) {
        const code = e.target.getAttribute('data-code').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        navigator.clipboard.writeText(code);
        e.target.textContent = 'Copied!';
        setTimeout(() => {
          e.target.textContent = 'Copy';
        }, 2000);
      }
    };

    document.addEventListener('click', handleCodeCopy);
    return () => document.removeEventListener('click', handleCodeCopy);
  }, []);

  return (
    <>
      {messages.map((message, index) => {
        if (message.role === 'thinking') {
          return (
            <div key={message.id || index} className="qa-block thinking-block">
              <div className="thinking-crt">
                <div className="crt-scanline"></div>
                <div className="crt-text">
                  <span className="crt-cursor">▋</span>
                  <span className="crt-thinking-text">Processing</span>
                  <span className="crt-dots">
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                  </span>
                </div>
              </div>
            </div>
          );
        }

        if (message.role === 'user') {
          if (editingId === message.id) {
            return (
              <div key={message.id || index} className="qa-block user-block editing">
                <div className="qa-content">
                  <input
                    type="text"
                    className="edit-input"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(message.id);
                      if (e.key === 'Escape') handleEditCancel();
                    }}
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button className="edit-btn save" onClick={() => handleEditSave(message.id)}>✓</button>
                    <button className="edit-btn cancel" onClick={handleEditCancel}>✕</button>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div
              key={message.id || index}
              className="qa-block user-block"
            >
              <div className="qa-content">
                {message.content}
                <div className="qa-actions">
                  <button
                    className="qa-action-btn"
                    onClick={() => handleDoubleClick(message)}
                    title="Edit message"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={message.id || index} className="qa-block assistant-block">
            <div className="qa-content">
              {message.thoughts && message.thoughts.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <ChainOfThought thoughts={message.thoughts} />
                </div>
              )}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  {message.toolCalls.map((toolCall, idx) => (
                    <ToolCallMessage
                      key={idx}
                      toolName={toolCall.toolName}
                      args={toolCall.args}
                      result={toolCall.result}
                      query={toolCall.query}
                    />
                  ))}
                </div>
              )}
              <div
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
              />
              <div className="qa-actions">
                <button
                  className="qa-action-btn"
                  onClick={() => onRetryMessage && onRetryMessage(message.id)}
                  title="Retry generation"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                </button>
                <button
                  className="qa-action-btn"
                  onClick={() => copyToClipboard(message.content, message.id)}
                  title="Copy to clipboard"
                >
                  {copiedId === message.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
                <div className="export-dropdown-wrapper">
                  <button
                    className="qa-action-btn"
                    onClick={() => toggleExportDropdown(message.id)}
                    title="Export"
                    disabled={exportingId === message.id}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </button>
                  {exportDropdownId === message.id && (
                    <div className="export-dropdown">
                      <button
                        className="export-option"
                        onClick={() => handleExport(message.content, message.id, 'md')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>Markdown (.md)</span>
                      </button>
                      <button
                        className="export-option"
                        onClick={() => handleExport(message.content, message.id, 'docx')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>Word (.docx)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {isTyping && (
        <div className="qa-block assistant-block">
          <div className="qa-content">
            <div className="typing-indicator">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
