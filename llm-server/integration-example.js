/**
 * Example integration with main Electron app
 * 
 * This file shows how to replace Gemini API calls with local LLM server calls
 */

const axios = require('axios');

const LLM_SERVER_URL = 'http://localhost:3001';

// Replace the clarifyIntent function in main.js with this:
async function clarifyIntentLocal(text) {
  try {
    const response = await axios.post(`${LLM_SERVER_URL}/clarify-intent`, {
      text: text
    });
    
    if (response.data.success) {
      return { intent: response.data.intent };
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error('Intent clarification error:', error.message);
    return null;
  }
}

// Replace the generateTasksFromIntent function in main.js with this:
async function generateTasksFromIntentLocal(intentText) {
  try {
    const response = await axios.post(`${LLM_SERVER_URL}/generate-tasks`, {
      intentText: intentText
    });
    
    if (response.data.success) {
      return { tasks: response.data.tasks };
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error('Task generation error:', error.message);
    return null;
  }
}

// For Command Palette AI search:
async function searchWithLocalAI(query) {
  try {
    const response = await axios.post(`${LLM_SERVER_URL}/chat`, {
      message: `Answer concisely in 1-2 sentences: ${query}`
    });
    
    if (response.data.success) {
      return [{
        type: 'ai',
        title: 'AI Response',
        description: response.data.response,
        action: 'copy'
      }];
    }
    return [];
  } catch (error) {
    console.error('AI search error:', error.message);
    return [];
  }
}

// Export for use in main.js
module.exports = {
  clarifyIntentLocal,
  generateTasksFromIntentLocal,
  searchWithLocalAI
};

