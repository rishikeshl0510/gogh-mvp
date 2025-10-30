# Advanced File Management System Implementation Plan

## Overview
Transform the current file management system into a comprehensive, intelligent file workspace with tree views, AI-powered tagging, semantic search, Google Drive integration, and contextual operations.

---

## 1. App Search Issues

### Current Problems
- **262 apps found but search not working**: The app caching system stores apps but the Panel AppsTab component isn't properly connected to the cached apps
- **Search input position**: Search bar has unwanted gap above it
- **No filter applied**: The search logic filters `data.apps` (saved apps) instead of `installedApps` (cached apps)

### Fixes Required
- Move search input to the very top of AppsTab (remove gap)
- Update `searchResults` to use cached apps directly from IPC call
- Ensure `getInstalledApps` IPC handler returns the cached apps array

---

## 2. Tree View File Browser Component

### New Component: `FileTreeView.jsx`
Create a hierarchical folder browser with:

#### Features
- **Tree structure**: Collapsible/expandable folders
- **Drag & drop folders**: Drop a folder to add it to the workspace
- **Persist folder paths**: Store folder roots in DB
- **Lazy loading**: Only load folder contents when expanded
- **Visual hierarchy**: Indented tree with folder icons
- **Controls**:
  - Expand All
  - Collapse All
  - Remove Folder (from tree, not disk)
  - Refresh

#### Database Schema Addition
```json
{
  "fileWorkspaces": [
    {
      "id": "timestamp",
      "rootPath": "/path/to/folder",
      "name": "Project Name",
      "expanded": ["path1", "path2"], // Track expanded folders
      "mode": "default",
      "addedAt": "ISO date"
    }
  ]
}
```

#### UI Layout
```
┌─────────────────────────────────────┐
│  [+] Add Folder  [Expand] [Collapse]│
├─────────────────────────────────────┤
│ ▼ 📁 Project Name                   │
│   ▶ 📁 src                          │
│   ▼ 📁 docs                         │
│     📄 README.md                    │
│     📄 guide.pdf                    │
│   ▶ 📁 tests                        │
└─────────────────────────────────────┘
```

---

## 3. AI-Powered Auto-Tagging System

### Composer Agent
Create an intelligent tagging agent that:

#### Features
- **Enable/Disable button**: Toggle auto-tagging via "Composer" button
- **File analysis**: Use local LLM (Ollama llama3.2:1b) to analyze:
  - File name
  - File extension
  - File size
  - Date modified
  - Parent folder context
- **Smart categorization**: Generate tags like:
  - `work`, `personal`, `project-x`
  - `documentation`, `code`, `media`, `archive`
  - `urgent`, `reference`, `draft`
- **Batch processing**: Queue files and process in background
- **Tag suggestions**: Show suggested tags before applying

#### Database Schema Addition
```json
{
  "fileWorkspaces": [
    {
      "id": "...",
      "files": [
        {
          "path": "/path/to/file.txt",
          "tags": ["work", "documentation", "project-alpha"],
          "aiGenerated": true,
          "lastTagged": "ISO date"
        }
      ]
    }
  ],
  "composerEnabled": false
}
```

#### Tagging Prompt Template
```
Analyze this file and suggest 2-4 relevant tags:
File: {fileName}
Extension: {ext}
Size: {size}
Parent folder: {parentFolder}
Date modified: {date}

Suggest tags from these categories:
- Work type: documentation, code, media, data, config
- Project: project-name, client-name
- Priority: urgent, important, reference, archive
- Status: draft, final, review

Return JSON: {"tags": ["tag1", "tag2", "tag3"]}
```

---

## 4. Semantic Search for Files

### Natural Language File Search
Implement semantic search that understands queries like:
- "Show me recent work documents"
- "Find PDFs about AI"
- "Images from last week"

#### Implementation
1. **Index files** with metadata (name, path, tags, size, date)
2. **Parse natural language** using Ollama:
   - Extract intent: search, filter, sort
   - Extract filters: file type, date range, tags, keywords
   - Extract sort: newest, oldest, largest, alphabetical
3. **Apply filters** to file workspace
4. **Return ranked results**

