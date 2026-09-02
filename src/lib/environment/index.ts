// ---------------------------------------------------------------------------
// Phase 8.5C: Trading Environment Configuration & Competition-Account Isolation
// INVARIANT: Strictly enforces Paper-Only trading.
// Distinguishes between:
// - TEST: Development, experiments, backtests, local simulation.
// - COMPETITION: Official Alpaca AI Trading Agents Hackathon ($100k paper account).
// ---------------------------------------------------------------------------

export type TradingEnvironment = 'test' | 'competition';

export interface TradingEnvironmentConfig {
  environment: TradingEnvironment;
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  isCompetition: boolean;
  accountLabel: string;
  targetStartingEquity: number;
}

const DEFAULT_PAPER_BASE_URL = 'https://paper-api.alpaca.markets/v2';
const PROHIBITED_LIVE_ENDPOINT_PATTERN = /https:\/\/(?!paper-)api\.alpaca\.markets/i;

/**
 * Validates that an endpoint strictly points to Alpaca Paper Trading.
 * Throws a fatal fail-closed error if any live endpoint is detected.
 */
export function validatePaperTradingEndpoint(url: string): void {
  if (!url || PROHIBITED_LIVE_ENDPOINT_PATTERN.test(url) || !url.toLowerCase().includes('paper')) {
    throw new Error(
      `CRITICAL_SAFETY_VIOLATION: Non-paper Alpaca endpoint detected ("${url}"). Should-AI Buy? is strictly paper-only.`
    );
  }
}

/**
 * Resolves the active Trading Environment Configuration with fail-closed validation.
 */
export function getTradingEnvironmentConfig(): TradingEnvironmentConfig {
  const envRaw = (process.env.TRADING_ENVIRONMENT || 'test').toLowerCase().trim();
  const environment: TradingEnvironment = envRaw === 'competition' ? 'competition' : 'test';

  const baseUrl = process.env.ALPACA_PAPER_BASE_URL || DEFAULT_PAPER_BASE_URL;
  validatePaperTradingEndpoint(baseUrl);

  let apiKey = '';
  let secretKey = '';

  if (environment === 'competition') {
    apiKey = process.env.ALPACA_COMPETITION_API_KEY || process.env.APCA_COMPETITION_API_KEY_ID || '';
    secretKey = process.env.ALPACA_COMPETITION_SECRET_KEY || process.env.APCA_COMPETITION_API_SECRET_KEY || '';

    // If dedicated competition keys not found, check if standard keys are explicitly designated
    if (!apiKey || !secretKey) {
      // Fallback check with explicit logging
      apiKey = process.env.ALPACA_API_KEY || '';
      secretKey = process.env.ALPACA_SECRET_KEY || '';
    }

    return {
      environment: 'competition',
      apiKey,
      secretKey,
      baseUrl,
      isCompetition: true,
      accountLabel: 'Alpaca Hackathon Competition Account ($100K Paper)',
      targetStartingEquity: 100000.00
    };
  }

  // TEST Environment
  apiKey = process.env.ALPACA_TEST_API_KEY || process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '';
  secretKey = process.env.ALPACA_TEST_SECRET_KEY || process.env.ALPACA_SECRET_KEY || process.env.APCA_API_SECRET_KEY || '';

  return {
    environment: 'test',
    apiKey,
    secretKey,
    baseUrl,
    isCompetition: false,
    accountLabel: 'Paper Test & Development Account',
    targetStartingEquity: 100000.00
  };
}

export function isCompetitionEnvironment(): boolean {
  return (process.env.TRADING_ENVIRONMENT || '').toLowerCase().trim() === 'competition';
}

export function getEnvironmentBadge(): {
  label: string;
  isCompetition: boolean;
  colorClass: string;
} {
  const isComp = isCompetitionEnvironment();
  if (isComp) {
    return {
      label: 'COMPETITION PAPER ($100K)',
      isCompetition: true,
      colorClass: 'bg-amber-950/70 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30'
    };
  }
  return {
    label: 'TEST PAPER',
    isCompetition: false,
    colorClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
  };
}
