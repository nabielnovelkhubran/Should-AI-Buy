import { AssetClass } from '../../types';
import { MarketRegimeType, StrategyType } from '../regime';
import { FactorBreakdown } from '../strategy';
import {
  TradeRecord,
  TradeOutcome,
  TradeDirection,
  ExitReason,
  RejectedCandidateRecord,
  RejectionStage
} from './types';

// ---------------------------------------------------------------------------
// Phase 8.8 & 8.10: In-Memory Trade Ledger
// INVARIANT: Records every paper trade lifecycle. No credentials stored.
// INVARIANT: All metrics computed from actual recorded outcomes only.
// INVARIANT: No lookahead - entry-time data frozen at decision time.
// INVARIANT: Actual R computed from confirmed broker fills whenever available.
// INVARIANT: Direction assumption is explicit (strictly LONG in spot domain).
// ---------------------------------------------------------------------------

export interface EntryIntentParams {
  tradeId: string;
  candidateId: string;
  decisionId: string;
  symbol: string;
  assetClass: AssetClass;
  instrumentType?: 'EQUITY' | 'CRYPTO' | 'OPTION';
  direction?: TradeDirection;
  strategy: StrategyType | string;
  marketRegime: MarketRegimeType;
  opportunityScore: number;
  aiConfidence: number;
  estimatedRiskReward: number;
  factorScores?: FactorBreakdown;
  requestedQuantity: number;
  approvedQuantity: number;
  entryPrice: number;
  invalidationPrice: number;
  targetPrice: number;
  spreadAtEntryBps?: number;
  portfolioEquityAtEntry: number;
  grossExposureAtEntry: number;
  orderId?: string;
  clientOrderId?: string;
}

export interface FillUpdateParams {
  tradeId: string;
  orderId?: string;
  actualFillPrice: number;
  actualFilledQuantity: number;
}

export interface ExitParams {
  tradeId: string;
  exitPrice: number;
  exitFilledQuantity: number;
  exitReason: ExitReason;
  spreadAtExitBps?: number;
  portfolioEquityAtExit: number;
  grossExposureAtExit: number;
}

export interface RejectionParams {
  candidateId: string;
  cycleId: string;
  symbol: string;
  assetClass: AssetClass;
  strategy?: StrategyType | string;
  marketRegime?: MarketRegimeType;
  opportunityScore?: number;
  aiConfidence?: number;
  estimatedRiskReward?: number;
  rejectionStage: RejectionStage;
  rejectionReason: string;
}

function computeInitialRisk(entryPrice: number, invalidationPrice: number, quantity: number): number {
  return Math.abs(entryPrice - invalidationPrice) * quantity;
}

function computeOutcome(pnl: number): TradeOutcome {
  if (pnl > 0.01) return 'WIN';
  if (pnl < -0.01) return 'LOSS';
  return 'BREAKEVEN';
}

function computeRealizedPnL(direction: TradeDirection, entryPrice: number, exitPrice: number, quantity: number): number {
  if (direction === 'SHORT') {
    return (entryPrice - exitPrice) * quantity;
  }
  return (exitPrice - entryPrice) * quantity;
}

export class TradeLedger {
  private trades: Map<string, TradeRecord> = new Map();
  private rejections: RejectedCandidateRecord[] = [];
  private readonly maxHistory: number;
  private seqCounter: number = 0;

  constructor(maxHistory: number = 2000) {
    this.maxHistory = maxHistory;
  }

  recordEntryIntent(params: EntryIntentParams): TradeRecord {
    const now = new Date().toISOString();
    const instrumentType = params.instrumentType ?? (params.assetClass === 'CRYPTO' ? 'CRYPTO' : 'EQUITY');
    const direction: TradeDirection = params.direction ?? 'LONG';
    const initialRiskAmountUsd = computeInitialRisk(
      params.entryPrice,
      params.invalidationPrice,
      params.approvedQuantity
    );
    const record: TradeRecord = {
      tradeId: params.tradeId,
      candidateId: params.candidateId,
      decisionId: params.decisionId,
      orderId: params.orderId,
      clientOrderId: params.clientOrderId,
      symbol: params.symbol.toUpperCase(),
      assetClass: params.assetClass,
      instrumentType,
      direction,
      strategy: params.strategy,
      marketRegime: params.marketRegime,
      opportunityScore: params.opportunityScore,
      aiConfidence: params.aiConfidence,
      estimatedRiskReward: params.estimatedRiskReward,
      factorScores: params.factorScores,
      requestedQuantity: params.requestedQuantity,
      approvedQuantity: params.approvedQuantity,
      entryPrice: params.entryPrice,
      entryTimestamp: now,
      invalidationPrice: params.invalidationPrice,
      targetPrice: params.targetPrice,
      initialRiskAmountUsd,
      spreadAtEntryBps: params.spreadAtEntryBps,
      portfolioEquityAtEntry: params.portfolioEquityAtEntry,
      grossExposureAtEntry: params.grossExposureAtEntry,
      isGrossPnL: true,
      outcome: 'OPEN',
      recordedAt: now,
      updatedAt: now
    };
    this.trades.set(params.tradeId, record);
    this.trimIfNeeded();
    return record;
  }

