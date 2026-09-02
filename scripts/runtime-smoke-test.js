const http = require('http');
const assert = require('assert');

async function testInvestigationHandler() {
  console.log('[Smoke Test 1] Testing Direct Council Query handler...');
  const { parseCommand } = require('./src/lib/command');
  const { orchestrateCouncilInvestigation } = require('./src/lib/council');
  
  const cmd = 'Should AI buy BTC?';
  const parsed = parseCommand(cmd);
  assert.strictEqual(parsed.valid, true);
  assert.strictEqual(parsed.asset, 'BTC');

  const inv = await orchestrateCouncilInvestigation(cmd, parsed.asset);
  assert.ok(inv);
  assert.strictEqual(inv.asset, 'BTC');
  assert.ok(inv.agentRuns);
  assert.ok(inv.agentRuns['red_team']);
  assert.ok(typeof inv.agentRuns['red_team'].score === 'number');
  console.log(`  -> Direct Council Query OK. Red team score: ${inv.agentRuns['red_team'].score}, Consensus action: ${inv.consensus.action}`);
}

async function testRuntimeSnapshot() {
  console.log('[Smoke Test 2] Testing Live Observability Snapshot handler...');
  const { buildRuntimeSnapshot } = require('./src/lib/agent/analytics/runtime-snapshot');
  
  const snapshot = await buildRuntimeSnapshot();
  assert.ok(snapshot);
  assert.ok(snapshot.account);
  assert.strictEqual(snapshot.account.isPaper, true);
  assert.ok(snapshot.account.accountNumberMasked.startsWith('PA'));
  assert.ok(snapshot.worker);
  assert.strictEqual(typeof snapshot.performance.completedTrades, 'number');
  console.log(`  -> Live Observability OK. Account masked: ${snapshot.account.accountNumberMasked}, Worker state: ${snapshot.worker.state}`);
}

async function testAutonomousCycle() {
  console.log('[Smoke Test 3] Testing Autonomous Cycle handler...');
  const { autonomousTradingEngine } = require('./src/lib/agent/engine');
  
  const res = await autonomousTradingEngine.runCycle({ scanLimit: 5 });
  assert.ok(res);
  assert.ok(res.cycleId);
  assert.strictEqual(res.environment, 'paper');
  assert.ok(res.eventsCount > 0);
  console.log(`  -> Autonomous Cycle OK. Cycle ID: ${res.cycleId}, Events: ${res.eventsCount}, Status: ${res.status}`);
}

async function testDiscoveryScan() {
  console.log('[Smoke Test 4] Testing Discovery Breadth (20 assets)...');
  const { scanOpportunities } = require('./src/lib/scanner');
  const { DEFAULT_SCAN_UNIVERSE } = require('./src/lib/scanner/universe');
  
  assert.strictEqual(DEFAULT_SCAN_UNIVERSE.length, 20);
  const scanResult = await scanOpportunities({ limit: 20 });
  assert.ok(scanResult);
  assert.strictEqual(scanResult.scannedCount, 20);
  assert.ok(scanResult.candidates.length > 0);
  console.log(`  -> Discovery Breadth OK. Scanned: ${scanResult.scannedCount}, Candidates: ${scanResult.candidates.length}, Top candidate: ${scanResult.candidates[0].symbol}`);
}

async function runAllSmokeTests() {
  try {
    console.log('===========================================================');
    console.log('PHASE 8.13.2 RUNTIME SMOKE TESTS');
    console.log('===========================================================');
    await testInvestigationHandler();
    await testRuntimeSnapshot();
    await testAutonomousCycle();
    await testDiscoveryScan();
    console.log('===========================================================');
    console.log('ALL RUNTIME SMOKE TESTS PASSED (4/4 PASS)');
    console.log('===========================================================');
  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exit(1);
  }
}

runAllSmokeTests();
