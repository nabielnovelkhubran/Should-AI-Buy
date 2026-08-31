import {
  PortfolioSnapshot,
  PaperPortfolioAdapter,
  PortfolioError,
  PortfolioLimits,
  PaperPosition,
  PaperOrderSnapshot,
  PaperAccountSnapshot,
  ProposedOrderAssessment
} from './types';
import { AlpacaPaperPortfolioAdapter } from './alpaca-paper-adapter';
import {
  calculatePortfolioExposure,
  evaluatePortfolioRisk,
  assessProposedOrder,
  DEFAULT_PORTFOLIO_LIMITS
} from './risk';

// ---------------------------------------------------------------------------
// Phase 6B: Paper Portfolio Service
// Orchestrates broker reconciliation, deterministic P&L, exposure calculations,
// and portfolio risk assessment.
// INVARIANT: Paper trading only. Live broker execution is strictly prohibited.
// ---------------------------------------------------------------------------

export class PaperPortfolioService {
  private adapter: PaperPortfolioAdapter;
  private limits: PortfolioLimits;

  constructor(
    adapter?: PaperPortfolioAdapter,
    limits: PortfolioLimits = DEFAULT_PORTFOLIO_LIMITS
  ) {
    this.adapter = adapter || new AlpacaPaperPortfolioAdapter();
    this.limits = limits;
  }

  /**
   * Retrieves the authoritative paper portfolio snapshot with component-level
   * failure isolation and deterministic reconciliation.
   */
  async getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
    const now = new Date().toISOString();
    const errors: PortfolioError[] = [];

    // Parallel fetch with individual error containment
    const [accountRes, positionsRes, ordersRes] = await Promise.allSettled([
      this.adapter.getAccount(),
      this.adapter.getPositions(),
      this.adapter.getOpenOrders()
    ]);

    let account: PaperAccountSnapshot | null = null;
    let positions: PaperPosition[] = [];
    let openOrders: PaperOrderSnapshot[] = [];

    if (accountRes.status === 'fulfilled') {
      account = accountRes.value;
    } else {
      errors.push({
        source: 'account',
        reason: accountRes.reason?.message || 'Failed to retrieve paper account.'
      });
    }

    if (positionsRes.status === 'fulfilled') {
      positions = positionsRes.value;
    } else {
      errors.push({
        source: 'positions',
        reason: positionsRes.reason?.message || 'Failed to retrieve paper positions.'
      });
    }

    if (ordersRes.status === 'fulfilled') {
      openOrders = ordersRes.value;
    } else {
      errors.push({
        source: 'orders',
        reason: ordersRes.reason?.message || 'Failed to retrieve open paper orders.'
      });
    }

    const equity = account?.equity || 0;

    // 1. Calculate per-position allocations deterministically
    for (const pos of positions) {
      pos.allocationPct = equity > 0
        ? Number(((pos.marketValue / equity) * 100).toFixed(2))
        : 0;
    }

    // 2. Deterministic sorting: Positions sorted by marketValue DESC, then symbol ASC
    positions.sort((a, b) => {
      if (b.marketValue !== a.marketValue) {
        return b.marketValue - a.marketValue;
      }
      return a.symbol.localeCompare(b.symbol);
    });

    // 3. Deterministic sorting: Orders sorted by submittedAt DESC, then symbol ASC
    openOrders.sort((a, b) => {
      const timeA = new Date(a.submittedAt).getTime();
      const timeB = new Date(b.submittedAt).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return a.symbol.localeCompare(b.symbol);
    });

    // 4. Calculate Aggregate Exposure
    const exposure = calculatePortfolioExposure(equity, positions);

    // 5. Evaluate Portfolio Risk & Concentration
    const risk = evaluatePortfolioRisk(account, positions, openOrders, this.limits);

    return {
      account,
      positions,
      openOrders,
      exposure,
      risk,
      errors: errors.length > 0 ? errors : undefined,
      provider: 'alpaca-paper',
      environment: 'PAPER',
      retrievedAt: now
    };
  }

  /**
   * Assesses whether a proposed order is safe given current paper portfolio state.
   */
  async assessProposedTrade(proposed: {
    symbol: string;
    qty: number;
    price: number;
    side: 'buy' | 'sell';
  }): Promise<ProposedOrderAssessment> {
    const snapshot = await this.getPortfolioSnapshot();
    return assessProposedOrder(snapshot, proposed, this.limits);
  }

  getLimits(): PortfolioLimits {
    return { ...this.limits };
  }

  setLimits(newLimits: Partial<PortfolioLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
  }
}

/** Singleton instance of PaperPortfolioService */
export const paperPortfolioService = new PaperPortfolioService();

export * from './types';
export * from './alpaca-paper-adapter';
export * from './risk';
