const { execSync } = require('child_process');

try {
  const out = execSync('node tests/run-tests.js', { encoding: 'utf8' });
  console.log(out);
} catch (err) {
  const lines = (err.stdout || '').split('\n');
  lines.forEach(l => {
    if (l.includes('FAIL') || l.includes('AssertionError') || l.includes('Error:')) {
      console.log('FAILED LINE:', l);
    }
  });
}
