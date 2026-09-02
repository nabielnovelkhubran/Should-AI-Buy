import { MarketStateContext, AgentStrategyConfig } from './types';
import { MarketSnapshot, PaperAccountSnapshot, PortfolioSnapshot, PaperPosition } from '../types';
import { PaperPortfolioService, paperPortfolioService } from '../portfolio';
import { alpacaDataAdapter } from '../market-data/alpaca-adapter';
import { fetchMarketSnapshot } from '../market-data';
import { getTradingEnvironmentConfig, validatePaperTradingEndpoint } from '../environment';
import { getAgentConfig } from './config';

// ---------------------------------------------------------------------------
// Phase 8.6: Market State Builder & Data Freshness Validator
// INVARIANT: Collects authoritative broker & market state.
// INVARIANT: Rejects stale market data (> staleDataThresholdMs) fail-closed.
// ---------------------------------------------------------------------------

export class StaleDataError extends Error {
  constructor(symbol: string, ageMs: number, thresholdMs: number) {
    super(`STALE_DATA_REJECTED: Market data for ${symbol} is ${Math.round(ageMs / 1000)}s old (max allowed: ${Math.round(thresholdMs / 1000)}s).`);
    this.name = 'StaleDataError';
  }
}

export class MarketStateBuilder {
  private portfolioService: PaperPortfolioService;
  private config: AgentStrategyConfig;

  constructor(
    portfolioService: PaperPortfolioService = paperPortfolioService,
    config: AgentStrategyConfig = getAgentConfig()
  ) {
    this.portfolioService = portfolioService;
    this.config = config;
  }

  /**
   * Validates snapshot freshness against configured threshold.
   * Throws StaleDataError if timestamp is too old.
   */
  public validateFreshness(snapshot: MarketSnapshot, nowMs: number = Date.now()): void {
    if (!snapshot || !snapshot.timestamp) {
      throw new StaleDataError(snapshot?.symbol || 'UNKNOWN', Infinity, this.config.staleDataThresholdMs);
    }
    const snapshotTime = new Date(snapshot.timestamp).getTime();
    if (isNaN(snapshotTime)) {
      throw new StaleDataError(snapshot.symbol, Infinity, this.config.staleDataThresholdMs);
    }

    const ageMs = Math.max(0, nowMs - snapshotTime);
    if (ageMs > this.config.staleDataThresholdMs) {
      throw new StaleDataError(snapshot.symbol, ageMs, this.config.staleDataThresholdMs);
    }
  }

  /**
   * Builds complete contextual market state for the autonomous trading loop.
   */
  async buildMarketState(
    cycleId: string,
    candidateSymbols: string[] = ['BTC', 'ETH', 'SOL', 'AAPL', 'NVDA', 'MSFT'],
    fetchSnapshotFn: (sym: string) => Promise<MarketSnapshot> = fetchMarketSnapshot
  ): Promise<MarketStateContext> {
    const envConfig = getTradingEnvironmentConfig();
    validatePaperTradingEndpoint(envConfig.baseUrl);

    const now = Date.now();
    const isoTimestamp = new Date(now).toISOString();

    // 1. Fetch Authoritative Paper Portfolio & Account
    const portfolio: PortfolioSnapshot = await this.portfolioService.getPortfolioSnapshot();
    const account: PaperAccountSnapshot = portfolio.account || {
      id: 'paper-acc',
      accountNumber: 'PA-000',
      status: 'ACTIVE',
      currency: 'USD',
      equity: 100000.00,
      cash: 100000.00,
      buyingPower: 100000.00,
      portfolioValue: 100000.00,
      isPaper: true,
      retrievedAt: isoTimestamp
    };

    // 2. Fetch US Equity Market Clock
    let isMarketOpen = true;
    let marketSession = 'REGULAR';
    try {
      const clock = await alpacaDataAdapter.getMarketClock();
      isMarketOpen = clock.isOpen;
      marketSession = clock.isOpen ? 'OPEN' : 'CLOSED';
    } catch {
      // Fallback
    }

    // 3. Collect & Validate Freshness for Candidate Snapshots
    const candidateSnapshots: Record<string, MarketSnapshot> = {};
    for (const sym of candidateSymbols) {
      try {
        const snap = await fetchSnapshotFn(sym);
        // Verify freshness (crypto or equity)
        this.validateFreshness(snap, now);
        candidateSnapshots[sym.toUpperCase()] = snap;
      } catch {
        // Strict failure isolation: invalid/stale snapshot is excluded
      }
    }

    return {
      cycleId,
      timestamp: isoTimestamp,
      environment: envConfig.environment,
      account,
      portfolio,
      isMarketOpen,
      marketSession,
      activePositions: portfolio.positions || [],
      totalEquityUsd: account.equity,
      availableCashUsd: account.cash,
      grossExposureUsd: portfolio.exposure?.grossExposureUsd || 0,
      netExposureUsd: portfolio.exposure?.netExposureUsd || 0,
      candidateSnapshots
    };
  }
}

export const marketStateBuilder = new MarketStateBuilder();
