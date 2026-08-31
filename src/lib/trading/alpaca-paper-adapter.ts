import {
  PaperOrderRequest,
  PaperOrderResult,
  PaperTradingAdapter,
  PaperOrderStatus
} from './types';

// ---------------------------------------------------------------------------
// Phase 6A: Alpaca Paper Trading Adapter
// INVARIANT: Connects exclusively to Alpaca Paper Trading.
// Live trading endpoints are strictly prohibited and will trigger immediate
// fail-closed rejection.
// ---------------------------------------------------------------------------

const ALPACA_PAPER_BASE_URL = 'https://paper-api.alpaca.markets/v2';
const PROHIBITED_LIVE_ENDPOINT_PATTERN = /https:\/\/(?!paper-)api\.alpaca\.markets/i;

export class AlpacaPaperTradingAdapter implements PaperTradingAdapter {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private inMemoryOrders: Map<string, PaperOrderResult> = new Map();

  constructor(options?: { apiKey?: string; secretKey?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '';
    this.secretKey = options?.secretKey || process.env.ALPACA_SECRET_KEY || process.env.APCA_API_SECRET_KEY || '';
    this.baseUrl = options?.baseUrl || process.env.ALPACA_PAPER_BASE_URL || ALPACA_PAPER_BASE_URL;

    // Strict Fail-Closed Check: Verify baseUrl is strictly a paper endpoint
    this.validatePaperEndpoint(this.baseUrl);
  }

  private validatePaperEndpoint(url: string): void {
    if (PROHIBITED_LIVE_ENDPOINT_PATTERN.test(url)) {
      throw new Error(
        'CRITICAL_SAFETY_VIOLATION: Live Alpaca trading endpoint detected. Phase 6A execution strictly prohibits live broker execution.'
      );
    }

    if (!url.toLowerCase().includes('paper')) {
      throw new Error(
        'CRITICAL_SAFETY_VIOLATION: Non-paper trading endpoint configured. Must explicitly contain "paper".'
      );
    }
  }

  async submitOrder(request: PaperOrderRequest): Promise<PaperOrderResult> {
    // Re-verify safety boundary
    this.validatePaperEndpoint(this.baseUrl);

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
        error: `NON_EXECUTABLE_RECOMMENDATION: ${request.recommendation} verdict does not generate order intent.`
      };
      this.inMemoryOrders.set(orderId, blockedResult);
      return blockedResult;
    }

    if (request.qty <= 0 || !Number.isFinite(request.qty)) {
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
        status: 'REJECTED',
        riskGateStatus: 'PASS',
        recommendation: request.recommendation,
        candidateRank: request.candidateRank,
        opportunityScore: request.opportunityScore,
        createdAt: now,
        adapterSource: 'alpaca-paper-v2',
        error: `INVALID_QUANTITY: Calculated order quantity (${request.qty}) must be a positive finite number.`
      };
      this.inMemoryOrders.set(orderId, failedResult);
      return failedResult;
    }

    // 2. Submit to Alpaca Paper Trading API (or simulated paper environment)
    if (this.apiKey && this.secretKey && !this.apiKey.startsWith('MOCK')) {
      try {
        const payload = {
          symbol: cleanSymbol,
          qty: request.qty,
          side: request.side,
          type: request.orderType || 'market',
          time_in_force: request.timeInForce || 'gtc',
          client_order_id: clientOrderId
        };

        const res = await fetch(`${this.baseUrl}/orders`, {
          method: 'POST',
          headers: {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.secretKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.status === 401) {
          const failRes: PaperOrderResult = {
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
            error: 'AUTHENTICATION_FAILED: Alpaca Paper API credentials invalid or unauthorized.'
          };
          this.inMemoryOrders.set(orderId, failRes);
          return failRes;
        }

        if (res.status === 429) {
          const failRes: PaperOrderResult = {
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
            error: 'RATE_LIMIT_EXCEEDED: Alpaca Paper API rate limit reached.'
          };
          this.inMemoryOrders.set(orderId, failRes);
          return failRes;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const failRes: PaperOrderResult = {
            orderId,
            clientOrderId,
            investigationId: request.investigationId,
            symbol: cleanSymbol,
            assetClass: request.assetClass,
            side: request.side,
            qty: request.qty,
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

        const successResult: PaperOrderResult = {
          orderId,
          brokerOrderId: brokerData.id,
          clientOrderId,
          investigationId: request.investigationId,
          symbol: cleanSymbol,
          assetClass: request.assetClass,
          side: request.side,
          qty: request.qty,
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
      qty: request.qty,
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
