const { spawnSync } = require('child_process');
const res = spawnSync('node', ['tests/run-tests.js'], { encoding: 'utf8' });
const lines = res.stdout.split('\n');
console.log(lines.slice(500, 596).join('\n'));
if (res.stderr) console.error('STDERR:', res.stderr);
