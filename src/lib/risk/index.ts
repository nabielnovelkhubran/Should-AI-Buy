export interface RiskMetricBreakdown {
  holderConcentrationScore: number; // 0-100 (high = bad)
  top10HoldersPct: number;
  liquidityToVolumeRatio: number;
  suspiciousTransferCount: number;
  unlockThreat: boolean;
  compositeRiskScore: number;
  riskFlags: string[];
}

/**
 * Deterministically computes structural risk scores and identifies anomaly indicators.
 */
export function calculateRiskMetrics(
  top10HoldersPct: number,
  liquidityUsd: number,
  volume24h: number,
  suspiciousTransferCount: number,
  hasUpcomingUnlocks: boolean
): RiskMetricBreakdown {
  const riskFlags: string[] = [];
  let score = 0;

  // 1. Concentration Risk (40% weight)
  let concentrationScore = 0;
  if (top10HoldersPct > 80) {
    concentrationScore = 95;
    riskFlags.push(`Severe holder concentration: Top 10 wallets hold ${top10HoldersPct}% of total supply.`);
  } else if (top10HoldersPct > 60) {
    concentrationScore = 70;
    riskFlags.push(`Elevated concentration: Top 10 wallets hold ${top10HoldersPct}% of supply.`);
  } else if (top10HoldersPct > 40) {
    concentrationScore = 40;
  } else {
    concentrationScore = 15;
  }
  score += concentrationScore * 0.40;

  // 2. Liquidity / Slippage Risk (25% weight)
  let liquidityRisk = 0;
  const ratio = volume24h > 0 ? liquidityUsd / volume24h : 1.0;
  if (liquidityUsd < 300000) {
    liquidityRisk = 90;
    riskFlags.push(`Thin liquidity depth ($${(liquidityUsd/1000).toFixed(0)}k): high slippage risk.`);
  } else if (ratio < 0.2) {
    liquidityRisk = 75;
    riskFlags.push('Volume far outpaces available liquidity pool depth (potential wash trading).');
  } else if (liquidityUsd < 1000000) {
    liquidityRisk = 45;
  } else {
    liquidityRisk = 15;
  }
  score += liquidityRisk * 0.25;

  // 3. Behavioral / Anomaly Risk (20% weight)
  let anomalyRisk = 0;
  if (suspiciousTransferCount > 5) {
    anomalyRisk = 90;
    riskFlags.push(`${suspiciousTransferCount} abnormal large transfers to exchange deposit addresses detected in last 24h.`);
  } else if (suspiciousTransferCount > 0) {
    anomalyRisk = 50;
    riskFlags.push(`${suspiciousTransferCount} large unverified transfers detected.`);
  } else {
    anomalyRisk = 10;
  }
  score += anomalyRisk * 0.20;

  // 4. Token Unlock / Dev Risk (15% weight)
  let unlockRisk = hasUpcomingUnlocks ? 80 : 15;
  if (hasUpcomingUnlocks) {
    riskFlags.push('Major token unlock cliff scheduled within next 14 days.');
  }
  score += unlockRisk * 0.15;

  return {
    holderConcentrationScore: concentrationScore,
    top10HoldersPct,
    liquidityToVolumeRatio: Number(ratio.toFixed(2)),
    suspiciousTransferCount,
    unlockThreat: hasUpcomingUnlocks,
    compositeRiskScore: Math.max(0, Math.min(100, Math.round(score))),
    riskFlags
  };
}
