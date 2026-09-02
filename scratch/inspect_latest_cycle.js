const http = require('http');

http.get('http://localhost:3000/api/agent/runtime', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const snap = json.snapshot;
    console.log('=== LATEST CYCLE HISTORY ===');
    console.log('Cycle Count:', snap.cycleHistory?.length);
    if (snap.cycleHistory?.length) {
      const latest = snap.cycleHistory[snap.cycleHistory.length - 1];
      console.log('Latest Cycle ID:', latest.cycleId);
      console.log('Status:', latest.status);
      console.log('Scanned:', latest.candidatesScanned);
      console.log('Evaluated:', latest.candidatesEvaluated);
      console.log('Evaluations JSON:\n', JSON.stringify(latest.evaluations, null, 2));
    }
  });
});
