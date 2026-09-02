import {
  PaperOrderRequest,
  PaperOrderResult,
  PaperTradingAdapter,
  PaperOrderStatus
} from '../trading/types';
import { truncateQuantity } from '../trading/precision';
import { SimulationScenario } from './types';
import { brokerDiagnostics } from '../diagnostics/broker-diagnostics';

// ---------------------------------------------------------------------------
// Phase 8.16: Simulation Trading Adapter
// Executes simulated orders with configurable scenario behavior.
// INVARIANT: Zero HTTP requests to Alpaca. Completely isolated.
// INVARIANT: All order IDs use SIM- prefix.
// ---------------------------------------------------------------------------

export class SimulationTradingAdapter implements PaperTradingAdapter {
  private activeScenario: SimulationScenario = 'SUCCESSFUL_BUY';
  private orders: Map<string, PaperOrderResult> = new Map();

  public setScenario(scenario: SimulationScenario): void {
    this.activeScenario = scenario;
  }

  public getScenario(): SimulationScenario {
    return this.activeScenario;
  }

  async submitOrder(request: PaperOrderRequest): Promise<PaperOrderResult> {
    const startTime = Date.now();
    const cleanSymbol = request.symbol.toUpperCase().replace(/^\$/, '').trim();
    const orderId = `SIM-ORD-${cleanSymbol}-${request.investigationId}`;
    const clientOrderId = `SIM-CL-${cleanSymbol}-${request.investigationId}`;
    const brokerOrderId = `SIM-BROKER-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();

    const safeQty = truncateQuantity(request.qty, request.assetClass);

    // 1. Validation & Safety Checks
    if (!request.riskGatePassed) {
      const blockedResult: PaperOrderResult = {
        orderId,
        clientOrderId,
        investigationId: request.investigationId,
        symbol: cleanSymbol,
        assetClass: request.assetClass,
        side: request.side,
        qty: safeQty,
        orderType: request.orderType || 'market',
        timeInForce: request.timeInForce || 'gtc',
        status: 'BLOCKED',
        riskGateStatus: 'BLOCKED',
        recommendation: request.recommendation,
        candidateRank: request.candidateRank,
        opportunityScore: request.opportunityScore,
        createdAt: now,
        adapterSource: 'simulation-lab',
        error: 'RISK_GATE_BLOCKED: Trade cannot be executed because Risk Gate did not pass.'
      };
      this.orders.set(orderId, blockedResult);
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
        status: 'FAILED',
        riskGateStatus: 'PASS',
        recommendation: request.recommendation,
        candidateRank: request.candidateRank,
        opportunityScore: request.opportunityScore,
        createdAt: now,
        adapterSource: 'simulation-lab',
        error: `INVALID_QUANTITY: Calculated order quantity (${request.qty}) must be a positive finite number.`
      };
      this.orders.set(orderId, failedResult);
      return failedResult;
    }

    // 2. Scenario-Driven Simulated Broker Behavior
    const latencyMs = Math.floor(Math.random() * 20) + 15; // Realistic 15-35ms mock latency

    if (this.activeScenario === 'BUY_REJECTED') {
      brokerDiagnostics.record({
        mode: 'SIMULATION',
        provider: 'SimulationLab',
        endpointCategory: 'ORDERS',
        method: 'POST',
        sanitizedUrl: 'https://simulation-lab/v2/orders',
        latencyMs,
        httpStatus: 400,
        success: false,
        sanitizedRequest: { symbol: cleanSymbol, qty: safeQty, side: request.side },
        sanitizedResponse: { message: 'SIMULATED_REJECTION: Insufficient margin or trading halted on symbol' },
        errorDetails: 'SIMULATED_REJECTION'
      });

      const rejectedResult: PaperOrderResult = {
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
        adapterSource: 'simulation-lab',
        error: 'SIMULATED_BROKER_REJECTED: Broker simulated order rejection.'
      };
      this.orders.set(orderId, rejectedResult);
      return rejectedResult;
    }

    if (this.activeScenario === 'TIMEOUT') {
      brokerDiagnostics.record({
        mode: 'SIMULATION',
        provider: 'SimulationLab',
        endpointCategory: 'ORDERS',
        method: 'POST',
        sanitizedUrl: 'https://simulation-lab/v2/orders',
        latencyMs: 5000,
        httpStatus: 504,
        success: false,
        sanitizedRequest: { symbol: cleanSymbol, qty: safeQty, side: request.side },
        errorDetails: 'SIMULATED_GATEWAY_TIMEOUT'
      });

      const timeoutResult: PaperOrderResult = {
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
        adapterSource: 'simulation-lab',
        error: 'SIMULATED_TIMEOUT: Upstream broker gateway timeout.'
      };
      this.orders.set(orderId, timeoutResult);
      return timeoutResult;
    }

    if (this.activeScenario === 'BROKER_ERROR') {
      brokerDiagnostics.record({
        mode: 'SIMULATION',
        provider: 'SimulationLab',
        endpointCategory: 'ORDERS',
        method: 'POST',
        sanitizedUrl: 'https://simulation-lab/v2/orders',
        latencyMs,
        httpStatus: 500,
        success: false,
        sanitizedRequest: { symbol: cleanSymbol, qty: safeQty, side: request.side },
        errorDetails: 'SIMULATED_INTERNAL_BROKER_ERROR'
      });

      const errResult: PaperOrderResult = {
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
        adapterSource: 'simulation-lab',
        error: 'SIMULATED_BROKER_500: Internal server error simulated at broker.'
      };
      this.orders.set(orderId, errResult);
      return errResult;
    }

    if (this.activeScenario === 'CANCELLED') {
      brokerDiagnostics.record({
        mode: 'SIMULATION',
        provider: 'SimulationLab',
        endpointCategory: 'ORDERS',
        method: 'POST',
        sanitizedUrl: 'https://simulation-lab/v2/orders',
        latencyMs,
        httpStatus: 200,
        success: true,
        sanitizedRequest: { symbol: cleanSymbol, qty: safeQty, side: request.side },
        sanitizedResponse: { id: brokerOrderId, status: 'canceled' },
        brokerOrderId
      });

      const cancelResult: PaperOrderResult = {
        orderId,
        brokerOrderId,
        clientOrderId,
        investigationId: request.investigationId,
        symbol: cleanSymbol,
        assetClass: request.assetClass,
        side: request.side,
        qty: safeQty,
        orderType: request.orderType || 'market',
        timeInForce: request.timeInForce || 'gtc',
        status: 'CANCELED',
        riskGateStatus: 'PASS',
        recommendation: request.recommendation,
        candidateRank: request.candidateRank,
        opportunityScore: request.opportunityScore,
        createdAt: now,
        adapterSource: 'simulation-lab'
      };
      this.orders.set(orderId, cancelResult);
      return cancelResult;
    }

    if (this.activeScenario === 'PARTIAL_FILL') {
      const filledQty = truncateQuantity(safeQty * 0.5, request.assetClass);
      brokerDiagnostics.record({
        mode: 'SIMULATION',
        provider: 'SimulationLab',
        endpointCategory: 'ORDERS',
        method: 'POST',
        sanitizedUrl: 'https://simulation-lab/v2/orders',
        latencyMs,
        httpStatus: 200,
        success: true,
        sanitizedRequest: { symbol: cleanSymbol, qty: safeQty, side: request.side },
        sanitizedResponse: { id: brokerOrderId, status: 'partially_filled', filled_qty: filledQty },
        brokerOrderId
      });

      const partialResult: PaperOrderResult = {
        orderId,
        brokerOrderId,
        clientOrderId,
        investigationId: request.investigationId,
        symbol: cleanSymbol,
        assetClass: request.assetClass,
        side: request.side,
        qty: safeQty,
        orderType: request.orderType || 'market',
        timeInForce: request.timeInForce || 'gtc',
        status: 'PARTIALLY_FILLED',
        riskGateStatus: 'PASS',
        recommendation: request.recommendation,
        candidateRank: request.candidateRank,
        opportunityScore: request.opportunityScore,
        createdAt: now,
        submittedAt: now,
        adapterSource: 'simulation-lab'
      };
      this.orders.set(orderId, partialResult);
      return partialResult;
    }

    // Default: SUCCESSFUL_BUY -> Immediate FILLED
    brokerDiagnostics.record({
      mode: 'SIMULATION',
      provider: 'SimulationLab',
      endpointCategory: 'ORDERS',
      method: 'POST',
      sanitizedUrl: 'https://simulation-lab/v2/orders',
      latencyMs,
      httpStatus: 200,
      success: true,
      sanitizedRequest: { symbol: cleanSymbol, qty: safeQty, side: request.side },
      sanitizedResponse: { id: brokerOrderId, status: 'filled', filled_qty: safeQty },
      brokerOrderId
    });

    const filledResult: PaperOrderResult = {
      orderId,
      brokerOrderId,
      clientOrderId,
      investigationId: request.investigationId,
      symbol: cleanSymbol,
      assetClass: request.assetClass,
      side: request.side,
      qty: safeQty,
      orderType: request.orderType || 'market',
      timeInForce: request.timeInForce || 'gtc',
      status: 'FILLED',
      riskGateStatus: 'PASS',
      recommendation: request.recommendation,
      candidateRank: request.candidateRank,
      opportunityScore: request.opportunityScore,
      createdAt: now,
      submittedAt: now,
      adapterSource: 'simulation-lab'
    };
    this.orders.set(orderId, filledResult);
    return filledResult;
  }

  async getOrder(orderId: string): Promise<PaperOrderResult | undefined> {
    return this.orders.get(orderId);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const ord = this.orders.get(orderId);
    if (!ord) return false;
    ord.status = 'CANCELED';
    return true;
  }

  async getOrders(): Promise<PaperOrderResult[]> {
    return Array.from(this.orders.values());
  }

  public clear(): void {
    this.orders.clear();
  }
}

const g = globalThis as any;
if (!g.__SIMULATION_TRADING_ADAPTER__) {
  g.__SIMULATION_TRADING_ADAPTER__ = new SimulationTradingAdapter();
}

export const simulationTradingAdapter: SimulationTradingAdapter = g.__SIMULATION_TRADING_ADAPTER__;


