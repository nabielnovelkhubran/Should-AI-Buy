import { PaperPortfolioService } from '../portfolio';
import { getTradingEnvironmentConfig, validatePaperTradingEndpoint } from '../environment';
import { getAgentConfig } from './config';
import { autonomousTradingEngine } from './engine';
import { CompetitionReadinessReport, AccountHealthCheck } from './analytics/types';

// ---------------------------------------------------------------------------
// Phase 8.8K: Competition Account Readiness Checker
// INVARIANT: If ready===false, the engine must not place any new orders.
// INVARIANT: Paper endpoint is always verified. Live trading strictly prohibited.
// INVARIANT: This is a read-only pre-flight check. Config is never mutated.
// ---------------------------------------------------------------------------

export async function verifyCompetitionReadiness(
  portfolioService?: PaperPortfolioService
): Promise<CompetitionReadinessReport> {
  const now = new Date().toISOString();
  const checks: AccountHealthCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Environment must be 'competition'
  const envConfig = getTradingEnvironmentConfig();
  const isCompetition = envConfig.environment === 'competition';
  checks.push({
    name: 'competition_environment',
    passed: isCompetition,
    detail: isCompetition
      ? 'Environment is set to competition mode.'
      : `BLOCKER: Environment is '${envConfig.environment}'. Must be 'competition' for official trading.`
  });
  if (!isCompetition) blockers.push(`Environment is '${envConfig.environment}', not 'competition'.`);

  // 2. Paper endpoint validation (and live endpoint forbidden)
  let paperEndpointOk = false;
  try {
    validatePaperTradingEndpoint(envConfig.baseUrl);
    paperEndpointOk = true;
    checks.push({ name: 'paper_endpoint', passed: true, detail: `Paper endpoint confirmed: ${envConfig.baseUrl}` });
  } catch (err: any) {
    checks.push({ name: 'paper_endpoint', passed: false, detail: `BLOCKER: ${err.message}` });
    blockers.push(err.message);
  }

  // 3. Credentials present (do NOT log values)
  const hasApiKey = Boolean(process.env.COMPETITION_ALPACA_API_KEY || process.env.ALPACA_API_KEY_ID);
  const hasApiSecret = Boolean(process.env.COMPETITION_ALPACA_SECRET_KEY || process.env.ALPACA_SECRET_KEY);
  const hasCredentials = hasApiKey && hasApiSecret;
  checks.push({
    name: 'api_credentials_present',
    passed: hasCredentials,
    detail: hasCredentials ? 'API credentials are present (values not logged).' : 'BLOCKER: Missing Alpaca API credentials.'
  });
  if (!hasCredentials) blockers.push('Missing required Alpaca API credentials.');

  // 4. Circuit Breaker status
  const cb = autonomousTradingEngine.getCircuitBreakerStatus();
  const cbOk = !cb.tripped;
  checks.push({
    name: 'circuit_breaker',
    passed: cbOk,
    detail: cbOk ? 'Circuit breaker is inactive.' : `BLOCKER: Circuit breaker is tripped (${cb.reason}).`
  });
  if (!cbOk) blockers.push(`Circuit breaker is active: ${cb.reason}`);

  // 5. Strategy config loaded and non-zero
  try {
    const config = getAgentConfig();
    const configOk = config.maxPositionSizeUsd > 0 && config.maxPortfolioExposurePct > 0;
    checks.push({
      name: 'strategy_config',
      passed: configOk,
      detail: configOk
        ? `Strategy config loaded: maxPos=$${config.maxPositionSizeUsd}, maxExposure=${config.maxPortfolioExposurePct}%.`
        : 'BLOCKER: Strategy config has invalid zero values.'
    });
    if (!configOk) blockers.push('Strategy config has invalid zero values.');
  } catch (err: any) {
    checks.push({ name: 'strategy_config', passed: false, detail: `BLOCKER: Failed to load strategy config: ${err.message}` });
    blockers.push(`Failed to load strategy config: ${err.message}`);
  }

  // 6. Portfolio reconciliation (if service provided)
  if (portfolioService) {
    try {
      const snapshot = await portfolioService.getPortfolioSnapshot();
      const equity = snapshot.account?.equity ?? 0;
      const reconOk = equity > 0;

      // Starting equity should be close to $100k for official competition account
      if (equity < 80000) {
        warnings.push(`Starting equity is $${equity.toFixed(2)}, which is below the expected $100,000 for a fresh competition account.`);
      }

      checks.push({
        name: 'broker_reconciliation',
        passed: reconOk,
        detail: reconOk
          ? `Broker reconciliation successful. Equity: $${equity.toFixed(2)}`
          : 'BLOCKER: Broker reconciliation failed or equity is zero.'
      });
      if (!reconOk) blockers.push('Broker reconciliation failed.');
    } catch (err: any) {
      checks.push({ name: 'broker_reconciliation', passed: false, detail: `BLOCKER: Reconciliation error: ${err.message}` });
      blockers.push(`Broker reconciliation error: ${err.message}`);
    }
  } else {
    checks.push({
      name: 'broker_reconciliation',
      passed: false,
      detail: 'WARNING: No portfolio service provided; broker reconciliation skipped.'
    });
    warnings.push('Broker reconciliation was skipped.');
  }

  const ready = blockers.length === 0;
  return { ready, checks, blockers, warnings, checkedAt: now };
}
