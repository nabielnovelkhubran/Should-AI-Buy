import {
  MonitoringCycleResult,
  MonitoredPositionRecord,
  ProtectiveActionProposal,
  MonitoringOptions,
  AuditTrailEvent,
  ThesisHealth
} from './types';
import { evaluateThesisHealth, resolveThesisProvenance } from './thesis';
import { PaperPortfolioService, paperPortfolioService } from '../portfolio';
import { PaperTradingService, paperTradingService } from '../trading';
import { fetchMarketSnapshot } from '../market-data';
import { normalizeScanSymbol } from '../scanner/universe';
import { PaperOrderResult } from '../trading/types';

// ---------------------------------------------------------------------------
// Phase 6C: Position Monitoring & Protective Invalidation Service
// Orchestrates continuous position health checks, deterministic invalidation
// detection, and idempotent paper-only protective exit proposals.
// INVARIANT: Paper trading only. Live broker execution is strictly prohibited.
// ---------------------------------------------------------------------------

export class PositionMonitoringService {
  private portfolioService: PaperPortfolioService;
  private tradingService: PaperTradingService;
  private latestResult: MonitoringCycleResult | null = null;
  private idempotencyCache: Map<string, PaperOrderResult> = new Map();

  constructor(
    portfolioService: PaperPortfolioService = paperPortfolioService,
    tradingService: PaperTradingService = paperTradingService
  ) {
    this.portfolioService = portfolioService;
    this.tradingService = tradingService;
  }

