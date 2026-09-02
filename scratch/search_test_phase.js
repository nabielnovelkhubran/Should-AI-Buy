const fs = require('fs');
const testContent = fs.readFileSync('tests/run-tests.js', 'utf8');
const lines = testContent.split('\n');
lines.forEach((l, i) => {
  if (l.includes('Phase 5A') || l.includes('Phase 5B') || l.includes('Phase 8.7')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
