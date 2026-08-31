import {
  PaperOrderRequest,
  PaperOrderResult,
  PaperTradingAdapter,
  PaperExecutionRecord
} from './types';
import { AlpacaPaperTradingAdapter } from './alpaca-paper-adapter';
import { Investigation, AssetClass, DecisionState } from '../types';
import { calculatePositionSize } from '../quant';
import { detectAssetClass, normalizeScanSymbol } from '../scanner/universe';

// ---------------------------------------------------------------------------
// Phase 6A: Paper Trading Service
// Enforces deterministic Risk Gate safety, position sizing verification,
// idempotency / duplicate protection, and paper broker coordination.
// ---------------------------------------------------------------------------

export class PaperTradingService {
  private adapter: PaperTradingAdapter;
  private idempotencyCache: Map<string, PaperOrderResult> = new Map();

  constructor(adapter?: PaperTradingAdapter) {
    this.adapter = adapter || new AlpacaPaperTradingAdapter();
  }

  /**
   * Submits a validated paper order request with idempotency protection.
   */
  async submitPaperOrder(request: PaperOrderRequest): Promise<PaperOrderResult> {
    const cleanSymbol = normalizeScanSymbol(request.symbol);
    const idempotencyKey = `EXEC-${request.investigationId}-${cleanSymbol}-${request.side}`;

    // 1. Idempotency Check: Return existing order state if already executed
    const existing = this.idempotencyCache.get(idempotencyKey);
    if (existing) {
      return existing;
    }

    // 2. Submit to Paper Trading Adapter
    const result = await this.adapter.submitOrder({
      ...request,
      symbol: cleanSymbol
    });

    // 3. Cache result for idempotency protection
    this.idempotencyCache.set(idempotencyKey, result);
    return result;
  }

  /**
   * Executes a paper trade from an authoritative Council Investigation.
   * Strictly verifies Risk Gate PASS and recommendation suitability.
   */
  async executeInvestigation(
    investigation: Investigation,
    options?: { accountCash?: number }
  ): Promise<PaperOrderResult> {
    const cleanSymbol = normalizeScanSymbol(investigation.asset);
    const decision = investigation.decision;
    const now = new Date().toISOString();
    const orderId = `ORD-${cleanSymbol}-${investigation.id}`;
    const clientOrderId = `CL-${cleanSymbol}-${investigation.id}`;
    const assetClass: AssetClass = (['BTC', 'ETH', 'SOL'].includes(cleanSymbol) ? 'CRYPTO' : 'EQUITY');

    // 1. Strict Server-Side Validation: Investigation must exist and have decision
    if (!decision) {
      const errRes: PaperOrderResult = {
        orderId,
        clientOrderId,
        investigationId: investigation.id,
        symbol: cleanSymbol,
        assetClass,
        side: 'buy',
        qty: 0,
        orderType: 'market',
        timeInForce: 'gtc',
        status: 'BLOCKED',
        riskGateStatus: 'BLOCKED',
        recommendation: 'REJECT',
        createdAt: now,
        adapterSource: 'alpaca-paper-v2',
        error: 'NO_DECISION: Investigation has not synthesized a final council decision.'
      };
      return errRes;
    }

    // 2. Strict Risk Gate Check: Must be explicitly approved
    if (!decision.riskGateApproved) {
      const blockedRes: PaperOrderResult = {
        orderId,
        clientOrderId,
        investigationId: investigation.id,
        symbol: cleanSymbol,
        assetClass,
        side: decision.conclusion === 'SELL' ? 'sell' : 'buy',
        qty: 0,
        orderType: 'market',
        timeInForce: 'gtc',
        status: 'BLOCKED',
        riskGateStatus: 'BLOCKED',
        recommendation: decision.conclusion,
        opportunityScore: decision.opportunityScore,
        createdAt: now,
        adapterSource: 'alpaca-paper-v2',
        error: 'RISK_GATE_BLOCKED: Trade cannot be executed because Risk Gate did not pass.'
      };
      return blockedRes;
    }

    // 3. Recommendation Check: Only BUY and SELL can create orders
    if (decision.conclusion !== 'BUY' && decision.conclusion !== 'SELL') {
      const blockedRes: PaperOrderResult = {
        orderId,
        clientOrderId,
        investigationId: investigation.id,
        symbol: cleanSymbol,
        assetClass,
        side: 'buy',
        qty: 0,
        orderType: 'market',
        timeInForce: 'gtc',
        status: 'BLOCKED',
        riskGateStatus: 'PASS',
        recommendation: decision.conclusion,
        opportunityScore: decision.opportunityScore,
        createdAt: now,
        adapterSource: 'alpaca-paper-v2',
        error: `NON_EXECUTABLE_RECOMMENDATION: ${decision.conclusion} verdict does not generate order intent.`
      };
      return blockedRes;
    }

    // 4. Derive Position Sizing deterministically
    const price = investigation.snapshot?.price || 100;
    const availableCash = options?.accountCash || 100000;
    const sizing = calculatePositionSize(availableCash, 2.5, price, 5.0);

    const side: 'buy' | 'sell' = decision.conclusion === 'SELL' ? 'sell' : 'buy';
    const candidateRank = investigation.metadata?.candidateRank;
    const opportunityScore = decision.opportunityScore;

    const request: PaperOrderRequest = {
      investigationId: investigation.id,
      symbol: cleanSymbol,
      assetClass,
      side,
      qty: sizing.qty,
      price,
      orderType: 'market',
      timeInForce: 'gtc',
      recommendation: decision.conclusion,
      riskGatePassed: decision.riskGateApproved,
      opportunityScore,
      candidateRank
    };

    // 5. Submit with Idempotency Protection
    const orderResult = await this.submitPaperOrder(request);

    // 6. Attach execution record to investigation
    const executionRecord: PaperExecutionRecord = {
      mode: 'PAPER',
      adapterSource: orderResult.adapterSource,
      orderId: orderResult.orderId,
      brokerOrderId: orderResult.brokerOrderId,
      submittedAt: orderResult.submittedAt || now,
      status: orderResult.status,
      error: orderResult.error
    };

    investigation.execution = executionRecord;
    if (orderResult.status === 'SUBMITTED' || orderResult.status === 'FILLED') {
      decision.tradeExecuted = true;
      decision.orderId = orderResult.orderId;
    }

    return orderResult;
  }

  async getOrder(orderId: string): Promise<PaperOrderResult | undefined> {
    return this.adapter.getOrder(orderId);
  }

  async getOrders(): Promise<PaperOrderResult[]> {
    return this.adapter.getOrders();
  }

  clear(): void {
    this.idempotencyCache.clear();
    if (typeof (this.adapter as any).clearOrders === 'function') {
      (this.adapter as any).clearOrders();
    }
  }
}

/** Singleton instance of PaperTradingService */
export const paperTradingService = new PaperTradingService();
export * from './types';
export * from './alpaca-paper-adapter';