#### Search Query Parsing
```javascript
Query: "show me recent pdf files about meetings"
Parsed: {
  fileType: "pdf",
  keywords: ["meetings"],
  timeRange: "recent", // last 7 days
  sort: "newest"
}
```

---

## 5. Google Drive Integration

### Features
- **OAuth authentication**: Connect Google Drive account
- **Browse Drive files**: Show in tree view alongside local files
- **Drag & drop**: Drag Drive file into workspace → auto-download
- **Right-click download**: Manual download option
- **Cache downloads**: Store in app data directory
- **Sync status indicators**:
  - ☁️ In cloud only
  - 💾 Downloaded locally
  - 🔄 Syncing

#### Database Schema Addition
```json
{
  "driveIntegration": {
    "enabled": false,
    "accessToken": "encrypted_token",
    "refreshToken": "encrypted_token",
    "connectedEmail": "user@gmail.com"
  },
  "driveFiles": [
    {
      "id": "drive_file_id",
      "name": "Document.pdf",
      "mimeType": "application/pdf",
      "webViewLink": "https://...",
      "localPath": null, // or path if downloaded
      "cached": false,
      "tags": []
    }
  ]
}
```

---

## 6. Context Menu (Right-Click Options)

### Custom Right-Click Menu
Replace default context menu with custom dropdown:

#### Menu Options
```
📄 File.pdf
├─ 🤖 Read with AI
├─ 📋 Copy Path
├─ 📂 Show in Folder
├─ 🏷️ Edit Tags
├─ 📊 File Properties
├─ 🔄 Refresh Metadata
├─ ☁️ Upload to Drive (if Drive enabled)
├─ 💾 Download (if Drive file)
├─ 🗑️ Remove from Workspace
└─ ❌ Delete File (dangerous)
```

#### "Read with AI" Feature
- Send file path to Ollama
- Extract text (if PDF/docx)
- Generate summary
- Show in chat widget or modal
- Cache summary as tag/metadata

---

## 7. Reorder & Organization View

### Features
- **Drag & drop reordering**: Manual file ordering within workspace
- **Multiple sort options**:
  - Alphabetical (A-Z, Z-A)
  - Date (Newest, Oldest)
  - Size (Largest, Smallest)
  - Type (Group by extension)
  - Tags (Group by tag)
- **View modes**:
  - List view (current)
  - Tree view (hierarchical)
  - Grid view (thumbnails for images)
  - Tag view (grouped by tags)

---

## 8. Updated Database Schema

### Complete Schema
```json
{
  "modes": [...],
  "files": [...], // Keep for backward compatibility
  "fileWorkspaces": [
    {
      "id": "workspace_id",
      "name": "My Project",
      "rootPaths": ["/path1", "/path2"],
      "expandedFolders": ["/path1/src"],
      "files": [
        {
          "path": "/full/path/file.txt",
          "name": "file.txt",
          "size": 1024,
          "modified": "ISO date",
          "tags": ["work", "code"],
          "aiTags": ["documentation", "typescript"],
          "customOrder": 0,
          "summary": "AI-generated summary",
          "isDriveFile": false,
          "driveId": null
        }
      ],
      "mode": "default",
      "sortBy": "name",
      "sortOrder": "asc",
      "viewMode": "tree"
    }
  ],
  "driveIntegration": {
    "enabled": false,
    "accessToken": null,
    "refreshToken": null,
    "email": null
  },
  "composerSettings": {
    "enabled": false,
    "autoTagNewFiles": true,
    "tagCategories": ["work", "personal", "project"]
  }
}
```

---

## 9. Implementation Steps

### Phase 1: Fix App Search (Immediate)
1. Fix AppsTab search input positioning
2. Connect cached apps to search
3. Verify 262 apps are searchable

### Phase 2: Tree View Component
1. Create `FileTreeView.jsx` component
2. Add folder selection dialog
3. Implement tree rendering with expand/collapse
4. Add drag & drop folder support
5. Update database schema to support workspaces

### Phase 3: AI Tagging System
1. Add "Composer" toggle button
2. Implement file analysis with Ollama
3. Create batch tagging queue
4. Add tag display in tree view
5. Add manual tag editing

