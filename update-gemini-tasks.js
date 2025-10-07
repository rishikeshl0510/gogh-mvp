const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

function updateFile(relativePath, transform) {
  const filePath = path.join(baseDir, relativePath);
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = transform(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✔ Updated ${relativePath}`);
    return true;
  }
  console.log(`ℹ ${relativePath} already up to date`);
  return false;
}

function updateMain() {
  const parseRegex = /async function parseTaskNaturalLanguage\(text\) {[\s\S]*?}\r?\n\r?\n/;
  const newFunction = [
    "async function parseTaskNaturalLanguage(text) {",
    "  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {",
    "    return [];",
    "  }",
    "",
    "  try {",
    "    const today = new Date().toISOString().split('T')[0];",
    "    const promptLines = [",
    "      'You are an expert personal assistant that breaks plans into actionable tasks.',",
    "      'Today is ' + today + '.',",
    "      'Understand the user request inside triple quotes and decide how many tasks are required (1-5).',",
    "      'Each task must include \"title\", \"startDate\", and \"endDate\" fields using YYYY-MM-DD.',",
    "      'Respect any explicit timing; otherwise default to today for both dates.',",
    "      'Return ONLY a valid JSON array. No markdown, no additional text.'",
    "    ];",
    "    const prompt = promptLines.join('\\n') + '\\n\\nUser request:\\n\"\"\"' + text + '\"\"\"';",
    "",
    "    const response = await axios.post(",
    "      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-latest:generateContent?key=' + process.env.GEMINI_API_KEY,",
    "      {",
    "        contents: [{",
    "          parts: [{ text: prompt }]",
    "        }]",
    "      }",
    "    );",
    "",
    "    const candidateText = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';",
    "    const cleaned = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();",
    "",
    "    if (!cleaned) {",
    "      return [];",
    "    }",
    "",
    "    const parsed = JSON.parse(cleaned);",
    "",
    "    if (Array.isArray(parsed)) {",
    "      return parsed;",
    "    }",
    "",
    "    if (parsed && Array.isArray(parsed.tasks)) {",
    "      return parsed.tasks;",
    "    }",
    "",
    "    if (parsed && typeof parsed === 'object') {",
    "      return [parsed];",
    "    }",
    "",
    "    return [];",
    "  } catch (error) {",
    "    console.error('Task parsing error:', error.message);",
    "    return [];",
    "  }",
    "}",
    "",
  ].join('\n');

  return updateFile('main.js', (content) => {
    let updated = content;
    let changed = false;

    if (content.includes('Return ONLY a JSON object')) {
      if (!parseRegex.test(content)) {
        throw new Error('Could not locate parseTaskNaturalLanguage block in main.js');
      }
      updated = updated.replace(parseRegex, `${newFunction}\n`);
      changed = true;
    }

    const endpointRegex = /\/models\/gemini-pro:generateContent/g;
    if (endpointRegex.test(updated)) {
      updated = updated.replace(endpointRegex, '/models/gemini-2.5-flash-latest:generateContent');
      changed = true;
    }

    return changed ? updated : content;
  });
}

function updateRendererPanel() {
  const addTaskRegex = /async function addTaskNatural\(\) {[\s\S]*?}\r?\n\r?\n/;
  const newFunction = [
    'async function addTaskNatural() {',
    '  const input = document.getElementById(\'taskInput\');',
    '  if (!input || !input.value.trim()) return;',
    '',
    '  const text = input.value.trim();',
    '  const statusEl = document.getElementById(\'taskStatus\');',
    '  const requestStamp = Date.now();',
    '',
    '  input.disabled = true;',
    '  input.placeholder = \"Breaking into tasks with AI...\";',
    '  if (statusEl) statusEl.textContent = \"Sending request to Gemini...\";',
    '',
    '  try {',
    '    const parsed = await window.panelAPI.parseTask(text);',
    '    const tasks = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);',
    '    const today = new Date().toISOString().split(\'T\')[0];',
    '    const normalized = tasks',
    '      .filter(task => task && typeof task === \"object\" && task.title)',
    '      .map((task, index) => {',
    '        const safeTitle = String(task.title).trim();',
    '        if (!safeTitle) {',
    '          return null;',
    '        }',
    '        const safeStart = (typeof task.startDate === \"string\" && task.startDate) ? task.startDate : today;',
    '        const safeEnd = (typeof task.endDate === \"string\" && task.endDate) ? task.endDate : safeStart;',
    '        return {',
    '          id: requestStamp + index,',
    '          title: safeTitle,',
    '          startDate: safeStart,',
    '          endDate: safeEnd,',
    '          mode: data.currentMode,',
    '          completed: false,',
    '          createdAt: new Date().toISOString()',
    '        };',
    '      })',
    '      .filter(Boolean);',
    '',
    '    if (normalized.length) {',
    '      for (const task of normalized) {',
    '        await window.panelAPI.addTask(task);',
    '      }',
    '      input.value = \"\";',
    '      if (statusEl) {',
    '        const plural = normalized.length > 1 ? \"s\" : \"\";',
    '        statusEl.textContent = \"Added \" + normalized.length + \" AI-generated task\" + plural + \".\";',
    '      }',
    '    } else {',
    '      alert(\"Could not understand the task request. Try describing the work with more detail.\");',
    '      if (statusEl) statusEl.textContent = \"AI could not parse any tasks.\";',
    '    }',
    '  } catch (error) {',
    '    alert(\"AI parsing failed. Check your Gemini API key in .env\");',
    '    if (statusEl) statusEl.textContent = \"AI parsing failed.\";',
    '  }',
    '',
    '  setTimeout(() => {',
    '    if (statusEl) statusEl.textContent = \"\";',
    '  }, 4000);',
    '',
    '  input.disabled = false;',
    '  input.placeholder = \"What do you need to do?\";',
    '  input.focus();',
    '}',
    '',
  ].join('\n');

  return updateFile('renderer-panel.js', (content) => {
    let updated = content;
    let changed = false;

    if (content.includes('Type naturally: "Buy groceries tomorrow"')) {
      const hintRegex = /Type naturally:[^<]+/;
      updated = updated.replace(
        hintRegex,
        'Describe your plan (e.g., "Prep launch next week") and the AI will split it into 1-5 tasks automatically.'
      );
      changed = true;
    }

    if (content.includes('parsed && parsed.title && parsed.startDate && parsed.endDate')) {
      if (!addTaskRegex.test(content)) {
        throw new Error('Could not locate addTaskNatural block in renderer-panel.js');
      }
      updated = updated.replace(addTaskRegex, `${newFunction}\n`);
      changed = true;
    }

    return changed ? updated : content;
  });
}

function updatePanelHtml() {
  return updateFile('panel.html', (content) => {
    let updated = content;
    let changed = false;
    const newline = content.includes('\r\n') ? '\r\n' : '\n';

    if (!content.includes('.sr-only')) {
      const srOnlyBlock = [
        '    .sr-only {',
        '      position: absolute;',
        '      width: 1px;',
        '      height: 1px;',
        '      padding: 0;',
        '      margin: -1px;',
        '      overflow: hidden;',
        '      clip: rect(0, 0, 0, 0);',
        '      white-space: nowrap;',
        '      border: 0;',
        '    }'
      ].join(newline);
      updated = updated.replace(
        '    .hidden { display: none !important; }',
        '    .hidden { display: none !important; }' + newline + srOnlyBlock
      );
      changed = true;
    }

    if (!content.includes('id="taskStatus"')) {
      const marker = `${newline}    <div class="content" id="panelContent"></div>`;
      const replacement = `${marker}${newline}    <div id="taskStatus" class="sr-only" aria-live="polite"></div>`;
      updated = updated.replace(marker, replacement);
      changed = true;
    }

    return changed ? updated : content;
  });
}

function run() {
  try {
    const results = [updateMain(), updateRendererPanel(), updatePanelHtml()];
    const anyChanged = results.some(Boolean);
    if (!anyChanged) {
      console.log('No changes were necessary.');
    } else {
      console.log('Gemini endpoint and multi-task parsing updates applied.');
    }
  } catch (error) {
    console.error('Failed to apply updates:', error.message);
    process.exitCode = 1;
  }
}

run();
