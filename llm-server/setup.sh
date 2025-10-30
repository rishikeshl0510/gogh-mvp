#!/bin/bash

# Setup script for Gogh LLM Server

echo "🚀 Setting up Gogh LLM Server..."

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed."
    echo "📥 Installing Ollama..."
    
    if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -fsSL https://ollama.com/install.sh | sh
    else
        echo "⚠️  Please install Ollama manually from https://ollama.com"
        exit 1
    fi
fi

echo "✅ Ollama is installed"

# Start Ollama service
echo "🔧 Starting Ollama service..."
ollama serve &
sleep 3

# Pull recommended model
echo "📦 Pulling llama3.2:1b model (this may take a few minutes)..."
ollama pull llama3.2:1b

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# LLM Server Configuration
LLM_PORT=3001
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
EOF
    echo "✅ Created .env file"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server, run:"
echo "  npm start"
echo ""
echo "For development with auto-reload:"
echo "  npm run dev"

