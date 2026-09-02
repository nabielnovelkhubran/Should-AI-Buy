import {
  PaperOrderRequest,
  PaperOrderResult,
  PaperTradingAdapter,
  PaperOrderStatus
} from './types';
import { truncateQuantity, formatWireNumber } from './precision';
import { getTradingEnvironmentConfig, validatePaperTradingEndpoint } from '../environment';
import { brokerDiagnostics } from '../diagnostics/broker-diagnostics';
import { brokerReconciliationEngine } from '../diagnostics/reconciliation';
import { alpacaDataAdapter } from '../market-data/alpaca-adapter';

// ---------------------------------------------------------------------------
// Phase 6A & 8.5A: Alpaca Paper Trading Adapter
// INVARIANT: Connects exclusively to Alpaca Paper Trading.
// Live trading endpoints are strictly prohibited and will trigger immediate
// fail-closed rejection.
// ---------------------------------------------------------------------------

const ALPACA_PAPER_BASE_URL = 'https://paper-api.alpaca.markets/v2';

export class AlpacaPaperTradingAdapter implements PaperTradingAdapter {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private environment: 'test' | 'competition';
  private inMemoryOrders: Map<string, PaperOrderResult> = new Map();

  constructor(options?: { apiKey?: string; secretKey?: string; baseUrl?: string }) {
    const envConfig = getTradingEnvironmentConfig();
    this.apiKey = options?.apiKey || envConfig.apiKey;
    this.secretKey = options?.secretKey || envConfig.secretKey;
    this.baseUrl = options?.baseUrl || envConfig.baseUrl;
    this.environment = envConfig.environment;

    // Strict Fail-Closed Check: Verify baseUrl is strictly a paper endpoint
    validatePaperTradingEndpoint(this.baseUrl);
  }

