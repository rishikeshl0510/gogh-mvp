import React from 'react';

export function MessageInput({
  value,
  onChange,
  isGenerating = false,
  stop = null,
  allowAttachments = false,
  files = null,
  setFiles = null
}) {
  return (
    <div className="message-input-container">
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={isGenerating ? 'Generating...' : 'Message...'}
        disabled={isGenerating}
        className="message-input crt-input"
      />
      <button
        type="submit"
        disabled={!value.trim() || isGenerating}
        className="message-submit crt-send-btn"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  );
}
