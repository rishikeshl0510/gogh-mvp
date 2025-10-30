#!/bin/bash

echo "========================================"
echo " Electron MCP Backend Setup (Unix)"
echo "========================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 not found! Please install Python 3.10+"
    exit 1
fi

echo "[1/6] Python found"
python3 --version

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo "[WARNING] Ollama not found!"
    echo "Install with: curl -fsSL https://ollama.com/install.sh | sh"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "[2/6] Checking Ollama..."
    ollama list
fi

# Create virtual environment
echo ""
echo "[3/6] Creating virtual environment..."
python3 -m venv venv
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to create virtual environment"
    exit 1
fi

# Activate virtual environment
echo "[4/6] Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "[5/6] Installing Python dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi

# Check Node.js and npm
echo "[6/6] Checking Node.js for MCP servers..."
if ! command -v node &> /dev/null; then
    echo "[WARNING] Node.js not found! MCP servers require Node.js"
    echo "Install from https://nodejs.org"
else
    echo "Installing MCP filesystem server..."
    npm install -g @modelcontextprotocol/server-filesystem
    if [ $? -ne 0 ]; then
        echo "[WARNING] Failed to install MCP filesystem server"
    fi
fi

echo ""
echo "========================================"
echo " Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit mcp_agent.config.yaml and set your filesystem path"
echo "2. Pull an Ollama model: ollama pull llama3.2:1b"
echo "3. Run the server: python agent_server.py"
echo ""
echo "To activate the virtual environment later:"
echo "    source venv/bin/activate"
echo ""