  /**
   * Executes a complete deterministic position monitoring cycle.
   */
  async runMonitoringCycle(options?: MonitoringOptions): Promise<MonitoringCycleResult> {
    const cycleTimestamp = new Date().toISOString();
    const cycleId = `CYCLE-${cycleTimestamp.replace(/[:.]/g, '-')}`;
    const auditTrail: AuditTrailEvent[] = [];

    auditTrail.push({
      timestamp: cycleTimestamp,
      stage: 'CYCLE_INITIATED',
      message: `Initiating monitoring cycle ${cycleId}. Paper trading mode strictly enforced.`
    });

    // 1. Fetch Authoritative Paper Portfolio
    const portfolio = await this.portfolioService.getPortfolioSnapshot();
    const positions = portfolio.positions || [];

    auditTrail.push({
      timestamp: new Date().toISOString(),
      stage: 'PORTFOLIO_RETRIEVED',
      message: `Retrieved authoritative paper portfolio (${positions.length} active position(s)).`,
      details: {
        positionCount: positions.length,
        equity: portfolio.account?.equity,
        cash: portfolio.account?.cash
      }
    });

    const monitoredPositions: MonitoredPositionRecord[] = [];
    const proposedActions: ProtectiveActionProposal[] = [];
    const executedActions: ProtectiveActionProposal[] = [];
    const blockedActions: ProtectiveActionProposal[] = [];

    let healthyCount = 0;
    let degradedCount = 0;
    let invalidatedCount = 0;
    let errorCount = 0;

    const fetchFn = options?.fetchSnapshotFn || fetchMarketSnapshot;

    // 2. Iterate each broker-confirmed position with isolated error handling
    for (const pos of positions) {
      const cleanSymbol = normalizeScanSymbol(pos.symbol);
      const evalTimestamp = new Date().toISOString();

      try {
        // Resolve original thesis provenance
        const provenance = resolveThesisProvenance(pos);

        // Fetch fresh market data snapshot
        let snapshot;
        try {
          snapshot = await fetchFn(cleanSymbol);
        } catch (mktErr: any) {
          auditTrail.push({
            timestamp: evalTimestamp,
            stage: 'MARKET_DATA_ERROR',
            symbol: cleanSymbol,
            message: `Market data fetch failed for ${cleanSymbol}: ${mktErr.message}`
          });
        }

        // Evaluate deterministic thesis health
        const health: ThesisHealth = evaluateThesisHealth(pos, snapshot, provenance, options);

        if (health.status === 'HEALTHY') healthyCount++;
        else if (health.status === 'DEGRADED') degradedCount++;
        else if (health.status === 'INVALIDATED') invalidatedCount++;
        else errorCount++;

        auditTrail.push({
          timestamp: evalTimestamp,
          stage: 'THESIS_EVALUATED',
          symbol: cleanSymbol,
          message: `${cleanSymbol} evaluated as ${health.status} (Score: ${health.score}/100).`,
          details: {
            score: health.score,
            status: health.status,
            pnlPercent: health.pnlPercent,
            criticalFindings: health.findings.filter(f => f.severity === 'CRITICAL').length
          }
        });

        let proposal: ProtectiveActionProposal | undefined = undefined;

        // 3. If thesis is INVALIDATED, construct ProtectiveActionProposal
        if (health.status === 'INVALIDATED') {
          const primaryFinding = health.findings.find(f => f.severity === 'CRITICAL') || health.findings[0];
          const proposedSide: 'buy' | 'sell' = pos.side === 'short' ? 'buy' : 'sell';
          const actionId = `ACT-${cleanSymbol}-${cycleId}`;
          const dateBucket = cycleTimestamp.substring(0, 13); // 1-hour resolution for duplicate protection
          const idempotencyKey = `MONITOR-EXIT-${cleanSymbol}-${primaryFinding.category}-${dateBucket}`;

          // Pre-Trade Portfolio Risk & Safety Assessment
          const riskAssessment = this.assessProtectiveActionSafety(cleanSymbol, pos.quantity, pos.assetClass);

          proposal = {
            actionId,
            positionId: `POS-${cleanSymbol}`,
            symbol: cleanSymbol,
            assetClass: pos.assetClass,
            proposedSide,
            quantity: pos.quantity, // Broker-confirmed quantity
            invalidationReason: primaryFinding,
            thesisHealth: health,
            portfolioRiskAssessment: riskAssessment,
            status: riskAssessment.allowed ? 'PROPOSED' : 'BLOCKED',
            cycleId,
            idempotencyKey,
            createdAt: evalTimestamp
          };

          proposedActions.push(proposal);

          if (!riskAssessment.allowed) {
            blockedActions.push(proposal);
            auditTrail.push({
              timestamp: evalTimestamp,
              stage: 'ACTION_BLOCKED',
              symbol: cleanSymbol,
              message: `Protective exit for ${cleanSymbol} BLOCKED by safety check: ${riskAssessment.reason}`
            });
          } else {
            auditTrail.push({
              timestamp: evalTimestamp,
              stage: 'ACTION_PROPOSED',
              symbol: cleanSymbol,
              message: `Protective exit PROPOSED for ${cleanSymbol} (${pos.quantity} units, ${proposedSide.toUpperCase()}).`
            });

            // 4. Optional Automatic Exit Execution (when explicitly enabled)
            if (options?.executeExits === true) {
              const execResult = await this.executeProtectiveAction(proposal, snapshot?.price || pos.currentPrice);
              proposal.executionResult = execResult;
              if (execResult.status === 'SUBMITTED' || execResult.status === 'FILLED') {
                proposal.status = 'EXECUTED';
                executedActions.push(proposal);
                auditTrail.push({
                  timestamp: new Date().toISOString(),
                  stage: 'ACTION_EXECUTED',
                  symbol: cleanSymbol,
                  message: `Protective paper exit for ${cleanSymbol} SUBMITTED (Order: ${execResult.orderId}).`
                });
              } else {
                proposal.status = 'FAILED';
                proposal.error = execResult.error;
                auditTrail.push({
                  timestamp: new Date().toISOString(),
                  stage: 'ACTION_FAILED',
                  symbol: cleanSymbol,
                  message: `Protective exit execution failed for ${cleanSymbol}: ${execResult.error}`
                });
              }
            }
          }
        }

        const positionStatus = health.status === 'INVALIDATED'
          ? (proposal?.status === 'EXECUTED' ? 'ACTION_SUBMITTED' : proposal?.status === 'BLOCKED' ? 'ACTION_BLOCKED' : 'ACTION_PROPOSED')
          : (health.status === 'DEGRADED' ? 'DEGRADED' : health.status === 'HEALTHY' ? 'HEALTHY' : 'ERROR');

        monitoredPositions.push({
          position: pos,
          status: positionStatus,
          health,
          proposal,
          lastEvaluatedAt: evalTimestamp
        });
      } catch (posErr: any) {
        errorCount++;
        auditTrail.push({
          timestamp: evalTimestamp,
          stage: 'POSITION_MONITOR_ERROR',
          symbol: cleanSymbol,
          message: `Unexpected error monitoring ${cleanSymbol}: ${posErr.message}`
        });

        monitoredPositions.push({
          position: pos,
          status: 'ERROR',
          health: {
            symbol: cleanSymbol,
            status: 'ERROR',
            score: 0,
            provenance: {
              entryPrice: pos.avgEntryPrice,
              entryTimestamp: pos.retrievedAt,
              invalidationRules: [],
              status: 'UNAVAILABLE'
            },
            findings: [{
              category: 'DATA_UNAVAILABLE',
              metricKey: 'internal_error',
              currentValue: 'ERROR',
              thresholdValue: 'HEALTHY',
              message: posErr.message,
              severity: 'CRITICAL',
              detectedAt: evalTimestamp
            }],
            pnlPercent: 0,
            evaluatedAt: evalTimestamp,
            summary: `MONITORING_EXCEPTION: ${posErr.message}`
          },
          lastEvaluatedAt: evalTimestamp,
          error: posErr.message
        });
      }
    }

    auditTrail.push({
      timestamp: new Date().toISOString(),
      stage: 'CYCLE_COMPLETED',
      message: `Cycle ${cycleId} completed. Monitored ${monitoredPositions.length} position(s). Healthy: ${healthyCount}, Degraded: ${degradedCount}, Invalidated: ${invalidatedCount}, Errors: ${errorCount}.`
    });

    const result: MonitoringCycleResult = {
      cycleId,
      timestamp: cycleTimestamp,
      totalMonitored: monitoredPositions.length,
      healthyCount,
      degradedCount,
      invalidatedCount,
      errorCount,
      monitoredPositions,
      proposedActions,
      executedActions,
      blockedActions,
      auditTrail,
      environment: 'PAPER'
    };

    this.latestResult = result;
    return result;
  }

