const fs = require('fs');
const path = require('path');

const enginePath = path.resolve('src/lib/agent/engine.ts');
let code = fs.readFileSync(enginePath, 'utf8');

// 1. Add imports if needed
if (!code.includes('durableSessionJournal')) {
  code = code.replace(
    "import { getTradingEnvironmentConfig } from '../environment';",
    "import { getTradingEnvironmentConfig } from '../environment';\nimport { durableSessionJournal } from './analytics/durable-journal';\nimport { FrozenDecisionSnapshot } from './analytics/durable-types';"
  );
}

// 2. Cycle Start
if (!code.includes("durableSessionJournal.recordEvent('CYCLE_STARTED'")) {
  code = code.replace(
    "this.journal.record(cycleId, 'CYCLE_STARTED', `Autonomous trading cycle ${cycleId} started.`);",
    "this.journal.record(cycleId, 'CYCLE_STARTED', `Autonomous trading cycle ${cycleId} started.`);\n      durableSessionJournal.recordEvent('CYCLE_STARTED', { cycleId }, { cycleId });\n      durableSessionJournal.updateHeartbeat({ workerStatus: 'RUNNING', lastCycleStarted: isoStart, lastHeartbeat: isoStart });"
  );
}

// 3. Frozen Decision & Order events
if (!code.includes('durableSessionJournal.recordFrozenDecision')) {
  const target = "const tradeId = `TRADE-${Date.now().toString(36).toUpperCase()}-${symbol}`;";
  const replacement = `const tradeId = \`TRADE-\${Date.now().toString(36).toUpperCase()}-\${symbol}\`;
            const frozenSnapshot: FrozenDecisionSnapshot = {
              symbol,
              assetClass: candidate.assetClass,
              strategy: decision.strategy,
              regime: pipelineResult.marketRegime.regime,
              opportunityScore: candidate.multiFactorEvaluation.opportunityScore,
              confidence: decision.confidence,
              factorScores: candidate.multiFactorEvaluation.factors,
              estimatedRiskReward: decision.riskRewardRatio,
              invalidationPrice: Number(decision.invalidationConditions[0]?.match(/\\d+(\\.\\d+)?/)?.[0] ?? (candidate.snapshot.price * 0.95).toFixed(2)),
              targetPrice: Number(decision.targetConditions[0]?.match(/\\d+(\\.\\d+)?/)?.[0] ?? (candidate.snapshot.price * 1.1).toFixed(2)),
              riskDecision: 'PASS',
              requestedQuantity: sizingResult.calculatedQuantity,
              decisionTimestamp: isoStart
            };
            durableSessionJournal.recordFrozenDecision(tradeId, frozenSnapshot);
            durableSessionJournal.recordEvent('ORDER_INTENT_CREATED', { tradeId, symbol, qty: sizingResult.calculatedQuantity, price: candidate.snapshot.price }, { cycleId, tradeId, symbol });
            durableSessionJournal.recordEvent('ORDER_SUBMITTED', { tradeId, orderId: orderResult.orderId, status: orderResult.status }, { cycleId, tradeId, orderId: orderResult.orderId, symbol });`;
  code = code.replace(target, replacement);
}

// 4. Fill event
if (!code.includes("durableSessionJournal.recordEvent('ORDER_FILLED'")) {
  code = code.replace(
    "this.tradeLedger.recordFill({",
    "durableSessionJournal.recordEvent('ORDER_FILLED', { tradeId, orderId: orderResult.orderId, filledAvgPrice: orderResult.filledAvgPrice, filledQty: orderResult.qty || sizingResult.calculatedQuantity }, { cycleId, tradeId, orderId: orderResult.orderId, symbol });\n              this.tradeLedger.recordFill({"
  );
}

// 5. Protective exit filled
if (!code.includes("durableSessionJournal.recordEvent('PROTECTIVE_EXIT_FILLED'")) {
  code = code.replace(
    "this.journal.record(\n            cycleId,\n            'TRADE_EXIT_RECORDED',",
    "durableSessionJournal.recordEvent('PROTECTIVE_EXIT_FILLED', { symbol: exit.symbol, quantity: exit.quantity, exitPrice: exit.executionResult?.filledAvgPrice || openTrade?.entryPrice, reason: exit.invalidationReason?.category }, { cycleId, symbol: exit.symbol });\n          this.journal.record(\n            cycleId,\n            'TRADE_EXIT_RECORDED',"
  );
}

// 6. Cycle Completed
if (!code.includes("durableSessionJournal.recordEvent('CYCLE_COMPLETED'")) {
  code = code.replace(
    "this.journal.record(\n        cycleId,\n        'CYCLE_COMPLETED',",
    "durableSessionJournal.recordEvent('CYCLE_COMPLETED', { cycleId, durationMs, candidatesScanned: pipelineResult.totalScanned, ordersSubmittedCount: ordersSubmitted.length, positionsMonitoredCount }, { cycleId });\n      durableSessionJournal.updateHeartbeat({ lastCycleCompleted: isoEnd, lastSuccessfulCycle: isoEnd, consecutiveFailures: 0 });\n      this.journal.record(\n        cycleId,\n        'CYCLE_COMPLETED',"
  );
}

// 7. Cycle Failed
if (!code.includes("durableSessionJournal.recordEvent('CYCLE_FAILED'")) {
  code = code.replace(
    "this.journal.record(\n        cycleId,\n        'CYCLE_FAILED',",
    "durableSessionJournal.recordEvent('CYCLE_FAILED', { cycleId, error: err.message }, { cycleId });\n      durableSessionJournal.updateHeartbeat({ lastCycleCompleted: isoEnd, consecutiveFailures: this.consecutiveFailures });\n      this.journal.record(\n        cycleId,\n        'CYCLE_FAILED',"
  );
}

fs.writeFileSync(enginePath, code, 'utf8');
console.log('Engine successfully patched with durable journal logging!');
