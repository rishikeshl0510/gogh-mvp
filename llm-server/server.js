const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.LLM_PORT || 3001;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await axios.get(`${OLLAMA_URL}/api/tags`);
    res.json({ status: 'ok', message: 'LLM server is running and Ollama is accessible' });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      message: 'Ollama is not running or not accessible',
      error: error.message 
    });
  }
});

// List available models
app.get('/models', async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`);
    res.json({ 
      success: true, 
      models: response.data.models || [] 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Intent clarification endpoint
app.post('/clarify-intent', async (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ 
      success: false, 
      error: 'Text is required' 
    });
  }

  const prompt = `Analyze this intent: "${text}"

Provide a clear, concise description of what the user wants to accomplish (1-2 sentences max).

Return ONLY a JSON object with this exact format (no markdown, no extra text):
{
  "intent": "Clear description of what user wants to accomplish"
}

Examples:
- "Plan my vacation to Japan" -> {"intent": "Plan and organize a vacation trip to Japan including bookings, activities, and preparations"}
- "Learn React" -> {"intent": "Learn React framework through tutorials, practice projects, and understanding core concepts"}

Today is ${new Date().toISOString().split('T')[0]}`;

  try {
    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_ctx: 4096
        }
      },
      {
        timeout: 30000
      }
    );

    let responseText = response.data.response;
    
    // Clean up response
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Try to parse JSON
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      // If parsing fails, try to extract intent manually
      const intentMatch = responseText.match(/"intent"\s*:\s*"([^"]+)"/);
      if (intentMatch) {
        parsed = { intent: intentMatch[1] };
      } else {
        throw new Error('Could not parse response as JSON');
      }
    }

    if (!parsed || !parsed.intent) {
      throw new Error('Response missing intent field');
    }

    res.json({ 
      success: true, 
      intent: parsed.intent 
    });
  } catch (error) {
    console.error('Intent clarification error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data 
    });
  }
});

// Task generation endpoint
app.post('/generate-tasks', async (req, res) => {
  const { intentText } = req.body;
  
  if (!intentText) {
    return res.status(400).json({ 
      success: false, 
      error: 'Intent text is required' 
    });
  }

  const prompt = `Break down this intent into specific actionable tasks: "${intentText}"

Return ONLY a JSON object with an array of tasks (no markdown, no extra text):
{
  "tasks": [
    {"title": "task title", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"},
    {"title": "task title", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}
  ]
}

Guidelines:
- Create 2-6 specific, actionable tasks
- Tasks should be in logical order
- Set realistic dates based on task dependencies
- Each task should be clear and focused

Examples:
- "Plan vacation to Japan" -> {"tasks": [{"title": "Research destinations and create itinerary", "startDate": "2025-10-07", "endDate": "2025-10-10"}, {"title": "Book flights and accommodation", "startDate": "2025-10-11", "endDate": "2025-10-13"}, {"title": "Apply for visa if needed", "startDate": "2025-10-14", "endDate": "2025-10-20"}]}

Today is ${new Date().toISOString().split('T')[0]}`;

  try {
    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_ctx: 4096
        }
      },
      {
        timeout: 30000
      }
    );

    let responseText = response.data.response;
    
    // Clean up response
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Try to parse JSON
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      // If parsing fails, try to extract tasks array manually
      const tasksMatch = responseText.match(/"tasks"\s*:\s*(\[[^\]]+\])/);
      if (tasksMatch) {
        parsed = { tasks: JSON.parse(tasksMatch[1]) };
      } else {
        throw new Error('Could not parse response as JSON');
      }
    }

    if (!parsed || !parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error('Response missing tasks array');
    }

    res.json({ 
      success: true, 
      tasks: parsed.tasks 
    });
  } catch (error) {
    console.error('Task generation error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data 
    });
  }
});

// Generic chat endpoint
app.post('/chat', async (req, res) => {
  const { message, model } = req.body;
  
  if (!message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Message is required' 
    });
  }

  try {
    const response = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: model || process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
        prompt: message,
        stream: false,
        options: {
          temperature: 0.7,
          num_ctx: 4096
        }
      },
      {
        timeout: 30000
      }
    );

    res.json({ 
      success: true, 
      response: response.data.response 
    });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 LLM Server running on http://localhost:${PORT}`);
  console.log(`📡 Ollama URL: ${OLLAMA_URL}`);
  console.log(`🤖 Default model: ${process.env.OLLAMA_MODEL || 'qwen2.5:0.5b'}`);
});

