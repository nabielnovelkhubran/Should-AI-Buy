const http = require('http');

function postJson(path, payload = {}) {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(payload);
    const req = http.request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: responseData });
        }
      });
    });
    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
}

async function runLiveCycle() {
  console.log('=== RUNNING LIVE AUTONOMOUS CYCLE WITH NORMALIZED CRYPTO LIQUIDITY ===\n');
  const res = await postJson('/api/agent/runtime', { action: 'RUN_CYCLE' });
  console.log('API Status:', res.status);
  const cycle = res.data?.cycleResult;
  console.log(`Cycle ID: ${cycle?.cycleId}`);
  console.log(`Scanned: ${cycle?.candidatesScannedCount}`);
  console.log(`Eligible: ${cycle?.candidatesEligibleCount}`);
  console.log(`Council Evaluated: ${cycle?.candidatesEvaluatedCount}`);
  console.log(`Orders Submitted: ${cycle?.ordersSubmittedCount}`);
  console.log(`Positions Monitored: ${cycle?.positionsMonitoredCount}`);
  console.log('\nCandidates Evaluated by Council:');
  (cycle?.councilDecisions || []).forEach(d => {
    console.log(`  - [${d.symbol}] Conclusion: ${d.conclusion} | Confidence: ${d.confidence}% | Reason: ${d.reason}`);
  });
  console.log('\nTop Discovered Candidates:');
  (cycle?.candidates || []).forEach(c => {
    console.log(`  - [${c.symbol}] Score: ${c.score} | R:R: ${c.signals?.estimatedRiskReward || c.estimatedRiskReward || 'N/A'}R | Liq: $${(c.signals?.liquidityUsd || 0).toLocaleString()}`);
  });
}

runLiveCycle();
