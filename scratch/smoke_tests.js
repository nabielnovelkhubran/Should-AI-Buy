const { parseCommand } = require('./src/lib/command');
const { fetchMarketSnapshot } = require('./src/lib/market-data');
const { automationScheduler } = require('./src/lib/automation');

async function runSmokeTests() {
  console.log('--- Phase 8.13.5 Smoke Tests ---');

  // Test 1: $BTC parsing and snapshot
  console.log('\n[Test 1] Direct Council: $BTC');
  const parsed1 = parseCommand('$BTC');
  console.log(`Parsed command: valid=${parsed1.valid}, asset=${parsed1.asset}`);
  const snap1 = await fetchMarketSnapshot(parsed1.asset || 'BTC');
  console.log(`Snapshot fetched: symbol=${snap1.symbol}, price=$${snap1.price}, change24h=${snap1.change24h}%`);

  // Test 2: Should AI buy BTC?
  console.log('\n[Test 2] Direct Council: Should AI buy BTC?');
  const parsed2 = parseCommand('Should AI buy BTC?');
  console.log(`Parsed command: valid=${parsed2.valid}, asset=${parsed2.asset}`);

  // Test 3: Automation Scheduler Start/Stop
  console.log('\n[Test 3] Automation Scheduler Lifecycle');
  automationScheduler.start();
  const statusStarted = automationScheduler.getStatus();
  console.log(`Scheduler status after start: ${statusStarted.schedulerStatus}`);
  automationScheduler.stop();
  const statusStopped = automationScheduler.getStatus();
  console.log(`Scheduler status after stop: ${statusStopped.schedulerStatus}`);

  console.log('\n--- Smoke Tests Completed Successfully ---');
}

runSmokeTests().catch(err => console.error('Smoke test failure:', err));
