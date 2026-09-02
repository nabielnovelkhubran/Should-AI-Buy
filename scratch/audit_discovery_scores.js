const { candidateDiscoveryPipeline } = require('./src/lib/agent/pipeline');
const { DEFAULT_SCAN_UNIVERSE } = require('./src/lib/scanner/universe');
const { fetchMarketSnapshot } = require('./src/lib/market-data');
const { classifyMarketRegime } = require('./src/lib/agent/regime');
const { evaluateMultiFactorOpportunity } = require('./src/lib/agent/strategy');

async function auditScores() {
  console.log('================================================================');
  console.log('PHASE 8.14 AUDIT: LIVE DISCOVERY UNIVERSE SCORE DISTRIBUTION');
  console.log('================================================================\n');

  console.log(`Total Universe Assets: ${DEFAULT_SCAN_UNIVERSE.length}`);
  console.log(`Assets: ${DEFAULT_SCAN_UNIVERSE.join(', ')}\n`);

  // Run pipeline
  const result = await candidateDiscoveryPipeline.runPipeline({
    universe: DEFAULT_SCAN_UNIVERSE,
    isMarketOpen: true,
    limit: 20
  });

  console.log(`Eligible Candidates (Score >= 60 & R:R >= 2.0): ${result.eligibleCandidates.length}`);
  console.log(`Filtered Out Candidates: ${result.filteredOutCandidates.length}\n`);

  console.log('--- DETAILED SCORE BREAKDOWN PER ASSET ---');
  for (const sym of DEFAULT_SCAN_UNIVERSE) {
    try {
      const snap = await fetchMarketSnapshot(sym);
      const regime = classifyMarketRegime(snap);
      const evalResult = evaluateMultiFactorOpportunity(snap, regime);

      console.log(`\nASSET: ${sym} (${evalResult.opportunityScore}/100) -> Eligible: ${evalResult.isEligibleForCouncil ? 'YES' : 'NO'}`);
      console.log(`  Price: $${snap.price}, 24h: ${snap.change24h}%, RSI: ${snap.rsi14.toFixed(1)}, Vol: ${snap.realizedVolatility.toFixed(1)}%, RVOL: ${snap.relativeVolume.toFixed(2)}, Spread: ${snap.spreadBps}bps, Liq: $${(snap.liquidityUsd/1e6).toFixed(1)}M`);
      console.log(`  Factor Breakdown:`);
      console.log(`    - Momentum (w=0.20):     ${evalResult.factors.momentum}/100 (contrib = ${(evalResult.factors.momentum * 0.20).toFixed(1)})`);
      console.log(`    - Trend (w=0.15):        ${evalResult.factors.trend}/100 (contrib = ${(evalResult.factors.trend * 0.15).toFixed(1)})`);
      console.log(`    - Volume (w=0.15):       ${evalResult.factors.volume}/100 (contrib = ${(evalResult.factors.volume * 0.15).toFixed(1)})`);
      console.log(`    - Volatility (w=0.10):   ${evalResult.factors.volatility}/100 (contrib = ${(evalResult.factors.volatility * 0.10).toFixed(1)})`);
      console.log(`    - Liquidity (w=0.10):    ${evalResult.factors.liquidity}/100 (contrib = ${(evalResult.factors.liquidity * 0.10).toFixed(1)})`);
      console.log(`    - Catalyst (w=0.10):     ${evalResult.factors.catalyst}/100 (contrib = ${(evalResult.factors.catalyst * 0.10).toFixed(1)})`);
      console.log(`    - Risk/Reward (w=0.10):  ${evalResult.factors.riskReward}/100 (contrib = ${(evalResult.factors.riskReward * 0.10).toFixed(1)}) [${evalResult.estimatedRiskRewardRatio}R]`);
      console.log(`    - Regime Compat (w=0.10):${evalResult.factors.regimeCompatibility}/100 (contrib = ${(evalResult.factors.regimeCompatibility * 0.10).toFixed(1)}) [${regime.regime}]`);
      console.log(`  Composite Sum: ${evalResult.opportunityScore}`);
      if (evalResult.warnings.length) console.log(`  Warnings: ${evalResult.warnings.join(' | ')}`);
      if (evalResult.reasons.length) console.log(`  Reasons: ${evalResult.reasons.join(' | ')}`);
    } catch (e) {
      console.log(`ASSET: ${sym} -> Error fetching: ${e.message}`);
    }
  }
}

auditScores();
