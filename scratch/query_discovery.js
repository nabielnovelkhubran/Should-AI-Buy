const http = require('http');

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${path}: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const data = await fetchJson('/api/discovery');
  console.log('=== LIVE /api/discovery AUDIT ===');
  console.log('Total Scanned:', data.scanResult?.totalScanned);
  console.log('Candidates in Queue:', data.queueStats?.totalItems);
  console.log('High Priority Candidates:', data.queueStats?.highPriorityCount);
  console.log('Avg Opportunity Score in Queue:', data.queueStats?.averageScore);
  console.log('\n--- SCANNED CANDIDATES ---');
  if (data.scanResult?.candidates) {
    data.scanResult.candidates.forEach(c => {
      console.log(`Symbol: ${c.symbol} | Score: ${c.opportunityScore} | Regime: ${c.regime} | Vol: ${c.realizedVolatility}% | Spread: ${c.spreadBps}bps`);
    });
  }
  if (data.queueItems) {
    console.log('\n--- TOP QUEUE ITEMS ---');
    data.queueItems.forEach(item => {
      console.log(`[Rank ${item.priority}] Symbol: ${item.symbol} | Score: ${item.candidate?.opportunityScore} | Stage: ${item.status}`);
    });
  }
}

run();
