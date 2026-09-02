const fs = require('fs');
const path = require('path');

function searchFiles(dir, text) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchFiles(fullPath, text);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.json'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes(text.toLowerCase())) {
        const lines = content.split('\n');
        lines.forEach((l, i) => {
          if (l.toLowerCase().includes(text.toLowerCase())) {
            console.log(`${fullPath.replace(/.*Should AI buy\\/, '')}:${i+1}: ${l.trim()}`);
          }
        });
      }
    }
  }
}

console.log('--- Searching for "partial upstream broker latency" ---');
searchFiles(path.resolve('.'), 'partial upstream broker latency');

console.log('\n--- Searching for "system degraded" ---');
searchFiles(path.resolve('.'), 'system degraded');

console.log('\n--- Searching for "degraded" ---');
searchFiles(path.resolve('.'), 'degraded');
