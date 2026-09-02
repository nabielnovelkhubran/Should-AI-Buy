import { OptionContractSnapshot, optionsChainService, formatOccOptionSymbol } from '../../market-data/options-chain-service';

// ---------------------------------------------------------------------------
// Phase 8.27: Quantitative OCC Option Contract Selector
// INVARIANT: Maps directional signals (BUY/SELL) to high-conviction Call/Put contracts.
// INVARIANT: Selects Target Delta (0.55–0.75), Target DTE (14–30 DTE), and enforced liquidity.
// ---------------------------------------------------------------------------

export interface ContractSelectionParams {
  underlyingSymbol: string;
  underlyingPrice: number;
  directionalBias: 'BUY' | 'SELL';
  strategyName?: string;
  opportunityScore?: number;
  realizedVolatility?: number;
  targetDteMin?: number;        // default 14
  targetDteMax?: number;        // default 30
  targetDeltaMin?: number;      // default 0.55
  targetDeltaMax?: number;      // default 0.75
  maxSpreadDollars?: number;    // default 0.20
  minOpenInterest?: number;     // default 100
}

export interface OptionSelectionResult {
  selectedContract: OptionContractSnapshot;
  suitabilityScore: number;     // 0 - 100
  contractsEvaluated: number;
  selectionRationale: string;
  contractCostUsd: number;      // Ask * 100
  underlyingSymbol: string;
  underlyingPrice: number;
}

export class OptionContractSelector {
  private chainService: typeof optionsChainService;

  constructor(chainService = optionsChainService) {
    this.chainService = chainService;
  }

  /**
   * Selects optimal Option Contract matching strategy parameters and risk constraints.
   */
  async selectContract(params: ContractSelectionParams): Promise<OptionSelectionResult | null> {
    const root = params.underlyingSymbol.toUpperCase().replace(/^\$/, '').trim();
    const type: 'call' | 'put' = params.directionalBias === 'BUY' ? 'call' : 'put';
    const targetDeltaMin = params.targetDeltaMin ?? 0.55;
    const targetDeltaMax = params.targetDeltaMax ?? 0.75;
    const minDte = params.targetDteMin ?? 14;
    const maxDte = params.targetDteMax ?? 30;
    const maxSpread = params.maxSpreadDollars ?? 0.20;
    const minOi = params.minOpenInterest ?? 100;

    const chain = await this.chainService.fetchOptionChain(
      root,
      params.underlyingPrice,
      params.realizedVolatility ?? 0.35,
      {
        contractType: type,
        minDte,
        maxDte,
        minOpenInterest: minOi,
        maxSpread
      }
    );

    const eligible = chain.contracts.filter(c => {
      const absDelta = Math.abs(c.delta);
      return absDelta >= targetDeltaMin && absDelta <= targetDeltaMax;
    });

    if (eligible.length === 0) {
      // Relax delta constraint slightly if no exact matches found in optimal band
      const fallbackEligible = chain.contracts.filter(c => {
        const absDelta = Math.abs(c.delta);
        return absDelta >= 0.45 && absDelta <= 0.85;
      });

      if (fallbackEligible.length === 0) return null;
      return this.rankAndPick(fallbackEligible, params, type);
    }

    return this.rankAndPick(eligible, params, type);
  }

  private rankAndPick(
    candidates: OptionContractSnapshot[],
    params: ContractSelectionParams,
    type: 'call' | 'put'
  ): OptionSelectionResult {
    // Score each candidate based on Delta proximity to 0.65 (ideal), tight spread, high OI, and 21 DTE sweet spot
    const scored = candidates.map(c => {
      const absDelta = Math.abs(c.delta);
      const deltaCloseness = Math.max(0, 100 - Math.abs(absDelta - 0.65) * 200);
      const spreadPenalty = Math.max(0, 100 - (c.spread / 0.20) * 50);
      const dteCloseness = Math.max(0, 100 - Math.abs(c.dte - 21) * 3);
      const oiBonus = Math.min(30, Math.log10(Math.max(10, c.openInterest)) * 10);

      const suitability = Math.round(
        deltaCloseness * 0.4 +
        spreadPenalty * 0.3 +
        dteCloseness * 0.2 +
        oiBonus * 0.1
      );

      return { contract: c, suitability };
    });

    scored.sort((a, b) => b.suitability - a.suitability);
    const best = scored[0];
    const contractCostUsd = Number((best.contract.ask * 100).toFixed(2));

    const rationale = `Selected ${best.contract.symbol} (${type.toUpperCase()} $${best.contract.strikePrice}, ${best.contract.dte} DTE). Delta: ${best.contract.delta}, Spread: $${best.contract.spread.toFixed(2)}, OI: ${best.contract.openInterest}. Premium Cost: $${contractCostUsd}.`;

    return {
      selectedContract: best.contract,
      suitabilityScore: best.suitability,
      contractsEvaluated: candidates.length,
      selectionRationale: rationale,
      contractCostUsd,
      underlyingSymbol: params.underlyingSymbol,
      underlyingPrice: params.underlyingPrice
    };
  }
}

export const optionContractSelector = new OptionContractSelector();
