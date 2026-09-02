const http = require('http');

http.get('http://localhost:3000/api/agent/runtime', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('Snapshot keys:', Object.keys(json.snapshot || {}));
    console.log('Worker keys:', Object.keys(json.snapshot?.worker || {}));
    console.log('Worker lastCycleResult:\n', JSON.stringify(json.snapshot?.worker?.lastCycleResult, null, 2));
  });
});
