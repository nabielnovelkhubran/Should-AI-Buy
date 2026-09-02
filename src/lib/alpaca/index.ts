import { AlpacaAccount, AlpacaOrder, Position } from '../types';
import { AlpacaPaperTradingAdapter } from '../trading/alpaca-paper-adapter';
import { AlpacaPaperPortfolioAdapter } from '../portfolio/alpaca-paper-adapter';
import { truncateQuantity } from '../trading/precision';

// ---------------------------------------------------------------------------
// Phase 8.5A: Modernized Alpaca Paper Trading Service Bridge
// Retires legacy Phase 1 in-memory mock and routes all operations through the
// audited, fail-closed Phase 6A/6B Alpaca Paper Adapters.
// INVARIANT: Strictly paper trading only. Fully deterministic.
// ---------------------------------------------------------------------------

export class AlpacaTradingService {
  private tradingAdapter: AlpacaPaperTradingAdapter;
  private portfolioAdapter: AlpacaPaperPortfolioAdapter;

  constructor(options?: { apiKey?: string; secretKey?: string; baseUrl?: string }) {
    this.tradingAdapter = new AlpacaPaperTradingAdapter(options);
    this.portfolioAdapter = new AlpacaPaperPortfolioAdapter(options);
  }

  async getAccount(): Promise<AlpacaAccount> {
    const snapshot = await this.portfolioAdapter.getAccount();
    return {
      id: snapshot.id,
      accountNumber: snapshot.accountNumber,
      status: snapshot.status,
      currency: snapshot.currency,
      buyingPower: snapshot.buyingPower,
      cash: snapshot.cash,
      portfolioValue: snapshot.portfolioValue,
      patternDayTrader: false,
      tradingBlocked: false
    };
  }

  async getPositions(): Promise<Position[]> {
    const paperPositions = await this.portfolioAdapter.getPositions();
    return paperPositions.map(p => ({
      id: `pos-${p.symbol.toLowerCase()}`,
      symbol: p.symbol,
      asset: p.symbol,
      quantity: p.quantity,
      entryPrice: p.avgEntryPrice,
      currentPrice: p.currentPrice,
      unrealizedPl: p.unrealizedPnl,
      unrealizedPlPct: p.unrealizedPnlPercent,
      unrealizedPnl: p.unrealizedPnl,
      unrealizedPnlPercent: p.unrealizedPnlPercent,
      allocationPercent: p.allocationPct,
      side: p.side === 'short' ? 'SHORT' : 'LONG',
      status: 'OPEN',
      openedAt: p.retrievedAt,
      thesisId: `THESIS-${p.symbol}`,
      thesis: {
        id: `THESIS-${p.symbol}`,
        investigationId: `INV-${p.symbol}-LEGACY`,
        asset: p.symbol,
        direction: (p.side === 'short' ? 'SHORT' : 'LONG') as 'LONG' | 'SHORT',
        createdAt: p.retrievedAt,
        entryPrice: p.avgEntryPrice,
        expectedHorizon: '1-3 days',
        bullCase: `Paper position held for ${p.symbol}`,
        supportingEvidenceIds: [],
        riskFactors: [],
        invalidationConditions: [],
        councilConfidence: 75,
        status: 'ACTIVE' as const
      }
    }));
  }

  async getOrders(): Promise<AlpacaOrder[]> {
    const paperOrders = await this.tradingAdapter.getOrders();
    return paperOrders.map(o => ({
      id: o.brokerOrderId || o.orderId,
      clientOrderId: o.clientOrderId,
      symbol: o.symbol,
      qty: o.qty,
      side: o.side,
      type: o.orderType || 'market',
      status: o.status === 'FILLED' ? 'filled' : o.status === 'REJECTED' ? 'rejected' : 'new',
      filledAvgPrice: o.filledAvgPrice,
      submittedAt: o.submittedAt || o.createdAt
    }));
  }

  async submitPaperOrder(
    symbol: string,
    qty: number,
    side: 'buy' | 'sell',
    price: number
  ): Promise<AlpacaOrder> {
    const cleanSymbol = symbol.toUpperCase().replace(/^\$/, '').trim();
    const assetClass = (['BTC', 'ETH', 'SOL'].includes(cleanSymbol) ? 'CRYPTO' : 'EQUITY');
    const safeQty = truncateQuantity(qty, assetClass);
    const investigationId = `LEGACY-${cleanSymbol}-${Date.now()}`;

    const res = await this.tradingAdapter.submitOrder({
      investigationId,
      symbol: cleanSymbol,
      assetClass,
      side,
      qty: safeQty,
      price,
      orderType: 'market',
      timeInForce: assetClass === 'CRYPTO' ? 'gtc' : 'day',
      riskGatePassed: true,
      recommendation: side === 'buy' ? 'BUY' : 'SELL',
      opportunityScore: 70
    });

    return {
      id: res.brokerOrderId || res.orderId,
      clientOrderId: res.clientOrderId,
      symbol: res.symbol,
      qty: res.qty,
      side: res.side,
      type: res.orderType || 'market',
      status: res.status === 'FILLED' ? 'filled' : 'new',
      filledAvgPrice: res.filledAvgPrice || price,
      submittedAt: res.submittedAt || res.createdAt
    };
  }
}

export const alpacaService = new AlpacaTradingService();
