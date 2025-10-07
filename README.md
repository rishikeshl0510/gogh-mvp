# Gogh - AI-Powered Task Management

An Electron-based personal productivity app with AI-powered task generation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
GOOGLE_SEARCH_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

3. Get your Gemini API key:
   - Go to https://makersuite.google.com/app/apikey
   - Create a new API key
   - Copy and paste it into your `.env` file

4. Start the app:
```bash
npm start
```

## Features

- **Intent-based Task Generation**: Describe what you want to accomplish, and AI generates multiple actionable tasks
- **Task Management**: Track tasks with dates, completion status, and attachments
- **File/App/Bookmark Management**: Organize your resources by mode
- **Intent Tree View**: Visualize intents and their related tasks in a tree structure
- **Multi-mode Support**: Switch between different work contexts (Work, Personal, etc.)
- **Command Palette**: Quick search for files, apps, and resources
- **AI-powered Search**: Get instant answers using Gemini AI

## Keyboard Shortcuts

- `Ctrl+Space` (Windows/Linux) or `Cmd+Shift+Space` (Mac): Open command palette
- `Escape`: Close open panels/windows

## Task Creation Workflow

1. Click on "Tasks" in the sidebar
2. Type your intent in the INTENT input box (e.g., "Plan vacation to Japan")
3. AI clarifies your intent and asks for confirmation
4. AI generates 2-6 specific, actionable tasks
5. View and manage tasks grouped by intent

## Troubleshooting

### "Gemini couldn't understand intent" error

1. Make sure your `.env` file exists and contains a valid Gemini API key
2. Check the console logs for detailed error messages
3. Verify your API key is active at https://makersuite.google.com/app/apikey

### Database migration

If you're upgrading from an older version and experiencing issues:

Run this in your user data directory to reset the database:
```bash
# Windows: %APPDATA%\gogh\gogh-data.json
# Mac: ~/Library/Application Support/gogh/gogh-data.json
# Linux: ~/.config/gogh/gogh-data.json

# Delete or rename the file to start fresh
```

## Database Location

Your data is stored locally at:
- Windows: `%APPDATA%\gogh\gogh-data.json`
- Mac: `~/Library/Application Support/gogh/gogh-data.json`
- Linux: `~/.config/gogh/gogh-data.json`

