require('dotenv').config();

console.log('=== Gogh Setup Check ===\n');

// Check .env file
if (!process.env.GEMINI_API_KEY) {
  console.log('❌ GEMINI_API_KEY not found in .env file');
  console.log('   Create a .env file with: GEMINI_API_KEY=your_key_here');
} else if (process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
  console.log('❌ GEMINI_API_KEY is still set to placeholder');
  console.log('   Replace with your actual API key from https://makersuite.google.com/app/apikey');
} else {
  console.log('✅ GEMINI_API_KEY is configured');
  console.log('   Key: ' + process.env.GEMINI_API_KEY.substring(0, 10) + '...');
}

console.log('\n=== Next Steps ===');
console.log('1. Make sure you have a valid Gemini API key');
console.log('2. Run: npm start');
console.log('3. Try creating a task with intent like "Learn React"');
console.log('4. Check the console for detailed logs if something goes wrong');