  recordFill(params: FillUpdateParams): TradeRecord | null {
    const record = this.trades.get(params.tradeId);
    if (!record) return null;
    record.actualFillPrice = params.actualFillPrice;
    record.actualFilledQuantity = params.actualFilledQuantity;
    if (params.orderId) record.orderId = params.orderId;
    // Update initialRiskAmountUsd using actual confirmed fill price and quantity
    record.initialRiskAmountUsd = computeInitialRisk(
      params.actualFillPrice,
      record.invalidationPrice,
      params.actualFilledQuantity
    );
    record.updatedAt = new Date().toISOString();
    return record;
  }

  recordExit(params: ExitParams): TradeRecord | null {
    const record = this.trades.get(params.tradeId);
    if (!record) return null;
    const exitNow = new Date().toISOString();
    const entryPrice = record.actualFillPrice ?? record.entryPrice;
    const exitQty = params.exitFilledQuantity;
    const realizedPnL = computeRealizedPnL(record.direction, entryPrice, params.exitPrice, exitQty);
    const costBasis = entryPrice * exitQty;
    const realizedPnLPct = costBasis > 0 ? (realizedPnL / costBasis) * 100 : 0;

    const effectiveEntryPrice = record.actualFillPrice ?? record.entryPrice;
    const effectiveQty = record.actualFilledQuantity ?? record.approvedQuantity;
    const initialRisk = record.initialRiskAmountUsd > 0
      ? record.initialRiskAmountUsd
      : computeInitialRisk(effectiveEntryPrice, record.invalidationPrice, effectiveQty);

    let actualR: number | undefined;
    if (initialRisk > 0) {
      actualR = realizedPnL / initialRisk;
    }
    const entryMs = new Date(record.entryTimestamp).getTime();
    const exitMs = new Date(exitNow).getTime();
    const holdingDurationMs = Math.max(0, exitMs - entryMs);
    record.exitPrice = params.exitPrice;
    record.exitFilledQuantity = params.exitFilledQuantity;
    record.exitTimestamp = exitNow;
    record.exitReason = params.exitReason;
    record.spreadAtExitBps = params.spreadAtExitBps;
    record.portfolioEquityAtExit = params.portfolioEquityAtExit;
    record.grossExposureAtExit = params.grossExposureAtExit;
    record.realizedPnL = Number(realizedPnL.toFixed(4));
    record.realizedPnLPct = Number(realizedPnLPct.toFixed(4));
    record.actualR = actualR !== undefined ? Number(actualR.toFixed(4)) : undefined;
    record.holdingDurationMs = holdingDurationMs;
    record.isGrossPnL = true;
    record.outcome = computeOutcome(realizedPnL);
    record.updatedAt = exitNow;
    return record;
  }

  recordRejection(params: RejectionParams): RejectedCandidateRecord {
    this.seqCounter++;
    const rec: RejectedCandidateRecord = {
      id: `REJ-${Date.now().toString(36).toUpperCase()}-${this.seqCounter}`,
      candidateId: params.candidateId,
      cycleId: params.cycleId,
      symbol: params.symbol.toUpperCase(),
      assetClass: params.assetClass,
      strategy: params.strategy,
      marketRegime: params.marketRegime,
      opportunityScore: params.opportunityScore,
      aiConfidence: params.aiConfidence,
      estimatedRiskReward: params.estimatedRiskReward,
      rejectionStage: params.rejectionStage,
      rejectionReason: params.rejectionReason,
      recordedAt: new Date().toISOString()
    };
    this.rejections.push(rec);
    if (this.rejections.length > this.maxHistory) {
      this.rejections = this.rejections.slice(-this.maxHistory);
    }
    return rec;
  }

  getAllTrades(): TradeRecord[] { return Array.from(this.trades.values()); }
  getOpenTrades(): TradeRecord[] { return this.getAllTrades().filter(t => t.outcome === 'OPEN'); }
  getCompletedTrades(): TradeRecord[] { return this.getAllTrades().filter(t => t.outcome !== 'OPEN'); }
  getTradeById(tradeId: string): TradeRecord | undefined { return this.trades.get(tradeId); }
  getRejectedCandidates(): RejectedCandidateRecord[] { return [...this.rejections]; }
  clear(): void { this.trades.clear(); this.rejections = []; this.seqCounter = 0; }

  private trimIfNeeded(): void {
    if (this.trades.size > this.maxHistory) {
      const keys = Array.from(this.trades.keys());
      keys.slice(0, keys.length - this.maxHistory).forEach(k => this.trades.delete(k));
    }
  }
}

// Canonical process-local TradeLedger singleton attached to globalThis
const gLedger = globalThis as unknown as { __TRADE_LEDGER__?: TradeLedger };
if (!gLedger.__TRADE_LEDGER__) {
  gLedger.__TRADE_LEDGER__ = new TradeLedger();
}
export const tradeLedger = gLedger.__TRADE_LEDGER__;
