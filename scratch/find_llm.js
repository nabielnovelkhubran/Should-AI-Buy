const fs = require('fs');
const path = require('path');

function search(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) search(full);
    else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx') || e.name.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('LLM_API_KEY') || content.includes('featherless') || content.includes('openai') || content.includes('groq')) {
        console.log(`Found reference in: ${full}`);
      }
    }
  }
}
search('src');
