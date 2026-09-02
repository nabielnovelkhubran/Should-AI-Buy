const fs = require('fs');
const testContent = fs.readFileSync('tests/run-tests.js', 'utf8');
const lines = testContent.split('\n');
lines.forEach((l, i) => {
  if (l.includes('DEFAULT_SCAN_UNIVERSE') || l.includes('DEFAULT_CRYPTO_UNIVERSE') || l.includes('DEFAULT_EQUITY_UNIVERSE')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
