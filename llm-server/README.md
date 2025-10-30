# Gogh LLM Server

Local LLM server using Ollama for the Gogh AI Palette application.

## Prerequisites

1. **Install Ollama**
   - **macOS/Linux**: `curl -fsSL https://ollama.com/install.sh | sh`
   - **Windows**: Download from https://ollama.com

2. **Pull a Model**
   ```bash
   # Recommended lightweight model (500MB)
   ollama pull llama3.2:1b
   
   # Alternative models
   ollama pull llama3.2:1b      # 1.3GB
   ollama pull gemma2:2b        # 1.6GB
   ollama pull phi3:mini        # 2.3GB
   ```

## Installation

```bash
cd llm-server
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to configure your settings:
   - `LLM_PORT`: Port for the LLM server (default: 3001)
   - `OLLAMA_URL`: Ollama API URL (default: http://localhost:11434)
   - `OLLAMA_MODEL`: Model to use (default: llama3.2:1b)

## Running the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3001` (or your configured port).

## API Endpoints

### Health Check
```bash
GET /health
```
Returns server and Ollama status.

### List Models
```bash
GET /models
```
Returns list of available Ollama models.

### Clarify Intent
```bash
POST /clarify-intent
Content-Type: application/json

{
  "text": "Plan my vacation to Japan"
}
```
Returns clarified intent.

### Generate Tasks
```bash
POST /generate-tasks
Content-Type: application/json

{
  "intentText": "Plan and organize a vacation trip to Japan"
}
```
Returns array of generated tasks with dates.

### Chat
```bash
POST /chat
Content-Type: application/json

{
  "message": "What's the weather like?",
  "model": "llama3.2:1b"  // optional
}
```
Returns AI response.

## Integration with Main App

To use this LLM server instead of Gemini API:

1. Start the LLM server: `npm start`
2. Update `main.js` in the main app to point to `http://localhost:3001`
3. Replace Gemini API calls with LLM server endpoints

Example integration code is provided in `integration-example.js`.

## Troubleshooting

**Ollama not found:**
- Make sure Ollama is installed and running: `ollama serve`
- Check if Ollama is accessible: `curl http://localhost:11434/api/tags`

**Model not found:**
- Pull the model: `ollama pull llama3.2:1b`
- List available models: `ollama list`

**Server errors:**
- Check server logs for detailed error messages
- Verify `.env` configuration
- Ensure Ollama service is running

## Performance Tips

1. **Choose the right model:**
   - `llama3.2:1b` - Fastest, ~500MB, good for quick tasks
   - `llama3.2:1b` - Balanced, ~1.3GB, better quality
   - `gemma2:2b` - Higher quality, ~1.6GB, slower
   - `phi3:mini` - Best quality, ~2.3GB, slowest

2. **Adjust context window:**
   - Smaller `num_ctx` (2048) = faster, less memory
   - Larger `num_ctx` (8192) = slower, more context

3. **Temperature setting:**
   - Lower (0.3-0.5) = more focused, deterministic
   - Higher (0.7-0.9) = more creative, varied

## License

MIT

