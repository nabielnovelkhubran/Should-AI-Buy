const fs = require('fs');
const path = require('path');

// 1. Load environment variables
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  });
}

console.log('================================================================');
console.log('SHOULD-AI BUY? — STANDALONE AUTONOMOUS TRADING AGENT WORKER');
console.log('================================================================');

const { autonomousRuntime } = require('../src/lib/agent/runtime');

const intervalSec = parseInt(process.env.AGENT_INTERVAL_SEC || '900', 10);
const intervalMs = intervalSec * 1000;
const proofMode = process.env.AGENT_PROOF_MODE === 'true';

console.log(`[WORKER INIT] Mode: REAL_PAPER | Interval: ${intervalSec}s | ProofMode: ${proofMode ? 'ON' : 'OFF'}`);
console.log(`[WORKER INIT] Alpaca Base URL: ${process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets/v2'}`);

const status = autonomousRuntime.start({
  intervalMs,
  mode: 'REAL_PAPER',
  proofMode
});

console.log(`[WORKER STARTED] Status: ${status.state} | Next Cycle: ${status.nextCycleAt}`);
console.log(`[WORKER] Running continuous autonomous trading loop (Browser Closed / Background Daemon)...`);

function handleShutdown(signal) {
  console.log(`\n[WORKER SHUTDOWN] Received ${signal}. Stopping Autonomous Trading Runtime cleanly...`);
  const stopStatus = autonomousRuntime.stop();
  console.log(`[WORKER SHUTDOWN] Runtime State: ${stopStatus.state}. Exiting.`);
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

setInterval(() => {
  const current = autonomousRuntime.getStatus();
  console.log(`[HEARTBEAT ${new Date().toISOString()}] State: ${current.state} | Total Cycles: ${current.stats.totalCycles} | Orders: ${current.stats.ordersSubmitted} | Monitored: ${current.stats.positionsMonitored}`);
}, 60000);
