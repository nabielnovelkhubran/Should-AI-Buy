import { PaperPosition, PaperOrderSnapshot } from '../portfolio/types';
import { TradeRecord } from '../agent/analytics/types';
import { SimulationPortfolioState } from './types';
import { truncateMoney, truncateQuantity } from '../trading/precision';

// ---------------------------------------------------------------------------
// Phase 8.16: Isolated Simulation Portfolio Service
// INVARIANT: Completely decoupled from real Alpaca broker portfolio.
// Starting balance: $100,000 Cash, $100,000 Equity, 0 Positions.
// ---------------------------------------------------------------------------

export class SimulationPortfolioService {
  private initialCash: number = 100000.00;
  private cash: number = 100000.00;
  private positions: Map<string, PaperPosition> = new Map();
  private orders: PaperOrderSnapshot[] = [];
  private trades: TradeRecord[] = [];
  private realizedPnL: number = 0;

  constructor(initialCash: number = 100000.00) {
    this.initialCash = initialCash;
    this.cash = initialCash;
  }

  public getState(): SimulationPortfolioState {
    const positionList = Array.from(this.positions.values());
    let totalMarketValue = 0;
    let totalUnrealizedPnL = 0;

    for (const pos of positionList) {
      totalMarketValue += pos.marketValue;
      totalUnrealizedPnL += pos.unrealizedPnl;
    }

    const equity = truncateMoney(this.cash + totalMarketValue);
    const buyingPower = truncateMoney(this.cash * 2); // 2x standard simulation margin

    return {
      cash: truncateMoney(this.cash),
      equity,
      buyingPower,
      portfolioValue: equity,
      realizedPnL: truncateMoney(this.realizedPnL),
      unrealizedPnL: truncateMoney(totalUnrealizedPnL),
      openPositionCount: positionList.length,
      positions: positionList,
      orders: [...this.orders],
      trades: [...this.trades],
      isSimulation: true,
      lastUpdated: new Date().toISOString()
    };
  }

  public buyPosition(params: {
    symbol: string;
    assetClass: 'CRYPTO' | 'EQUITY';
    quantity: number;
    price: number;
  }): { position: PaperPosition; cost: number } {
    const cost = truncateMoney(params.quantity * params.price);
    this.cash = Math.max(0, truncateMoney(this.cash - cost));

    const existing = this.positions.get(params.symbol);
    let newQty = params.quantity;
    let newCostBasis = cost;
    let avgPrice = params.price;

    if (existing) {
      newQty = truncateQuantity(existing.quantity + params.quantity, params.assetClass);
      newCostBasis = truncateMoney(existing.costBasis + cost);
      avgPrice = newCostBasis / newQty;
    }

    const marketValue = truncateMoney(newQty * params.price);
    const unrealizedPnl = truncateMoney(marketValue - newCostBasis);
    const unrealizedPnlPercent = newCostBasis > 0 ? Number(((unrealizedPnl / newCostBasis) * 100).toFixed(2)) : 0;

    const position: PaperPosition = {
      symbol: params.symbol,
      assetClass: params.assetClass,
      quantity: newQty,
      avgEntryPrice: avgPrice,
      currentPrice: params.price,
      marketValue,
      costBasis: newCostBasis,
      unrealizedPnl,
      unrealizedPnlPercent,
      side: 'long',
      allocationPct: 0,
      retrievedAt: new Date().toISOString()
    };

    this.positions.set(params.symbol, position);
    return { position, cost };
  }

  public sellPosition(params: {
    symbol: string;
    quantity: number;
    exitPrice: number;
    exitReason?: string;
  }): { realizedPnL: number; proceeds: number; closed: boolean } | null {
    const pos = this.positions.get(params.symbol);
    if (!pos) return null;

    // Prevent overselling
    const sellQty = Math.min(pos.quantity, params.quantity);
    const proceeds = truncateMoney(sellQty * params.exitPrice);
    const costOfSoldPortion = truncateMoney(sellQty * pos.avgEntryPrice);
    const pnl = truncateMoney(proceeds - costOfSoldPortion);

    this.cash = truncateMoney(this.cash + proceeds);
    this.realizedPnL = truncateMoney(this.realizedPnL + pnl);

    const remainingQty = truncateQuantity(pos.quantity - sellQty, pos.assetClass);
    let closed = false;

    if (remainingQty <= 0.00000001) {
      this.positions.delete(params.symbol);
      closed = true;
    } else {
      const newCostBasis = truncateMoney(remainingQty * pos.avgEntryPrice);
      const newMarketValue = truncateMoney(remainingQty * params.exitPrice);
      const newUnrealized = truncateMoney(newMarketValue - newCostBasis);
      pos.quantity = remainingQty;
      pos.costBasis = newCostBasis;
      pos.marketValue = newMarketValue;
      pos.unrealizedPnl = newUnrealized;
      pos.unrealizedPnlPercent = newCostBasis > 0 ? Number(((newUnrealized / newCostBasis) * 100).toFixed(2)) : 0;
      pos.currentPrice = params.exitPrice;
    }

    return { realizedPnL: pnl, proceeds, closed };
  }

  public bumpPrice(symbol: string, percentChange: number): PaperPosition | null {
    const pos = this.positions.get(symbol);
    if (!pos) return null;

    const multiplier = 1 + (percentChange / 100);
    const newPrice = Number((pos.currentPrice * multiplier).toFixed(4));
    const newMarketValue = truncateMoney(pos.quantity * newPrice);
    const newUnrealizedPnl = truncateMoney(newMarketValue - pos.costBasis);
    const newUnrealizedPercent = pos.costBasis > 0 ? Number(((newUnrealizedPnl / pos.costBasis) * 100).toFixed(2)) : 0;

    pos.currentPrice = newPrice;
    pos.marketValue = newMarketValue;
    pos.unrealizedPnl = newUnrealizedPnl;
    pos.unrealizedPnlPercent = newUnrealizedPercent;
    pos.retrievedAt = new Date().toISOString();

    return pos;
  }

  public bumpAllPrices(percentChange: number): void {
    for (const sym of Array.from(this.positions.keys())) {
      this.bumpPrice(sym, percentChange);
    }
  }

  public recordOrder(order: PaperOrderSnapshot): void {
    this.orders.unshift(order);
  }

  public recordTrade(trade: TradeRecord): void {
    this.trades.unshift(trade);
  }

  public reset(): void {
    this.cash = this.initialCash;
    this.realizedPnL = 0;
    this.positions.clear();
    this.orders = [];
    this.trades = [];
  }
}

const g = globalThis as any;
if (!g.__SIMULATION_PORTFOLIO_SERVICE__) {
  g.__SIMULATION_PORTFOLIO_SERVICE__ = new SimulationPortfolioService(100000.00);
}

export const simulationPortfolioService: SimulationPortfolioService = g.__SIMULATION_PORTFOLIO_SERVICE__;

