const http = require('http');

http.get('http://localhost:3000/api/agent/runtime', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const snap = json.snapshot;
    console.log('=== RECENT CYCLES ===');
    console.log(JSON.stringify(snap.recentCycles, null, 2));
    console.log('\n=== RECENT DECISIONS ===');
    console.log(JSON.stringify(snap.recentDecisions, null, 2));
  });
});
