const fs = require('fs');
const path = require('path');

function search(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) search(full);
    else if (e.name.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('evaluateCandidate')) {
        console.log(`Found in: ${full}`);
      }
    }
  }
}
search('src/lib/agent');
