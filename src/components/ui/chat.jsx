import React, { useRef, useEffect } from 'react';

export function ChatContainer({ children, className = '' }) {
  return (
    <div className={`chat-container ${className}`}>
      {children}
    </div>
  );
}

export function ChatMessages({ children }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [children]);

  return (
    <div ref={scrollRef} className="chat-messages">
      {children}
    </div>
  );
}

export function ChatForm({ children, isPending, handleSubmit, className = '' }) {
  const onSubmit = (e) => {
    e.preventDefault();
    if (!isPending) {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={onSubmit} className={`chat-form ${className}`}>
      {typeof children === 'function'
        ? children({ files: null, setFiles: () => {} })
        : children
      }
    </form>
  );
}

export function PromptSuggestions({ suggestions = [], append }) {
  return (
    <div className="prompt-suggestions">
      <h3 className="suggestions-title">Try asking:</h3>
      <div className="suggestions-grid">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            type="button"
            className="suggestion-button"
            onClick={() => append({ role: 'user', content: suggestion })}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
