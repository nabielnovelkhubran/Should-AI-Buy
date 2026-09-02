const fs = require('fs');
const content = fs.readFileSync('src/lib/agent/analytics/types.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('RejectionFunnel') || l.includes('RejectionAnalysis')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