  async submitOrder(request: PaperOrderRequest): Promise<PaperOrderResult> {
    // Re-verify safety boundary
    validatePaperTradingEndpoint(this.baseUrl);

    const cleanSymbol = request.symbol.toUpperCase().replace(/^\$/, '').trim();
    const orderId = `ORD-${cleanSymbol}-${request.investigationId}`;
    const clientOrderId = `CL-${cleanSymbol}-${request.investigationId}`;
    const now = new Date().toISOString();

    // 1. Validation & Safety checks
    if (!request.riskGatePassed) {
      const blockedResult: PaperOrderResult = {
        orderId,
        clientOrderId,
        investigationId: request.investigationId,
        symbol: cleanSymbol,
        assetClass: request.assetClass,
        side: request.side,
        qty: request.qty,
        orderType: request.orderType || 'market',
        timeInForce: request.timeInForce || 'gtc',
        status: 'BLOCKED',
        riskGateStatus: 'BLOCKED',
        recommendation: request.recommendation,
        candidateRank: request.candidateRank,
        opportunityScore: request.opportunityScore,
        createdAt: now,
        adapterSource: 'alpaca-paper-v2',
        error: 'RISK_GATE_BLOCKED: Trade cannot be executed because Risk Gate did not pass.'
      };
      this.inMemoryOrders.set(orderId, blockedResult);
      return blockedResult;
    }

    if (request.recommendation !== 'BUY' && request.recommendation !== 'SELL') {
      const blockedResult: PaperOrderResult = {
        orderId,
        clientOrderId,
        investigationId: request.investigationId,
        symbol: cleanSymbol,
        assetClass: request.assetClass,
        side: request.side,
        qty: request.qty,
        orderType: request.orderType || 'market',
        timeInForce: request.timeInForce || 'gtc',
        status: 'BLOCKED',
        riskGateStatus: 'PASS',
        recommendation: request.recommendation,
        candidateRank: request.candidateRank,
        opportunityScore: request.opportunityScore,
        createdAt: now,
        adapterSource: 'alpaca-paper-v2',
        error: `INVALID_RECOMMENDATION: Council recommendation "${request.recommendation}" cannot be submitted as an order.`
      };
      this.inMemoryOrders.set(orderId, blockedResult);
      return blockedResult;
    }

    if (request.qty <= 0 || isNaN(request.qty) || !isFinite(request.qty)) {
      const failedResult: PaperOrderResult = {
        orderId,
        clientOrderId,
        investigationId: request.investigationId,
        symbol: cleanSymbol,
        assetClass: request.assetClass,
        side: request.side,
        qty: request.qty,
        orderType: request.orderType || 'market',
        timeInForce: request.timeInForce || 'gtc',
        status: 'FAILED',
        riskGateStatus: 'PASS',
        recommendation: request.recommendation,
        candidateRank: request.candidateRank,
        opportunityScore: request.opportunityScore,
        createdAt: now,
        adapterSource: 'alpaca-paper-v2',
        error: `INVALID_QUANTITY: Order quantity must be a positive finite number (received ${request.qty}).`
      };
      this.inMemoryOrders.set(orderId, failedResult);
      return failedResult;
    }

    // Existing Order Idempotency: Return cached order if already processed for this investigation
    const existing = this.inMemoryOrders.get(orderId);
    if (existing && existing.status !== 'BLOCKED' && existing.status !== 'FAILED') {
      return existing;
    }

    // Fail-Closed Validation: Time-in-Force requirements
    if (request.assetClass === 'CRYPTO') {
      const tif = (request.timeInForce || 'gtc').toLowerCase();
      if (tif !== 'gtc' && tif !== 'ioc') {
        const failedResult: PaperOrderResult = {
          orderId,
          clientOrderId,
          investigationId: request.investigationId,
          symbol: cleanSymbol,
          assetClass: request.assetClass,
          side: request.side,
          qty: request.qty,
          orderType: request.orderType || 'market',
          timeInForce: request.timeInForce || 'gtc',
          status: 'FAILED',
          riskGateStatus: 'PASS',
          recommendation: request.recommendation,
          candidateRank: request.candidateRank,
          opportunityScore: request.opportunityScore,
          createdAt: now,
          adapterSource: 'alpaca-paper-v2',
          error: `INVALID_CRYPTO_TIF: Alpaca Crypto orders only support "gtc" or "ioc" time-in-force (received "${request.timeInForce}").`
        };
        this.inMemoryOrders.set(orderId, failedResult);
        return failedResult;
      }
    }

    // Apply exact precision rules
    const safeQty = truncateQuantity(request.qty, request.assetClass);

    // 2. Submit to Alpaca Paper Trading API (or simulated paper environment)
    if (this.apiKey && this.secretKey && !this.apiKey.startsWith('MOCK')) {
      const startTime = Date.now();
      try {
        const isOption = request.assetClass === 'OPTION' || /^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(cleanSymbol);
        const isCrypto = request.assetClass === 'CRYPTO' || alpacaDataAdapter.isCryptoSymbol(cleanSymbol);
        const wireSymbol = isCrypto ? alpacaDataAdapter.normalizeCryptoSymbol(cleanSymbol) : cleanSymbol;
        const positionIntent = request.positionIntent || (isOption ? (request.side === 'buy' ? 'buy_to_open' : 'sell_to_close') : undefined);

        let finalWireQty = safeQty;
        if (isCrypto && request.price && request.price > 0 && finalWireQty * request.price < 10) {
          finalWireQty = truncateQuantity(Math.ceil((10.5 / request.price) * 1000) / 1000, 'CRYPTO');
        }

        const payload: Record<string, any> = {
          symbol: wireSymbol,
          qty: isOption ? Math.max(1, Math.round(finalWireQty)).toString() : formatWireNumber(finalWireQty),
          side: request.side,
          type: request.orderType || 'market',
          time_in_force: isOption ? 'day' : (request.timeInForce || (isCrypto ? 'gtc' : 'day')),
          client_order_id: clientOrderId
        };

        if (positionIntent) {
          payload.position_intent = positionIntent;
        }

        const res = await fetch(`${this.baseUrl}/orders`, {
          method: 'POST',
          headers: {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.secretKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const latencyMs = Date.now() - startTime;
        const rateLimitReset = res.headers.get('x-ratelimit-reset');

        if (res.status === 401) {
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'ORDERS',
            method: 'POST',
            sanitizedUrl: `${this.baseUrl}/orders`,
            latencyMs,
            httpStatus: 401,
            success: false,
            sanitizedRequest: payload,
            errorDetails: 'AUTHENTICATION_FAILED'
          });
          brokerReconciliationEngine.reconcileOrder(
            { symbol: cleanSymbol, side: request.side, qty: safeQty, orderType: request.orderType, orderId, clientOrderId },
            undefined
          );
          const failRes: PaperOrderResult = {
            orderId,
            clientOrderId,
            investigationId: request.investigationId,
            symbol: cleanSymbol,
            assetClass: request.assetClass,
            side: request.side,
            qty: safeQty,
            orderType: request.orderType || 'market',
            timeInForce: request.timeInForce || 'gtc',
            status: 'FAILED',
            riskGateStatus: 'PASS',
            recommendation: request.recommendation,
            candidateRank: request.candidateRank,
            opportunityScore: request.opportunityScore,
            createdAt: now,
            adapterSource: 'alpaca-paper-v2',
            error: 'AUTHENTICATION_FAILED: Alpaca Paper API credentials invalid or unauthorized.'
          };
          this.inMemoryOrders.set(orderId, failRes);
          return failRes;
        }

        if (res.status === 429) {
          const resetSeconds = rateLimitReset ? Math.max(0, parseInt(rateLimitReset, 10) - Math.floor(Date.now() / 1000)) : 60;
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'ORDERS',
            method: 'POST',
            sanitizedUrl: `${this.baseUrl}/orders`,
            latencyMs,
            httpStatus: 429,
            success: false,
            sanitizedRequest: payload,
            errorDetails: `RATE_LIMIT_EXCEEDED (Reset in ${resetSeconds}s)`
          });
          brokerReconciliationEngine.reconcileOrder(
            { symbol: cleanSymbol, side: request.side, qty: safeQty, orderType: request.orderType, orderId, clientOrderId },
            undefined
          );
          const failRes: PaperOrderResult = {
            orderId,
            clientOrderId,
            investigationId: request.investigationId,
            symbol: cleanSymbol,
            assetClass: request.assetClass,
            side: request.side,
            qty: safeQty,
            orderType: request.orderType || 'market',
            timeInForce: request.timeInForce || 'gtc',
            status: 'FAILED',
            riskGateStatus: 'PASS',
            recommendation: request.recommendation,
            candidateRank: request.candidateRank,
            opportunityScore: request.opportunityScore,
            createdAt: now,
            adapterSource: 'alpaca-paper-v2',
            error: `RATE_LIMIT_EXCEEDED: Alpaca Paper API rate limit reached. Reset in ${resetSeconds}s.`
          };
          this.inMemoryOrders.set(orderId, failRes);
          return failRes;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          brokerDiagnostics.record({
            mode: 'REAL_PAPER',
            provider: 'Alpaca',
            endpointCategory: 'ORDERS',
            method: 'POST',
            sanitizedUrl: `${this.baseUrl}/orders`,
            latencyMs,
            httpStatus: res.status,
            success: false,
            sanitizedRequest: payload,
            sanitizedResponse: errData,
            errorDetails: errData.message || res.statusText
          });
          brokerReconciliationEngine.reconcileOrder(
            { symbol: cleanSymbol, side: request.side, qty: safeQty, orderType: request.orderType, orderId, clientOrderId },
            { id: 'REJECTED', symbol: cleanSymbol, side: request.side, qty: safeQty, status: 'rejected' }
          );
          const failRes: PaperOrderResult = {
            orderId,
            clientOrderId,
            investigationId: request.investigationId,
            symbol: cleanSymbol,
            assetClass: request.assetClass,
            side: request.side,
            qty: safeQty,
            orderType: request.orderType || 'market',
            timeInForce: request.timeInForce || 'gtc',
            status: 'REJECTED',
            riskGateStatus: 'PASS',
            recommendation: request.recommendation,
            candidateRank: request.candidateRank,
            opportunityScore: request.opportunityScore,
            createdAt: now,
            adapterSource: 'alpaca-paper-v2',
            error: `BROKER_REJECTED: ${errData.message || res.statusText || 'Broker rejected order request'}`
          };
          this.inMemoryOrders.set(orderId, failRes);
          return failRes;
        }

        const brokerData = await res.json();
        const paperStatus: PaperOrderStatus = brokerData.status === 'filled' ? 'FILLED' : 'SUBMITTED';

        brokerDiagnostics.record({
          mode: 'REAL_PAPER',
          provider: 'Alpaca',
          endpointCategory: 'ORDERS',
          method: 'POST',
          sanitizedUrl: `${this.baseUrl}/orders`,
          latencyMs,
          httpStatus: 200,
          success: true,
          sanitizedRequest: payload,
          sanitizedResponse: { id: brokerData.id, status: brokerData.status, filled_qty: brokerData.filled_qty, filled_avg_price: brokerData.filled_avg_price },
          brokerOrderId: brokerData.id,
          reconciliationStatus: 'MATCHED'
        });

        brokerReconciliationEngine.reconcileOrder(
          { symbol: cleanSymbol, side: request.side, qty: safeQty, orderType: request.orderType, orderId, clientOrderId },
          brokerData
        );

        const successResult: PaperOrderResult = {
          orderId,
          brokerOrderId: brokerData.id,
          clientOrderId,
          investigationId: request.investigationId,
          symbol: cleanSymbol,
          assetClass: request.assetClass,
          side: request.side,
          qty: safeQty,
          orderType: request.orderType || 'market',
          timeInForce: request.timeInForce || 'gtc',
          status: paperStatus,
          riskGateStatus: 'PASS',
          recommendation: request.recommendation,
          candidateRank: request.candidateRank,
          opportunityScore: request.opportunityScore,
          createdAt: now,
          submittedAt: brokerData.submitted_at || now,
          filledAvgPrice: brokerData.filled_avg_price ? Number(brokerData.filled_avg_price) : undefined,
          adapterSource: 'alpaca-paper-v2'
        };

        this.inMemoryOrders.set(orderId, successResult);
        return successResult;
      } catch (networkErr: any) {
        const failRes: PaperOrderResult = {
          orderId,
          clientOrderId,
          investigationId: request.investigationId,
          symbol: cleanSymbol,
          assetClass: request.assetClass,
          side: request.side,
          qty: safeQty,
          orderType: request.orderType || 'market',
          timeInForce: request.timeInForce || 'gtc',
          status: 'FAILED',
          riskGateStatus: 'PASS',
          recommendation: request.recommendation,
          candidateRank: request.candidateRank,
          opportunityScore: request.opportunityScore,
          createdAt: now,
          adapterSource: 'alpaca-paper-v2',
          error: `NETWORK_TIMEOUT: Failed to reach Alpaca Paper API (${networkErr.message})`
        };
        this.inMemoryOrders.set(orderId, failRes);
        return failRes;
      }
    }

