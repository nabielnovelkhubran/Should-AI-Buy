const fs = require('fs');
const content = fs.readFileSync('src/lib/agent/engine.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('sessionEvidenceManager')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
