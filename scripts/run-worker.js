const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('SHOULD-AI BUY? — STANDALONE AUTONOMOUS TRADING AGENT WORKER');
console.log('================================================================');

const port = process.env.PORT || 3000;
const baseUrl = 'http://127.0.0.1:' + port;
const intervalSec = parseInt(process.env.AGENT_INTERVAL_SEC || '300', 10);
const intervalMs = intervalSec * 1000;

async function startAgent() {
  try {
    const res = await fetch(baseUrl + '/api/agent/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'START', intervalMs })
    });
    const data = await res.json();
    console.log('[WORKER] Agent Started via API:', data.success ? 'OK' : data.error);
  } catch (err) {
    console.error('[WORKER] Error starting agent:', err.message);
  }
}

async function triggerCycle() {
  try {
    console.log('[WORKER ' + new Date().toISOString() + '] Triggering autonomous scan & deliberation cycle...');
    const res = await fetch(baseUrl + '/api/agent/runtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RUN_CYCLE' })
    });
    const data = await res.json();
    console.log('[WORKER] Cycle Result:', data.success ? ('Done (Cycle ' + data.cycleResult?.cycleId + ')') : data.error);
  } catch (err) {
    console.error('[WORKER] Error running cycle:', err.message);
  }
}

setTimeout(async () => {
  await startAgent();
  await triggerCycle();
  setInterval(triggerCycle, intervalMs);
}, 5000);

setInterval(async () => {
  try {
    const res = await fetch(baseUrl + '/api/agent/runtime');
    const data = await res.json();
    console.log('[HEARTBEAT ' + new Date().toISOString() + '] Runtime State: ' + data.runtime?.state + ' | Running: ' + data.runtime?.running);
  } catch {}
}, 60000);