    // 3. Fallback Paper Simulation Environment (Deterministic Mock for Offline / Paper Tests)
    const simulatedBrokerOrderId = `ALP-PAPER-${cleanSymbol}-${request.investigationId}`;
    const result: PaperOrderResult = {
      orderId,
      brokerOrderId: simulatedBrokerOrderId,
      clientOrderId,
      investigationId: request.investigationId,
      symbol: cleanSymbol,
      assetClass: request.assetClass,
      side: request.side,
      qty: safeQty,
      orderType: request.orderType || 'market',
      timeInForce: request.timeInForce || 'gtc',
      status: 'SUBMITTED', // Explicitly SUBMITTED (not automatically FILLED)
      riskGateStatus: 'PASS',
      recommendation: request.recommendation,
      candidateRank: request.candidateRank,
      opportunityScore: request.opportunityScore,
      createdAt: now,
      submittedAt: now,
      adapterSource: 'alpaca-paper-v2'
    };

    this.inMemoryOrders.set(orderId, result);
    return result;
  }

  async getOrder(orderId: string): Promise<PaperOrderResult | undefined> {
    return this.inMemoryOrders.get(orderId);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.inMemoryOrders.get(orderId);
    if (!order) return false;
    if (order.status === 'SUBMITTED' || order.status === 'INTENT_CREATED') {
      order.status = 'CANCELED';
      return true;
    }
    return false;
  }

  async getOrders(): Promise<PaperOrderResult[]> {
    return Array.from(this.inMemoryOrders.values());
  }

  clearOrders(): void {
    this.inMemoryOrders.clear();
  }
}
