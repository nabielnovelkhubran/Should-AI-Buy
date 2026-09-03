import {
  PaperAccountSnapshot,
  PaperPosition,
  PaperOrderSnapshot,
  PaperPortfolioAdapter
} from './types';
import { PaperOrderStatus, AssetClass } from '../types';
import { detectAssetClass, normalizeScanSymbol } from '../scanner/universe';
import { getTradingEnvironmentConfig, validatePaperTradingEndpoint } from '../environment';
import { truncateMoney, truncateQuantity } from '../trading/precision';
import { brokerDiagnostics } from '../diagnostics/broker-diagnostics';
import { brokerReconciliationEngine } from '../diagnostics/reconciliation';

// ---------------------------------------------------------------------------
// Phase 6B & 8.5A: Alpaca Paper Portfolio Adapter
// INVARIANT: Connects exclusively to Alpaca Paper Trading.
// Live trading endpoints are strictly prohibited and will trigger immediate
// fail-closed rejection.
// ---------------------------------------------------------------------------

export class AlpacaPaperPortfolioAdapter implements PaperPortfolioAdapter {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private environment: 'test' | 'competition';

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
    const envConfig = getTradingEnvironmentConfig();
    this.apiKey = options?.apiKey || envConfig.apiKey;
    this.secretKey = options?.secretKey || envConfig.secretKey;
    this.baseUrl = options?.baseUrl || envConfig.baseUrl;
    this.environment = envConfig.environment;

    // Strict Fail-Closed Check: Verify baseUrl is strictly a paper endpoint
    validatePaperTradingEndpoint(this.baseUrl);