### Phase 4: Semantic Search
1. Create natural language query parser
2. Implement filter engine
3. Add search input with suggestions
4. Display ranked results

### Phase 5: Context Menu
1. Create custom right-click menu component
2. Implement all menu actions
3. Add "Read with AI" feature
4. Add file operations (copy, show in folder, etc.)

### Phase 6: Google Drive Integration
1. Set up Google OAuth flow
2. Implement Drive API integration
3. Add Drive file browser
4. Implement download on drag & drop
5. Add sync indicators

### Phase 7: Organization Views
1. Add view mode toggle (list/tree/grid/tags)
2. Implement drag & drop reordering
3. Add sort options
4. Add filter by tags

---

## 10. Component Structure

```
src/components/
├── Panel.jsx (main)
├── FilesWidget.jsx (updated)
├── FileTreeView.jsx (new)
│   ├── FolderNode.jsx
│   ├── FileNode.jsx
│   └── TreeControls.jsx
├── FileContextMenu.jsx (new)
├── ComposerAgent.jsx (new)
├── SemanticSearch.jsx (new)
├── DriveIntegration.jsx (new)
│   ├── DriveAuth.jsx
│   ├── DriveBrowser.jsx
│   └── DriveFileNode.jsx
└── ui/
    ├── TagEditor.jsx (new)
    └── FileSummaryModal.jsx (new)
```

---

## 11. IPC Handlers Required

```javascript
// File workspace operations
ipcMain.handle('add-file-workspace', async (_, workspace))
ipcMain.handle('remove-file-workspace', async (_, id))
ipcMain.handle('get-folder-contents', async (_, folderPath))
ipcMain.handle('expand-folder', async (_, workspaceId, folderPath))

// AI tagging
ipcMain.handle('enable-composer', async (_, enabled))
ipcMain.handle('tag-file-with-ai', async (_, filePath))
ipcMain.handle('batch-tag-files', async (_, filePaths))
ipcMain.handle('update-file-tags', async (_, filePath, tags))

// Semantic search
ipcMain.handle('semantic-file-search', async (_, query))

// Context menu actions
ipcMain.handle('read-file-with-ai', async (_, filePath))
ipcMain.handle('show-in-folder', async (_, filePath))
ipcMain.handle('get-file-properties', async (_, filePath))

// Google Drive
ipcMain.handle('connect-google-drive', async ())
ipcMain.handle('list-drive-files', async ())
ipcMain.handle('download-drive-file', async (_, fileId))
ipcMain.handle('upload-to-drive', async (_, filePath))
```

---

## 12. Technical Considerations

### Performance
- **Lazy loading**: Only load visible folders
- **Virtualization**: Use virtual scrolling for large file lists
- **Debounced search**: 300ms delay on search input
- **Background tagging**: Queue AI tagging to avoid UI blocking
- **Cache Drive file list**: Refresh every 5 minutes

### Security
- **Encrypt Drive tokens**: Use electron-store with encryption
- **Validate file paths**: Prevent path traversal attacks
- **Sanitize file names**: Remove dangerous characters
- **Sandbox AI operations**: Run in separate process if needed

### UX
- **Loading states**: Show spinners during operations
- **Error handling**: Toast notifications for errors
- **Undo support**: Allow undo for tag changes
- **Keyboard shortcuts**:
  - `Ctrl+F`: Focus search
  - `Ctrl+T`: Toggle tree/list view
  - `Ctrl+K`: Open composer
  - `Space`: Preview file

---

## Summary

This implementation will transform the file management from a simple file list to a powerful, AI-enhanced workspace with:
- ✅ Fixed app search with 262 apps searchable
- ✅ Tree view with collapsible folders
- ✅ AI-powered auto-tagging (Composer)
- ✅ Semantic natural language search
- ✅ Google Drive integration with download on drop
- ✅ Context menu with "Read with AI"
- ✅ Multiple organization views
- ✅ Drag & drop reordering

**Estimated Implementation Time**: 2-3 weeks for full feature set
**Priority**: Phase 1 (App Search) → Phase 2 (Tree View) → Phase 3 (AI Tagging) → Rest
