import {
  PaperAccountSnapshot,
  PaperPosition,
  PaperOrderSnapshot,
  PaperPortfolioAdapter
} from './types';
import { PaperOrderStatus, AssetClass } from '../types';
import { detectAssetClass, normalizeScanSymbol } from '../scanner/universe';

// ---------------------------------------------------------------------------
// Phase 6B: Alpaca Paper Portfolio Adapter
// INVARIANT: Connects exclusively to Alpaca Paper Trading.
// Live trading endpoints are strictly prohibited and will trigger immediate
// fail-closed rejection.
// ---------------------------------------------------------------------------

const ALPACA_PAPER_BASE_URL = 'https://paper-api.alpaca.markets/v2';
const PROHIBITED_LIVE_ENDPOINT_PATTERN = /https:\/\/(?!paper-)api\.alpaca\.markets/i;

export class AlpacaPaperPortfolioAdapter implements PaperPortfolioAdapter {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;

  // In-memory simulation stores for offline / deterministic testing
  private simulatedAccount: PaperAccountSnapshot | null = null;
  private simulatedPositions: PaperPosition[] = [];
  private simulatedOrders: PaperOrderSnapshot[] = [];

  constructor(options?: {
    apiKey?: string;
    secretKey?: string;
    baseUrl?: string;
    simulatedAccount?: PaperAccountSnapshot;
    simulatedPositions?: PaperPosition[];
    simulatedOrders?: PaperOrderSnapshot[];
  }) {
    this.apiKey = options?.apiKey || process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '';
    this.secretKey = options?.secretKey || process.env.ALPACA_SECRET_KEY || process.env.APCA_API_SECRET_KEY || '';
    this.baseUrl = options?.baseUrl || process.env.ALPACA_PAPER_BASE_URL || ALPACA_PAPER_BASE_URL;

    // Strict Fail-Closed Check: Verify baseUrl is strictly a paper endpoint
    this.validatePaperEndpoint(this.baseUrl);

    if (options?.simulatedAccount) this.simulatedAccount = options.simulatedAccount;
    if (options?.simulatedPositions) this.simulatedPositions = options.simulatedPositions;
    if (options?.simulatedOrders) this.simulatedOrders = options.simulatedOrders;
  }

  private validatePaperEndpoint(url: string): void {
    if (PROHIBITED_LIVE_ENDPOINT_PATTERN.test(url)) {
      throw new Error(
        'CRITICAL_SAFETY_VIOLATION: Live Alpaca trading endpoint detected. Phase 6B portfolio queries strictly prohibit live broker interaction.'
      );
    }

    if (!url.toLowerCase().includes('paper')) {
      throw new Error(
        'CRITICAL_SAFETY_VIOLATION: Non-paper trading endpoint configured. Must explicitly contain "paper".'
      );
    }
  }

