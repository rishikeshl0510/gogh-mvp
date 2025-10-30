@echo off
echo ========================================
echo  Electron MCP Backend Setup (Windows)
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

echo [1/6] Python found
python --version

REM Check Ollama
ollama --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Ollama not found! Please install from https://ollama.com
    echo You can continue, but the backend won't work without Ollama.
    pause
)

echo [2/6] Checking Ollama...
ollama list

REM Create virtual environment
echo.
echo [3/6] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment
    pause
    exit /b 1
)

REM Activate virtual environment
echo [4/6] Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo [5/6] Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

REM Check Node.js and npm
echo [6/6] Checking Node.js for MCP servers...
node --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Node.js not found! MCP servers require Node.js
    echo Install from https://nodejs.org
    goto :skip_mcp
)

echo Installing MCP filesystem server...
call npm install -g @modelcontextprotocol/server-filesystem
if errorlevel 1 (
    echo [WARNING] Failed to install MCP filesystem server
)

:skip_mcp

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit mcp_agent.config.yaml and set your filesystem path
echo 2. Pull an Ollama model: ollama pull llama3.2:1b
echo 3. Run the server: python agent_server.py
echo.
echo To activate the virtual environment later:
echo    venv\Scripts\activate
echo.
pause
