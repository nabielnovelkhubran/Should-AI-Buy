const { autonomousTradingEngine } = require('./src/lib/agent/engine');
const { durableSessionJournal } = require('./src/lib/agent/analytics/durable-journal');
const { tradeLedger } = require('./src/lib/agent/analytics/trade-ledger');
const { sessionEvidenceManager } = require('./src/lib/agent/analytics/session-evidence');
const { buildRuntimeSnapshot } = require('./src/lib/agent/analytics/runtime-snapshot');
const { buildAlphaStrategyReviewSnapshot } = require('./src/lib/agent/analytics/strategy-review-engine');
const { alpacaPaperAdapter } = require('./src/lib/trading/alpaca-paper-adapter');

async function testLiveAccumulation() {
  console.log('--- Starting Multi-Cycle Accumulation Audit ---');
  
  // 1. Initial State
  const initialRejections = tradeLedger.getRejectedCandidates().length;
  const initialCycles = sessionEvidenceManager.getSessionEvidence().totalCyclesExecuted;
  const initialEvents = durableSessionJournal.getRecentEvents(100).length;
  console.log(`Initial state: Cycles=${initialCycles}, Rejections=${initialRejections}, Events=${initialEvents}`);

  // 2. Run Cycle 1
  console.log('\nRunning Cycle 1...');
  const res1 = await autonomousTradingEngine.runCycle({ scanLimit: 5, executeOrders: true, executeExits: true });
  const c1Rejections = tradeLedger.getRejectedCandidates().length;
  const c1Cycles = sessionEvidenceManager.getSessionEvidence().totalCyclesExecuted;
  const c1Scanned = sessionEvidenceManager.getSessionEvidence().totalCandidatesScanned;
  const c1Events = durableSessionJournal.getRecentEvents(100).length;
  console.log(`After Cycle 1: Cycles=${c1Cycles}, TotalScanned=${c1Scanned}, Rejections=${c1Rejections}, Events=${c1Events}`);

  // 3. Run Cycle 2
  console.log('\nRunning Cycle 2...');
  const res2 = await autonomousTradingEngine.runCycle({ scanLimit: 5, executeOrders: true, executeExits: true });
  const c2Rejections = tradeLedger.getRejectedCandidates().length;
  const c2Cycles = sessionEvidenceManager.getSessionEvidence().totalCyclesExecuted;
  const c2Scanned = sessionEvidenceManager.getSessionEvidence().totalCandidatesScanned;
  const c2Events = durableSessionJournal.getRecentEvents(100).length;
  console.log(`After Cycle 2: Cycles=${c2Cycles}, TotalScanned=${c2Scanned}, Rejections=${c2Rejections}, Events=${c2Events}`);

  // 4. Run Cycle 3
  console.log('\nRunning Cycle 3...');
  const res3 = await autonomousTradingEngine.runCycle({ scanLimit: 5, executeOrders: true, executeExits: true });
  const c3Rejections = tradeLedger.getRejectedCandidates().length;
  const c3Cycles = sessionEvidenceManager.getSessionEvidence().totalCyclesExecuted;
  const c3Scanned = sessionEvidenceManager.getSessionEvidence().totalCandidatesScanned;
  const c3Events = durableSessionJournal.getRecentEvents(100).length;
  console.log(`After Cycle 3: Cycles=${c3Cycles}, TotalScanned=${c3Scanned}, Rejections=${c3Rejections}, Events=${c3Events}`);

  // 5. Broker Ground Truth Query
  console.log('\nQuerying Alpaca Broker Ground Truth...');
  const account = await alpacaPaperAdapter.getAccount();
  const positions = await alpacaPaperAdapter.getPositions();
  const openOrders = await alpacaPaperAdapter.getOrders('open');
  const closedOrders = await alpacaPaperAdapter.getOrders('closed');

  console.log(`Broker Equity: $${account.equity}`);
  console.log(`Broker Cash: $${account.cash}`);
  console.log(`Broker Open Positions: ${positions.length}`);
  console.log(`Broker Open Orders: ${openOrders.length}`);
  console.log(`Broker Closed Orders: ${closedOrders.length}`);

  // 6. Alpha Review Snapshot verification
  const alphaReview = await buildAlphaStrategyReviewSnapshot();
  console.log(`\nAlpha Review Verdict: ${alphaReview.verdict.quality}`);
  console.log(`Alpha Review Completed Trades: ${alphaReview.verdict.completedTrades}`);
  console.log(`Rejection Funnel Total Scanned: ${alphaReview.rejectionAnalysis.totalCandidatesScanned}`);
  console.log(`Rejection Funnel Total Rejected: ${alphaReview.rejectionAnalysis.totalCandidatesRejected}`);

  console.log('\n--- Accumulation Audit Complete ---');
}

testLiveAccumulation().catch(err => console.error('Audit error:', err));
