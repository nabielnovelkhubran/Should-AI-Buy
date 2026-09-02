import { PaperPosition } from '../portfolio/types';
import { ProtectiveActionProposal, InvalidationFinding, ThesisHealth } from '../types';

// ---------------------------------------------------------------------------
// Phase 8.27: Options Position & Risk Management Monitor
// INVARIANT: Enforces hard stop loss on premium (-50%), profit targets (+50%/+100%),
// and DTE expiration risk (force-close at <= 2 DTE to prevent pin/assignment risk).
// ---------------------------------------------------------------------------

export interface OptionRiskAssessment {
  positionId: string;
  symbol: string;
  underlyingSymbol: string;
  contractType: 'call' | 'put';
  strikePrice: number;
  expirationDate: string;
  dte: number;
  entryPremium: number;
  currentPremium: number;
  unrealizedPlPct: number;
  isStopLossHit: boolean;      // PlPct <= -50%
  isProfitTargetHit: boolean;   // PlPct >= +50%
  isExpirationRisk: boolean;    // DTE <= 2
  shouldExit: boolean;
  exitReason: string | null;
}

export class OptionsThesisMonitor {
  private maxPremiumLossPct: number = 50;  // -50% Stop Loss on Premium
  private profitTargetPct: number = 50;    // +50% Initial Take Profit
  private minDteCutoff: number = 2;        // Exit at <= 2 DTE

  public parseOccSymbol(symbol: string): {
    underlying: string;
    expirationDate: string;
    type: 'call' | 'put';
    strike: number;
    dte: number;
  } | null {
    const clean = symbol.toUpperCase().replace(/^\$/, '').trim();
    const match = clean.match(/^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
    if (!match) return null;

    const underlying = match[1];
    const yy = match[2];
    const mm = match[3];
    const dd = match[4];
    const type: 'call' | 'put' = match[5] === 'C' ? 'call' : 'put';
    const strike = parseInt(match[6], 10) / 1000;
    const expirationDate = `20${yy}-${mm}-${dd}`;

    const now = new Date();
    const expDate = new Date(expirationDate);
    const dte = Math.max(0, Math.round((expDate.getTime() - now.getTime()) / 86400000));

    return {
      underlying,
      expirationDate,
      type,
      strike,
      dte
    };
  }

  public evaluateOptionPosition(
    position: PaperPosition,
    currentContractPrice?: number
  ): OptionRiskAssessment {
    const occInfo = this.parseOccSymbol(position.symbol);
    const entryPrice = position.avgEntryPrice;
    const currentPrice = currentContractPrice ?? position.currentPrice ?? entryPrice;
    const pnlPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

    const dte = occInfo?.dte ?? 14;
    const isStopLossHit = pnlPct <= -this.maxPremiumLossPct;
    const isProfitTargetHit = pnlPct >= this.profitTargetPct;
    const isExpirationRisk = dte <= this.minDteCutoff;

    let shouldExit = false;
    let exitReason: string | null = null;

    if (isStopLossHit) {
      shouldExit = true;
      exitReason = `PREMIUM_STOP_LOSS: Contract premium dropped ${pnlPct.toFixed(1)}% (limit: -${this.maxPremiumLossPct}%).`;
    } else if (isExpirationRisk) {
      shouldExit = true;
      exitReason = `EXPIRATION_PIN_RISK: Contract is at ${dte} DTE (minimum safety cutoff: ${this.minDteCutoff} DTE).`;
    } else if (isProfitTargetHit) {
      shouldExit = true;
      exitReason = `PROFIT_TARGET_HIT: Contract achieved +${pnlPct.toFixed(1)}% gain (target: +${this.profitTargetPct}%).`;
    }

    const posId = `POS-${position.symbol}`;

    return {
      positionId: posId,
      symbol: position.symbol,
      underlyingSymbol: occInfo?.underlying || position.symbol,
      contractType: occInfo?.type || 'call',
      strikePrice: occInfo?.strike || 0,
      expirationDate: occInfo?.expirationDate || '',
      dte,
      entryPremium: entryPrice,
      currentPremium: currentPrice,
      unrealizedPlPct: Number(pnlPct.toFixed(2)),
      isStopLossHit,
      isProfitTargetHit,
      isExpirationRisk,
      shouldExit,
      exitReason
    };
  }

  public generateExitProposal(
    position: PaperPosition,
    assessment: OptionRiskAssessment,
    cycleId: string
  ): ProtectiveActionProposal | null {
    if (!assessment.shouldExit) return null;

    const actionId = `ACT-OPT-EXIT-${position.symbol}-${Date.now()}`;
    const idempotencyKey = `IDEMP-OPT-EXIT-${position.symbol}-${cycleId}`;
    const posId = assessment.positionId;

    const invalidationFinding: InvalidationFinding = {
      category: assessment.isExpirationRisk ? 'THESIS_EXPIRED' : 'PRICE_DRAWDOWN',
      metricKey: assessment.isExpirationRisk ? 'options.dte' : 'options.premium_pnl_pct',
      currentValue: assessment.isExpirationRisk ? assessment.dte : assessment.unrealizedPlPct,
      thresholdValue: assessment.isExpirationRisk ? this.minDteCutoff : -this.maxPremiumLossPct,
      message: assessment.exitReason || 'Option risk threshold breached',
      severity: assessment.isStopLossHit || assessment.isExpirationRisk ? 'CRITICAL' : 'WARNING',
      detectedAt: new Date().toISOString()
    };

    const thesisHealth: ThesisHealth = {
      symbol: position.symbol,
      status: 'INVALIDATED',
      score: assessment.isProfitTargetHit ? 80 : 20,
      provenance: {
        entryPrice: position.avgEntryPrice,
        entryTimestamp: position.retrievedAt || new Date().toISOString(),
        invalidationRules: [],
        status: 'FOUND'
      },
      findings: [invalidationFinding],
      pnlPercent: assessment.unrealizedPlPct,
      evaluatedAt: new Date().toISOString(),
      summary: assessment.exitReason || 'Options risk trigger active'
    };

    return {
      actionId,
      positionId: posId,
      symbol: position.symbol,
      assetClass: 'OPTION',
      proposedSide: 'sell',
      quantity: Math.abs(position.quantity),
      invalidationReason: invalidationFinding,
      thesisHealth,
      portfolioRiskAssessment: {
        allowed: true,
        reason: 'Protective options position close authorized.'
      },
      status: 'PROPOSED',
      cycleId,
      idempotencyKey,
      createdAt: new Date().toISOString()
    };
  }
}

export const optionsThesisMonitor = new OptionsThesisMonitor();
