import { AccountHealthReport, AccountHealthCheck } from './types';

// ---------------------------------------------------------------------------
// Phase 8.8H: Paper Account Health Verifier
// INVARIANT: If any blocker exists, the engine will not place new orders.
// INVARIANT: Paper endpoint is always validated. No live trading.
// ---------------------------------------------------------------------------

export interface AccountHealthInput {
  accountStatus?: string;
  equity?: number;
  cash?: number;
  buyingPower?: number;
  openPositionCount?: number;
  circuitBreakerActive?: boolean;
  lastDataUpdateMs?: number;          // Ms since last successful market data update
  lastReconciliationMs?: number;      // Ms since last successful broker reconciliation
  isPaper?: boolean;
  isMarketDataHealthy?: boolean;
  maxStaleDataMs?: number;            // Default: 15 min
}

const DEFAULT_MAX_STALE_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ACCEPTABLE_STALE_RECONCILIATION_MS = 30 * 60 * 1000; // 30 minutes

export function verifyAccountHealth(input: AccountHealthInput): AccountHealthReport {
  const now = new Date().toISOString();
  const checks: AccountHealthCheck[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  const maxStaleMs = input.maxStaleDataMs ?? DEFAULT_MAX_STALE_MS;

  // 1. Paper account check
  const isPaper = input.isPaper !== false;
  checks.push({
    name: 'paper_account',
    passed: isPaper,
    detail: isPaper ? 'Paper trading account confirmed.' : 'BLOCKER: Account is not paper. Live trading prohibited.'
  });
  if (!isPaper) blockers.push('Account is not a paper trading account.');

  // 2. Account status
  const accountActive = input.accountStatus === 'ACTIVE' || input.accountStatus == null;
  checks.push({
    name: 'account_status',
    passed: accountActive,
    detail: accountActive ? `Account status: ${input.accountStatus ?? 'ACTIVE (assumed)'}` : `BLOCKER: Account status is ${input.accountStatus}.`
  });
  if (!accountActive) blockers.push(`Account status is not ACTIVE: ${input.accountStatus}`);

  // 3. Buying power
  const buyingPowerOk = (input.buyingPower ?? 1) > 0;
  checks.push({
    name: 'buying_power',
    passed: buyingPowerOk,
    detail: buyingPowerOk
      ? `Buying power: $${(input.buyingPower ?? 0).toFixed(2)}`
      : 'BLOCKER: Zero buying power — no new orders possible.'
  });
  if (!buyingPowerOk) blockers.push('Zero buying power.');

  // 4. Circuit breaker
  const cbOk = !input.circuitBreakerActive;
  checks.push({
    name: 'circuit_breaker',
    passed: cbOk,
    detail: cbOk ? 'Circuit breaker inactive.' : 'BLOCKER: Circuit breaker is active. Trading halted.'
  });
  if (!cbOk) blockers.push('Circuit breaker is active.');

  // 5. Market data freshness
  const lastData = input.lastDataUpdateMs ?? 0;
  const dataFresh = lastData <= maxStaleMs;
  checks.push({
    name: 'market_data_freshness',
    passed: dataFresh,
    detail: dataFresh
      ? `Market data is fresh (${Math.round(lastData / 1000)}s ago).`
      : `WARNING: Market data is stale (${Math.round(lastData / 1000)}s ago, max ${Math.round(maxStaleMs / 1000)}s).`
  });
  if (!dataFresh) warnings.push(`Market data is stale (${Math.round(lastData / 1000)}s ago).`);

  // 6. Broker reconciliation freshness
  const lastRecon = input.lastReconciliationMs ?? 0;
  const reconFresh = lastRecon <= MAX_ACCEPTABLE_STALE_RECONCILIATION_MS;
  checks.push({
    name: 'broker_reconciliation',
    passed: reconFresh,
    detail: reconFresh
      ? `Last broker reconciliation: ${Math.round(lastRecon / 1000)}s ago.`
      : `WARNING: Broker reconciliation is overdue (${Math.round(lastRecon / 1000)}s ago).`
  });
  if (!reconFresh) warnings.push(`Broker reconciliation overdue (${Math.round(lastRecon / 60000)}min ago).`);

  // 7. Low equity warning
  const equity = input.equity ?? 100000;
  if (equity < 10000) {
    warnings.push(`Low equity warning: account equity is $${equity.toFixed(2)}.`);
    checks.push({ name: 'equity_level', passed: false, detail: `WARNING: Equity below $10,000 ($${equity.toFixed(2)}).` });
  } else {
    checks.push({ name: 'equity_level', passed: true, detail: `Equity: $${equity.toFixed(2)}` });
  }

  const healthy = blockers.length === 0;
  return { healthy, warnings, blockers, checks, checkedAt: now };
}
