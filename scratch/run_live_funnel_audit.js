const http = require('http');

function postJson(path, payload) {
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
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${responseData.substring(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
}

async function runAudit() {
  console.log('=== 1. TRIGGERING DISCOVERY SCAN VIA POST /api/discovery ===');
  const disc = await postJson('/api/discovery', { limit: 20, autoDispatch: false });
  console.log(`Candidates Found: ${disc.scanResult?.candidates?.length}`);
  if (disc.scanResult?.candidates) {
    disc.scanResult.candidates.forEach(c => {
      console.log(`  - ${c.symbol.padEnd(6)} | Score: ${c.opportunityScore} | Momentum: ${c.momentumScore} | RVOL: ${c.relativeVolume} | VolAccel: ${c.volumeAcceleration} | Price: $${c.price}`);
    });
  }

  console.log('\n=== 2. TRIGGERING AUTONOMOUS CYCLE VIA POST /api/agent/runtime ===');
  const cycleRes = await postJson('/api/agent/runtime', { action: 'RUN_CYCLE', scanLimit: 10, executeOrders: false });
  console.log(`Cycle ID:            ${cycleRes.cycleResult?.cycleId}`);
  console.log(`Status:              ${cycleRes.cycleResult?.status}`);
  console.log(`Candidates Scanned:  ${cycleRes.cycleResult?.candidatesScanned}`);
  console.log(`Candidates Evaluated:${cycleRes.cycleResult?.candidatesEvaluated}`);
  console.log(`Evaluations Count:   ${cycleRes.cycleResult?.evaluations?.length}`);
  console.log(`Orders Submitted:    ${cycleRes.cycleResult?.ordersSubmitted?.length}`);

  if (cycleRes.cycleResult?.evaluations?.length) {
    cycleRes.cycleResult.evaluations.forEach(ev => {
      console.log(`  Evaluation: ${ev.symbol} | Score: ${ev.opportunityScore} | Strategy: ${ev.strategy} | Decision: ${ev.councilDecision?.conclusion} | Conf: ${ev.councilDecision?.confidence}% | ApprovedQty: ${ev.approvedQuantity}`);
    });
  }

  // Fetch recent journal events from /api/agent/events
  console.log('\n=== 3. FETCHING RECENT JOURNAL EVENTS ===');
  const eventsRes = await new Promise(resolve => {
    http.get('http://localhost:3000/api/agent/events', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });
  if (eventsRes?.events) {
    const lastCycleEvents = eventsRes.events.filter(e => e.cycleId === cycleRes.cycleResult?.cycleId || e.type.includes('FILTER') || e.type.includes('DISCOVER') || e.type.includes('EVAL') || e.type.includes('DECISION'));
    lastCycleEvents.slice(-15).forEach(e => {
      console.log(`  [${e.type}] ${e.message}`);
    });
  }
}

runAudit();