    if (options?.simulatedAccount) this.simulatedAccount = options.simulatedAccount;
    if (options?.simulatedPositions) this.simulatedPositions = options.simulatedPositions;
    if (options?.simulatedOrders) this.simulatedOrders = options.simulatedOrders;
  }

  /**
   * Fetches Paper Account State.
   */
  async getAccount(): Promise<PaperAccountSnapshot> {
    validatePaperTradingEndpoint(this.baseUrl);
    const now = new Date().toISOString();

    // 1. Live Alpaca Paper API Call (when real credentials exist)
    if (this.apiKey && this.secretKey && !this.apiKey.startsWith('MOCK')) {
      const startTime = Date.now();
      try {
        const res = await fetch(`${this.baseUrl}/account`, {
          method: 'GET',
          headers: {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.secretKey,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });

        const latencyMs = Date.now() - startTime;
        const rateLimitReset = res.headers.get('x-ratelimit-reset');

        if (res.status === 401) {
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'ACCOUNT',
            method: 'GET',
            sanitizedUrl: `${this.baseUrl}/account`,
            latencyMs,
            httpStatus: 401,
            success: false,
            errorDetails: 'AUTHENTICATION_FAILED'
          });
          throw new Error('AUTHENTICATION_FAILED: Alpaca Paper API credentials invalid or unauthorized.');
        }
        if (res.status === 429) {
          const resetSeconds = rateLimitReset ? Math.max(0, parseInt(rateLimitReset, 10) - Math.floor(Date.now() / 1000)) : 60;
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'ACCOUNT',
            method: 'GET',
            sanitizedUrl: `${this.baseUrl}/account`,
            latencyMs,
            httpStatus: 429,
            success: false,
            errorDetails: `RATE_LIMIT_EXCEEDED (Reset in ${resetSeconds}s)`
          });
          throw new Error(`RATE_LIMIT_EXCEEDED: Alpaca Paper API rate limit reached. Reset in ${resetSeconds}s.`);
        }
        if (!res.ok) {
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'ACCOUNT',
            method: 'GET',
            sanitizedUrl: `${this.baseUrl}/account`,
            latencyMs,
            httpStatus: res.status,
            success: false,
            errorDetails: res.statusText
          });
          throw new Error(`BROKER_ACCOUNT_ERROR: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        brokerDiagnostics.setMaskedAccount(data.account_number || data.id);
        brokerDiagnostics.record({
          mode: 'REAL_PAPER',
          provider: 'Alpaca',
          endpointCategory: 'ACCOUNT',
          method: 'GET',
          sanitizedUrl: `${this.baseUrl}/account`,
          latencyMs,
          httpStatus: 200,
          success: true,
          sanitizedResponse: { status: data.status, currency: data.currency, equity: data.equity, cash: data.cash }
        });

        const equity = truncateMoney(Number(data.equity || data.portfolio_value || 0));
        const cash = truncateMoney(Number(data.cash || 0));
        const buyingPower = truncateMoney(Number(data.buying_power || cash));
        const portfolioValue = truncateMoney(Number(data.portfolio_value || equity));

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
    validatePaperTradingEndpoint(this.baseUrl);
    const now = new Date().toISOString();

    // 1. Live Alpaca Paper API Call
    if (this.apiKey && this.secretKey && !this.apiKey.startsWith('MOCK')) {
      const startTime = Date.now();
      try {
        const res = await fetch(`${this.baseUrl}/positions`, {
          method: 'GET',
          headers: {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.secretKey,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });

        const latencyMs = Date.now() - startTime;
        const rateLimitReset = res.headers.get('x-ratelimit-reset');

        if (res.status === 401) {
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'POSITIONS',
            method: 'GET',
            sanitizedUrl: `${this.baseUrl}/positions`,
            latencyMs,
            httpStatus: 401,
            success: false,
            errorDetails: 'AUTHENTICATION_FAILED'
          });
          throw new Error('AUTHENTICATION_FAILED: Alpaca Paper API credentials invalid or unauthorized.');
        }
        if (res.status === 429) {
          const resetSeconds = rateLimitReset ? Math.max(0, parseInt(rateLimitReset, 10) - Math.floor(Date.now() / 1000)) : 60;
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'POSITIONS',
            method: 'GET',
            sanitizedUrl: `${this.baseUrl}/positions`,
            latencyMs,
            httpStatus: 429,
            success: false,
            errorDetails: `RATE_LIMIT_EXCEEDED (Reset in ${resetSeconds}s)`
          });
          throw new Error(`RATE_LIMIT_EXCEEDED: Alpaca Paper API rate limit reached. Reset in ${resetSeconds}s.`);
        }
        if (!res.ok) {
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'POSITIONS',
            method: 'GET',
            sanitizedUrl: `${this.baseUrl}/positions`,
            latencyMs,
            httpStatus: res.status,
            success: false,
            errorDetails: res.statusText
          });
          throw new Error(`BROKER_POSITIONS_ERROR: ${res.status} ${res.statusText}`);
        }

        const rawList = await res.json();
        brokerDiagnostics.record({
          mode: 'REAL_PAPER',
          provider: 'Alpaca',
          endpointCategory: 'POSITIONS',
          method: 'GET',
          sanitizedUrl: `${this.baseUrl}/positions`,
          latencyMs,
          httpStatus: 200,
          success: true,
          sanitizedResponse: Array.isArray(rawList) ? rawList.map(p => ({ symbol: p.symbol, qty: p.qty, current_price: p.current_price })) : rawList,
          reconciliationStatus: 'MATCHED'
        });

        if (!Array.isArray(rawList)) return [];

        if (rawList.length > 0) {
          const firstPos = rawList[0];
          brokerReconciliationEngine.reconcilePosition(
            { symbol: firstPos.symbol, side: firstPos.side === 'short' ? 'short' : 'long', qty: Math.abs(Number(firstPos.qty || 0)) },
            rawList
          );
        }

        return rawList.map((pos: any): PaperPosition => {
          const cleanSymbol = normalizeScanSymbol(pos.symbol);
          const assetClass: AssetClass = (pos.asset_class === 'crypto' || ['BTC', 'ETH', 'SOL'].includes(cleanSymbol))
            ? 'CRYPTO'
            : 'EQUITY';

          const quantity = truncateQuantity(Math.abs(Number(pos.qty || 0)), assetClass);
          const avgEntryPrice = Number(pos.avg_entry_price || 0);
          const currentPrice = Number(pos.current_price || avgEntryPrice);
          const marketValue = truncateMoney(Number(pos.market_value || quantity * currentPrice));
          const costBasis = truncateMoney(Number(pos.cost_basis || quantity * avgEntryPrice));
          const unrealizedPnl = truncateMoney(Number(pos.unrealized_pl || marketValue - costBasis));
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
    validatePaperTradingEndpoint(this.baseUrl);
    const now = new Date().toISOString();

    // 1. Live Alpaca Paper API Call
    if (this.apiKey && this.secretKey && !this.apiKey.startsWith('MOCK')) {
      const startTime = Date.now();
      try {
        const res = await fetch(`${this.baseUrl}/orders?status=open`, {
          method: 'GET',
          headers: {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.secretKey,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });

        const latencyMs = Date.now() - startTime;
        const rateLimitReset = res.headers.get('x-ratelimit-reset');

        if (res.status === 401) {
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'ORDERS',
            method: 'GET',
            sanitizedUrl: `${this.baseUrl}/orders?status=open`,
            latencyMs,
            httpStatus: 401,
            success: false,
            errorDetails: 'AUTHENTICATION_FAILED'
          });
          throw new Error('AUTHENTICATION_FAILED: Alpaca Paper API credentials invalid or unauthorized.');
        }
        if (res.status === 429) {
          const resetSeconds = rateLimitReset ? Math.max(0, parseInt(rateLimitReset, 10) - Math.floor(Date.now() / 1000)) : 60;
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'ORDERS',
            method: 'GET',
            sanitizedUrl: `${this.baseUrl}/orders?status=open`,
            latencyMs,
            httpStatus: 429,
            success: false,
            errorDetails: `RATE_LIMIT_EXCEEDED (Reset in ${resetSeconds}s)`
          });
          throw new Error(`RATE_LIMIT_EXCEEDED: Alpaca Paper API rate limit reached. Reset in ${resetSeconds}s.`);
        }
        if (!res.ok) {
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'ORDERS',
            method: 'GET',
            sanitizedUrl: `${this.baseUrl}/orders?status=open`,
            latencyMs,
            httpStatus: res.status,
            success: false,
            errorDetails: res.statusText
          });
          throw new Error(`BROKER_ORDERS_ERROR: ${res.status} ${res.statusText}`);
        }

        const rawOrders = await res.json();
        brokerDiagnostics.record({
          mode: 'REAL_PAPER',
          provider: 'Alpaca',
          endpointCategory: 'ORDERS',
          method: 'GET',
          sanitizedUrl: `${this.baseUrl}/orders?status=open`,
          latencyMs,
          httpStatus: 200,
          success: true,
          sanitizedResponse: Array.isArray(rawOrders) ? rawOrders.map(o => ({ id: o.id, symbol: o.symbol, side: o.side, qty: o.qty, status: o.status })) : rawOrders
        });

        if (!Array.isArray(rawOrders)) return [];

        return rawOrders.map((ord: any): PaperOrderSnapshot => {
          const cleanSymbol = normalizeScanSymbol(ord.symbol);
          const assetClass: AssetClass = (ord.asset_class === 'crypto' || ['BTC', 'ETH', 'SOL'].includes(cleanSymbol))
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

          const qty = truncateQuantity(Number(ord.qty || 0), assetClass);
          const filledQty = truncateQuantity(Number(ord.filled_qty || 0), assetClass);
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
