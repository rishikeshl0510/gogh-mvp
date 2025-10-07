const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// This script resets the database to accommodate new schema with intents
// Run this if you're having issues with the database

const DB_PATH = path.join(app.getPath('userData'), 'gogh-data.json');

console.log('Database path:', DB_PATH);

if (fs.existsSync(DB_PATH)) {
  const backup = DB_PATH + '.backup.' + Date.now();
  fs.copyFileSync(DB_PATH, backup);
  console.log('Backup created at:', backup);
  
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    
    // Add intents array if missing
    if (!data.intents) {
      data.intents = [];
      console.log('Added intents array');
    }
    
    // Add intentId to existing tasks
    data.tasks.forEach(task => {
      if (!task.intentId) {
        task.intentId = null;
      }
      if (!task.attachments) {
        task.attachments = [];
      }
    });
    
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    console.log('Database updated successfully!');
  } catch (e) {
    console.error('Error updating database:', e);
    console.log('You may need to delete the database file at:', DB_PATH);
  }
} else {
  console.log('No database found - will be created on first run');
}