  /**
   * Evaluates safety criteria for a proposed protective exit.
   */
  private assessProtectiveActionSafety(
    symbol: string,
    quantity: number,
    assetClass: string
  ): { allowed: boolean; reason?: string } {
    if (!symbol || symbol.trim().length === 0) {
      return { allowed: false, reason: 'INVALID_SYMBOL: Asset symbol cannot be empty.' };
    }
    if (quantity <= 0 || !Number.isFinite(quantity)) {
      return { allowed: false, reason: `INVALID_QUANTITY: Exit quantity (${quantity}) must be a positive finite number.` };
    }
    return { allowed: true };
  }

  /**
   * Submits an authorized protective paper exit order with idempotency protection.
   */
  async executeProtectiveAction(
    proposal: ProtectiveActionProposal,
    currentPrice: number = 100
  ): Promise<PaperOrderResult> {
    const cleanSymbol = normalizeScanSymbol(proposal.symbol);

    // 1. Idempotency Check
    const cached = this.idempotencyCache.get(proposal.idempotencyKey);
    if (cached) {
      return cached;
    }

    // 2. Submit Paper Order through PaperTradingService
    const request = {
      investigationId: proposal.actionId,
      symbol: cleanSymbol,
      assetClass: proposal.assetClass,
      side: proposal.proposedSide,
      qty: proposal.quantity,
      price: currentPrice,
      orderType: 'market' as const,
      timeInForce: 'gtc' as const,
      recommendation: 'SELL' as const,
      riskGatePassed: true // Authorized protective exit
    };

    const orderResult = await this.tradingService.submitPaperOrder(request);

    // 3. Cache Result for Idempotency
    this.idempotencyCache.set(proposal.idempotencyKey, orderResult);
    return orderResult;
  }

  getLatestResult(): MonitoringCycleResult | null {
    return this.latestResult;
  }

  clear(): void {
    this.latestResult = null;
    this.idempotencyCache.clear();
  }
}

/** Singleton instance of PositionMonitoringService */
export const positionMonitoringService = new PositionMonitoringService();

export * from './types';
export * from './thesis';
