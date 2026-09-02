const fs = require('fs');
const content = fs.readFileSync('tests/run-tests.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('Suite 38') || l.includes('38. Phase 8.13.4')) {
    console.log('Line ' + (i+1) + ': ' + l);
  }
});