  /**
   * Fetches Paper Account State.
   */
  async getAccount(): Promise<PaperAccountSnapshot> {
    this.validatePaperEndpoint(this.baseUrl);
    const now = new Date().toISOString();

    // 1. Live Alpaca Paper API Call (when real credentials exist)
    if (this.apiKey && this.secretKey && !this.apiKey.startsWith('MOCK')) {
      try {
        const res = await fetch(`${this.baseUrl}/account`, {
          method: 'GET',
          headers: {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.secretKey,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 401) {
          throw new Error('AUTHENTICATION_FAILED: Alpaca Paper API credentials invalid or unauthorized.');
        }
        if (res.status === 429) {
          throw new Error('RATE_LIMIT_EXCEEDED: Alpaca Paper API rate limit reached.');
        }
        if (!res.ok) {
          throw new Error(`BROKER_ACCOUNT_ERROR: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const equity = Number(data.equity || data.portfolio_value || 0);
        const cash = Number(data.cash || 0);
        const buyingPower = Number(data.buying_power || cash);
        const portfolioValue = Number(data.portfolio_value || equity);

        return {
          id: data.id || 'alpaca-paper-account',
          accountNumber: data.account_number || 'PAPER-ACC',
          status: data.status || 'ACTIVE',
          currency: data.currency || 'USD',
          equity,
          cash,
          buyingPower,
          portfolioValue,
          isPaper: true,
          retrievedAt: now
        };
      } catch (err: any) {
        if (err.message.startsWith('AUTHENTICATION_FAILED') || err.message.startsWith('RATE_LIMIT_EXCEEDED')) {
          throw err;
        }
        throw new Error(`NETWORK_TIMEOUT: Failed to fetch Alpaca Paper account (${err.message})`);
      }
    }

    // 2. Simulated Deterministic Paper Account (for offline testing)
    if (this.simulatedAccount) {
      return { ...this.simulatedAccount, retrievedAt: now };
    }

    return {
      id: 'alpaca-acc-paper-001',
      accountNumber: 'PA-294810239',
      status: 'ACTIVE',
      currency: 'USD',
      equity: 100000.00,
      cash: 95000.00,
      buyingPower: 95000.00,
      portfolioValue: 100000.00,
      isPaper: true,
      retrievedAt: now
    };
  }

  /**
   * Fetches Open Broker-Confirmed Positions.
   */
  async getPositions(): Promise<PaperPosition[]> {
    this.validatePaperEndpoint(this.baseUrl);
    const now = new Date().toISOString();

    // 1. Live Alpaca Paper API Call
    if (this.apiKey && this.secretKey && !this.apiKey.startsWith('MOCK')) {
      try {
        const res = await fetch(`${this.baseUrl}/positions`, {
          method: 'GET',
          headers: {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.secretKey,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 401) {
          throw new Error('AUTHENTICATION_FAILED: Alpaca Paper API credentials invalid or unauthorized.');
        }
        if (res.status === 429) {
          throw new Error('RATE_LIMIT_EXCEEDED: Alpaca Paper API rate limit reached.');
        }
        if (!res.ok) {
          throw new Error(`BROKER_POSITIONS_ERROR: ${res.status} ${res.statusText}`);
        }

        const rawList = await res.json();
        if (!Array.isArray(rawList)) return [];

        return rawList.map((pos: any): PaperPosition => {
          const cleanSymbol = normalizeScanSymbol(pos.symbol);
          const assetClass = (pos.asset_class === 'crypto' || ['BTC', 'ETH', 'SOL'].includes(cleanSymbol))
            ? 'CRYPTO'
            : 'EQUITY';

          const quantity = Math.abs(Number(pos.qty || 0));
          const avgEntryPrice = Number(pos.avg_entry_price || 0);
          const currentPrice = Number(pos.current_price || avgEntryPrice);
          const marketValue = Number(pos.market_value || quantity * currentPrice);
          const costBasis = Number(pos.cost_basis || quantity * avgEntryPrice);
          const unrealizedPnl = Number(pos.unrealized_pl || marketValue - costBasis);
          const unrealizedPnlPercent = costBasis > 0
            ? Number((((marketValue - costBasis) / costBasis) * 100).toFixed(2))
            : Number(pos.unrealized_plpc ? (Number(pos.unrealized_plpc) * 100).toFixed(2) : 0);

          return {
            symbol: cleanSymbol,
            assetClass,
            quantity,
            avgEntryPrice,
            currentPrice,
            marketValue,
            costBasis,
            unrealizedPnl,
            unrealizedPnlPercent,
            side: pos.side === 'short' ? 'short' : 'long',
            allocationPct: 0, // Computed in service layer
            retrievedAt: now
          };
        });
      } catch (err: any) {
        if (err.message.startsWith('AUTHENTICATION_FAILED') || err.message.startsWith('RATE_LIMIT_EXCEEDED')) {
          throw err;
        }
        throw new Error(`NETWORK_TIMEOUT: Failed to fetch Alpaca Paper positions (${err.message})`);
      }
    }

    // 2. Simulated Positions
    return this.simulatedPositions.map(p => ({ ...p, retrievedAt: now }));
  }

  /**
   * Fetches Open / Pending Orders.
   */
  async getOpenOrders(): Promise<PaperOrderSnapshot[]> {
    this.validatePaperEndpoint(this.baseUrl);
    const now = new Date().toISOString();

    // 1. Live Alpaca Paper API Call
    if (this.apiKey && this.secretKey && !this.apiKey.startsWith('MOCK')) {
      try {
        const res = await fetch(`${this.baseUrl}/orders?status=open`, {
          method: 'GET',
          headers: {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.secretKey,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 401) {
          throw new Error('AUTHENTICATION_FAILED: Alpaca Paper API credentials invalid or unauthorized.');
        }
        if (res.status === 429) {
          throw new Error('RATE_LIMIT_EXCEEDED: Alpaca Paper API rate limit reached.');
        }
        if (!res.ok) {
          throw new Error(`BROKER_ORDERS_ERROR: ${res.status} ${res.statusText}`);
        }

        const rawOrders = await res.json();
        if (!Array.isArray(rawOrders)) return [];

        return rawOrders.map((ord: any): PaperOrderSnapshot => {
          const cleanSymbol = normalizeScanSymbol(ord.symbol);
          const assetClass = (ord.asset_class === 'crypto' || ['BTC', 'ETH', 'SOL'].includes(cleanSymbol))
            ? 'CRYPTO'
            : 'EQUITY';

          let status: PaperOrderStatus = 'SUBMITTED';
          const rawStatus = (ord.status || '').toLowerCase();
          if (rawStatus === 'filled') status = 'FILLED';
          else if (rawStatus === 'partially_filled') status = 'PARTIALLY_FILLED';
          else if (rawStatus === 'canceled' || rawStatus === 'cancelled') status = 'CANCELED';
          else if (rawStatus === 'rejected') status = 'REJECTED';
          else if (rawStatus === 'expired' || rawStatus === 'stopped') status = 'FAILED';
          else status = 'SUBMITTED';

          const qty = Number(ord.qty || 0);
          const filledQty = Number(ord.filled_qty || 0);
          const remainingQty = Math.max(0, qty - filledQty);

          return {
            orderId: ord.client_order_id || ord.id,
            brokerOrderId: ord.id,
            clientOrderId: ord.client_order_id,
            symbol: cleanSymbol,
            assetClass,
            side: ord.side === 'sell' ? 'sell' : 'buy',
            qty,
            filledQty,
            remainingQty,
            status,
            orderType: ord.type || 'market',
            timeInForce: ord.time_in_force || 'gtc',
            filledAvgPrice: ord.filled_avg_price ? Number(ord.filled_avg_price) : undefined,
            submittedAt: ord.submitted_at || ord.created_at || now,
            updatedAt: ord.updated_at
          };
        });
      } catch (err: any) {
        if (err.message.startsWith('AUTHENTICATION_FAILED') || err.message.startsWith('RATE_LIMIT_EXCEEDED')) {
          throw err;
        }
        throw new Error(`NETWORK_TIMEOUT: Failed to fetch Alpaca Paper orders (${err.message})`);
      }
    }

    // 2. Simulated Orders
    return this.simulatedOrders.map(o => ({ ...o }));
  }

  // --- Test & Simulation Helper Methods ---
  setSimulatedAccount(account: PaperAccountSnapshot | null): void {
    this.simulatedAccount = account;
  }

  setSimulatedPositions(positions: PaperPosition[]): void {
    this.simulatedPositions = positions;
  }

  setSimulatedOrders(orders: PaperOrderSnapshot[]): void {
    this.simulatedOrders = orders;
  }
}
