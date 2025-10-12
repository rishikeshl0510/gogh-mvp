import React, { useState, useEffect } from 'react';

export default function FileTreeView({ data }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderContents, setFolderContents] = useState({});
  const [composerEnabled, setComposerEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [tagging, setTagging] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [aiDialog, setAiDialog] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    loadWorkspaces();
    setComposerEnabled(data.composerSettings?.enabled || false);
  }, [data.currentMode]);

  const loadWorkspaces = async () => {
    const ws = await window.panelAPI.getFileWorkspaces(data.currentMode);
    setWorkspaces(ws || []);
  };

  const addFolder = async () => {
    const result = await window.panelAPI.selectFolder();
    if (result) {
      await window.panelAPI.addFileWorkspace({
        id: Date.now(),
        rootPath: result,
        name: result.split(/[\\\/]/).pop(),
        mode: data.currentMode,
        addedAt: new Date().toISOString(),
        files: []
      });
      loadWorkspaces();
      if (composerEnabled) {
        await tagWorkspaceFiles(result);
      }
    }
  };

  const toggleComposer = async () => {
    if (composerEnabled) {
      // Disable composer
      setComposerEnabled(false);
      await window.panelAPI.enableComposer(false);
    } else {
      // Show confirmation dialog before enabling
      setConfirmDialog({
        title: 'Enable AI Composer',
        message: `AI Composer will automatically tag all files in your workspaces with relevant labels.

This will:
- Analyze all files using AI (${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''})
- Generate tags based on file type, name, and metadata
- Store tags in the database for searching

Do you want to enable AI Composer?`,
        onConfirm: async () => {
          setConfirmDialog(null);
          setComposerEnabled(true);
          await window.panelAPI.enableComposer(true);
          // Auto-tag all workspace files
          await tagAllWorkspaces();
        },
        onCancel: () => {
          setConfirmDialog(null);
        }
      });
    }
  };

  const tagAllWorkspaces = async () => {
    setTagging(true);
    for (const workspace of workspaces) {
      const contents = await window.panelAPI.getFolderContents(workspace.rootPath);
      const files = contents.filter(c => !c.isDirectory);

      for (const file of files.slice(0, 20)) { // Limit to 20 files per workspace
        try {
          const tags = await window.panelAPI.tagFileWithAI(file.path);
          await window.panelAPI.updateFileTags(file.path, tags);
        } catch (e) {
          console.error('Tag error:', e);
        }
      }
    }
    setTagging(false);
    loadWorkspaces();
  };

  const tagWorkspaceFiles = async (rootPath) => {
    setTagging(true);
    const contents = await window.panelAPI.getFolderContents(rootPath);
    const files = contents.filter(c => !c.isDirectory);
    for (const file of files.slice(0, 10)) {
      try {
        const tags = await window.panelAPI.tagFileWithAI(file.path);
        await window.panelAPI.updateFileTags(file.path, tags);
      } catch (e) {
        console.error('Tag error:', e);
      }
    }
    setTagging(false);
    loadWorkspaces();
  };

  const searchFiles = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await window.panelAPI.semanticFileSearch(searchQuery);
    setSearchResults(results || []);
  };

  const toggleFolder = async (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
      if (!folderContents[folderPath]) {
        const contents = await window.panelAPI.getFolderContents(folderPath);
        setFolderContents(prev => ({ ...prev, [folderPath]: contents }));
      }
    }
    setExpandedFolders(newExpanded);
  };

  const expandAll = async () => {
    const allFolders = new Set();
    for (const ws of workspaces) {
      allFolders.add(ws.rootPath);
      const contents = await window.panelAPI.getFolderContents(ws.rootPath);
      setFolderContents(prev => ({ ...prev, [ws.rootPath]: contents }));
    }
    setExpandedFolders(allFolders);
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const removeWorkspace = async (id) => {
    await window.panelAPI.removeFileWorkspace(id);
    loadWorkspaces();
  };

  const openFile = async (filePath) => {
    await window.panelAPI.openFile(filePath);
  };

  const handleRightClick = (e, item) => {
    e.preventDefault();

    // Calculate position with bounds checking
    const menuWidth = 200;
    const menuHeight = 240;
    let x = e.clientX;
    let y = e.clientY;

    // Prevent menu from going off-screen
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({ x, y, item });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleContextAction = async (action) => {
    if (!contextMenu) return;
    const { item } = contextMenu;

    switch(action) {
      case 'readWithAI':
        if (item.isDirectory) return;
        setAiDialog({ title: 'AI Summary', content: '', file: item.name, loading: true });
        const summary = await window.panelAPI.readFileWithAI(item.path);
        setAiDialog({ title: 'AI Summary', content: summary, file: item.name, loading: false });
        break;
      case 'addToAI':
        await window.panelAPI.addFileToAI(item.path);
        break;
      case 'copyPath':
        navigator.clipboard.writeText(item.path);
        break;
      case 'showInFolder':
        await window.panelAPI.showInFolder(item.path);
        break;
      case 'properties':
        const props = await window.panelAPI.getFileProperties(item.path);
        alert(JSON.stringify(props, null, 2));
        break;
      case 'tagWithAI':
        setTagging(true);
        closeContextMenu();
        try {
          const tags = await window.panelAPI.tagFileWithAI(item.path);
          await window.panelAPI.updateFileTags(item.path, tags);
          // Reload folder contents to show new tags
          const currentExpanded = new Set(expandedFolders);
          setFolderContents({});
          await loadWorkspaces();

          // Reload all expanded folders
          for (const folderPath of currentExpanded) {
            const contents = await window.panelAPI.getFolderContents(folderPath);
            setFolderContents(prev => ({ ...prev, [folderPath]: contents }));
          }
          setExpandedFolders(currentExpanded);
        } catch (e) {
          console.error('Tagging error:', e);
        }
        setTagging(false);
        return;
    }
    closeContextMenu();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(10, 10, 15, 0.5)', borderRadius: '8px', padding: '8px' }} onClick={closeContextMenu}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        <button onClick={addFolder} style={iconBtnStyle} title="Add Folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/>
            <line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
        </button>
        <button onClick={expandAll} style={iconBtnStyle} title="Expand All">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <button onClick={collapseAll} style={iconBtnStyle} title="Collapse All">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <button
          onClick={toggleComposer}
          title="AI Composer"
          style={{
            ...iconBtnStyle,
            background: composerEnabled ? 'rgba(100, 255, 150, 0.3)' : iconBtnStyle.background,
            boxShadow: composerEnabled ? '0 0 10px rgba(100, 255, 150, 0.5)' : 'none'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
          </svg>
        </button>
      </div>

      <input
        type="text"
        placeholder="Search files..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && searchFiles()}
        style={{
          marginBottom: '6px',
          padding: '8px 10px',
          fontSize: '11px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '6px',
          color: 'rgba(255, 255, 255, 0.9)',
          outline: 'none'
        }}
      />

      {tagging && <div style={{ fontSize: '9px', color: 'rgba(100, 255, 150, 0.9)', padding: '4px' }}>AI Tagging...</div>}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {searchQuery && searchResults.length > 0 ? (
          searchResults.map((file, idx) => (
            <div key={idx} onClick={() => openFile(file.path)} onContextMenu={(e) => handleRightClick(e, file)} style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', marginBottom: '4px', borderRadius: '4px', cursor: 'pointer', minHeight: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(150, 200, 255, 0.7)" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              <span style={{ fontSize: '10px', flex: 1, color: 'rgba(255, 255, 255, 0.9)' }}>{file.name}</span>
              {file.tags && <span style={{ fontSize: '8px', color: 'rgba(100, 200, 255, 0.8)' }}>{file.tags.join(', ')}</span>}
            </div>
          ))
        ) : searchQuery ? (
          <div className="empty">No files found</div>
        ) : (
          workspaces.map(ws => (
            <WorkspaceNode
              key={ws.id}
              workspace={ws}
              expanded={expandedFolders}
              contents={folderContents}
              onToggle={toggleFolder}
              onRemove={removeWorkspace}
              onOpenFile={openFile}
              onRightClick={handleRightClick}
            />
          ))
        )}
        {workspaces.length === 0 && !searchQuery && <div className="empty">No folders added</div>}
      </div>

      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'rgba(20, 20, 25, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '4px',
            zIndex: 10000,
            minWidth: '160px',
            backdropFilter: 'blur(20px)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.item.isDirectory && (
            <>
              <ContextMenuItem onClick={() => handleContextAction('readWithAI')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Read with AI
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleContextAction('addToAI')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                </svg>
                Add to AI
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleContextAction('tagWithAI')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Tag with AI
              </ContextMenuItem>
              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }}></div>
            </>
          )}
          <ContextMenuItem onClick={() => handleContextAction('copyPath')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy Path
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleContextAction('showInFolder')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Show in Folder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleContextAction('properties')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Properties
          </ContextMenuItem>
        </div>
      )}

      {aiDialog && (
        <AIDialog
          title={aiDialog.title}
          content={aiDialog.content}
          file={aiDialog.file}
          loading={aiDialog.loading}
          onClose={() => setAiDialog(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}
    </div>
  );
}

function AIDialog({ title, content, file, onClose, loading }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown renderer for code blocks
  const renderMarkdown = (text) => {
    if (!text) return '';

    // Code blocks with language
    let html = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div style="margin: 12px 0; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; overflow: hidden;">
        <div style="padding: 6px 10px; background: rgba(255, 255, 255, 0.05); font-size: 9px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase;">${lang || 'code'}</div>
        <pre style="margin: 0; padding: 12px; overflow-x: auto; font-size: 10px; line-height: 1.6; color: rgba(255, 255, 255, 0.9);"><code>${escapedCode.trim()}</code></pre>
      </div>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="padding: 2px 6px; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 3px; font-size: 10px; color: rgba(255, 255, 255, 0.95);">$1</code>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Line breaks
    html = html.replace(/\n/g, '<br/>');

    return html;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '500px',
          maxHeight: '70vh',
          background: 'rgba(20, 20, 25, 0.95)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.95)', marginBottom: '4px' }}>
              {title}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>
              {file}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={copyToClipboard}
              title="Copy to clipboard"
              style={{
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={onClose}
              style={{
                width: '28px',
                height: '28px',
                background: 'rgba(255, 80, 80, 0.15)',
                border: '1px solid rgba(255, 80, 80, 0.25)',
                borderRadius: '6px',
                color: 'rgba(255, 80, 80, 0.9)',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 80, 80, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(255, 80, 80, 0.4)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 80, 80, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(255, 80, 80, 0.25)';
                e.currentTarget.style.color = 'rgba(255, 80, 80, 0.9)';
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          fontSize: '11px',
          lineHeight: '1.7',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(100, 200, 255, 0.2)',
                borderTop: '3px solid rgba(100, 200, 255, 0.8)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>Processing file with AI...</div>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '450px',
          background: 'rgba(20, 20, 25, 0.95)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.95)' }}>
            {title}
          </div>
        </div>

        <div style={{
          padding: '20px',
          fontSize: '11px',
          lineHeight: '1.7',
          color: 'rgba(255, 255, 255, 0.8)',
          whiteSpace: 'pre-line'
        }}>
          {message}
        </div>

        <div style={{
          padding: '16px 20px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontWeight: '600'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              background: 'rgba(100, 255, 150, 0.2)',
              border: '1px solid rgba(100, 255, 150, 0.4)',
              borderRadius: '8px',
              color: 'rgba(100, 255, 150, 0.95)',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontWeight: '600'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(100, 255, 150, 0.3)';
              e.currentTarget.style.borderColor = 'rgba(100, 255, 150, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(100, 255, 150, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(100, 255, 150, 0.4)';
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextMenuItem({ onClick, children }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        fontSize: '10px',
        cursor: 'pointer',
        borderRadius: '4px',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'rgba(255, 255, 255, 0.9)'
      }}
      onClick={onClick}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </div>
  );
}

function WorkspaceNode({ workspace, expanded, contents, onToggle, onRemove, onOpenFile, onRightClick }) {
  const [subExpanded, setSubExpanded] = useState(new Set());
  const isExpanded = expanded.has(workspace.rootPath);
  const items = contents[workspace.rootPath] || [];

  const toggleSubFolder = async (folderPath) => {
    const newExpanded = new Set(subExpanded);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setSubExpanded(newExpanded);
  };

  return (
    <div style={{ marginBottom: '8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', padding: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', minHeight: '36px' }}>
        <span onClick={() => onToggle(workspace.rootPath)} style={{ fontSize: '11px', color: 'rgba(150, 200, 255, 0.8)', minWidth: '16px' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(150, 200, 255, 0.8)" strokeWidth="2" onClick={() => onToggle(workspace.rootPath)}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span style={{ flex: 1, fontSize: '11px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.95)' }} onClick={() => onToggle(workspace.rootPath)}>
          {workspace.name}
        </span>
        <button onClick={() => onRemove(workspace.id)} style={{ background: 'none', border: 'none', color: 'rgba(255, 100, 100, 0.7)', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>×</button>
      </div>

      {isExpanded && (
        <div style={{ paddingLeft: '20px', marginTop: '4px' }}>
          {items.map((item, idx) => (
            <FileOrFolderItem
              key={idx}
              item={item}
              subExpanded={subExpanded}
              toggleSubFolder={toggleSubFolder}
              onOpenFile={onOpenFile}
              onRightClick={onRightClick}
            />
          ))}
          {items.length === 0 && <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', padding: '6px' }}>Empty folder</div>}
        </div>
      )}
    </div>
  );
}

function FileOrFolderItem({ item, subExpanded, toggleSubFolder, onOpenFile, onRightClick }) {
  const [subItems, setSubItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const isExpanded = subExpanded.has(item.path);

  const handleToggle = async () => {
    if (item.isDirectory) {
      toggleSubFolder(item.path);
      if (!isExpanded && subItems.length === 0) {
        const contents = await window.panelAPI.getFolderContents(item.path);
        setSubItems(contents || []);
      }
    }
  };

  const handleDragStart = (e) => {
    setIsDragging(true);
    // Set the file path as text data
    e.dataTransfer.setData('text/plain', item.path);
    e.dataTransfer.setData('text/uri-list', `file:///${item.path.replace(/\\/g, '/')}`);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{
          padding: '8px 10px',
          fontSize: '10px',
          borderRadius: '4px',
          marginBottom: '3px',
          background: isDragging ? 'rgba(100, 200, 255, 0.25)' : 'rgba(255, 255, 255, 0.03)',
          cursor: isDragging ? 'grabbing' : 'pointer',
          transition: 'all 0.2s',
          color: 'rgba(255, 255, 255, 0.9)',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: isDragging ? 0.5 : 1
        }}
        onClick={() => item.isDirectory ? handleToggle() : onOpenFile(item.path)}
        onContextMenu={(e) => onRightClick(e, item)}
        onMouseEnter={(e) => !isDragging && (e.currentTarget.style.background = 'rgba(100, 150, 255, 0.15)')}
        onMouseLeave={(e) => !isDragging && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
      >
        {item.isDirectory && (
          <span style={{ fontSize: '10px', color: 'rgba(150, 200, 255, 0.7)', minWidth: '12px' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {item.isDirectory ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(150, 200, 255, 0.7)" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(150, 200, 255, 0.7)" strokeWidth="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
        )}
        <span style={{ flex: 1 }}>{item.name}</span>
        {item.tags && item.tags.length > 0 && (
          <span style={{ fontSize: '8px', color: 'rgba(100, 200, 255, 0.8)', padding: '2px 6px', background: 'rgba(100, 200, 255, 0.1)', borderRadius: '3px' }}>
            {item.tags.join(', ')}
          </span>
        )}
      </div>
      {isExpanded && item.isDirectory && (
        <div style={{ paddingLeft: '20px', marginTop: '2px', marginBottom: '4px' }}>
          {subItems.map((subItem, idx) => (
            <FileOrFolderItem
              key={idx}
              item={subItem}
              subExpanded={subExpanded}
              toggleSubFolder={toggleSubFolder}
              onOpenFile={onOpenFile}
              onRightClick={onRightClick}
            />
          ))}
          {subItems.length === 0 && <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', padding: '6px' }}>Empty</div>}
        </div>
      )}
    </>
  );
}

const iconBtnStyle = {
  background: 'rgba(100, 150, 255, 0.15)',
  border: '1px solid rgba(100, 150, 255, 0.3)',
  borderRadius: '4px',
  padding: '4px 8px',
  cursor: 'pointer',
  color: 'rgba(255, 255, 255, 0.9)',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
