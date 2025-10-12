import React, { useRef } from 'react';

export function MessageInput({
  value,
  onChange,
  isGenerating = false,
  stop = null,
  allowAttachments = true,
  files = null,
  setFiles = null,
  onStop = null
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleTextareaChange = (e) => {
    onChange(e);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && setFiles) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index) => {
    if (setFiles && files) {
      setFiles(files.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="message-input-container">
      {files && files.length > 0 && (
        <div className="attached-files">
          {files.map((file, idx) => (
            <div key={idx} className="attached-file">
              <span>{file.name}</span>
              <button onClick={() => removeFile(idx)} className="remove-file-btn">×</button>
            </div>
          ))}
        </div>
      )}
      <div className="input-row">
        {allowAttachments && (
          <>
            <button
              type="button"
              onClick={handleAttachClick}
              className="attach-btn"
              title="Attach files"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              style={{ display: 'none' }}
            />
          </>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          placeholder={isGenerating ? 'Generating...' : 'Message...'}
          disabled={isGenerating}
          className="message-input crt-input"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (value.trim() && !isGenerating) {
                e.target.form?.requestSubmit();
              }
            }
          }}
        />
        {isGenerating && onStop ? (
          <button
            type="button"
            onClick={onStop}
            className="message-stop crt-stop-btn"
            style={{
              padding: '10px 14px',
              background: 'rgba(255, 100, 100, 0.2)',
              border: '1px solid rgba(255, 100, 100, 0.4)',
              borderRadius: '10px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim() || isGenerating}
            className="message-submit crt-send-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
