import {
  WorkflowAuditResult,
  AuditExecutionInput,
  WorkflowAuditFinding,
  WorkflowAuditVerdict
} from './types';
import { evaluateDeterministicRules } from './rules';
import { WORKFLOW_AUDITOR_SYSTEM_PROMPT, buildSanitizedAuditPrompt } from './prompt';
import {
  isFeatherlessConfigured,
  getFeatherlessModel,
  generateFeatherlessCompletion
} from '../ai/featherless';
import { SimulationRunResult } from '../simulation/types';

// ---------------------------------------------------------------------------
// Phase 8.18: Independent AI Workflow Auditor Engine
// Performs read-only forensic verification of trading workflows.
// INVARIANT: Read-only forensic analysis only. ZERO trading authority.
// INVARIANT: Featherless failure NEVER blocks or alters the trading pipeline.
// ---------------------------------------------------------------------------

const MAX_AUDIT_STORE_SIZE = 200;

export class WorkflowAuditor {
  private auditStore: Map<string, WorkflowAuditResult> = new Map();

  constructor() {
    // Retain in-memory store
  }

  public async auditCycle(input: AuditExecutionInput): Promise<WorkflowAuditResult> {
    const startTime = Date.now();
    const auditId = `AUD-${input.mode === 'SIMULATION' ? 'SIM-' : ''}${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const nowIso = new Date().toISOString();

    // 1. Authoritative Deterministic Rule Verification
    const det = evaluateDeterministicRules(input);

    let finalVerdict: WorkflowAuditVerdict = det.verdict;
    let finalConfidence = det.confidence;
    let finalSummary = det.summary;
    const finalFindings: WorkflowAuditFinding[] = [...det.findings];
    const errors: string[] = [];

    const provider = isFeatherlessConfigured() ? 'featherless' : 'deterministic-engine';
    const model = isFeatherlessConfigured() ? getFeatherlessModel() : 'builtin-deterministic-rules';

    // 2. Featherless LLM Forensic Analysis (if configured)
    if (isFeatherlessConfigured()) {
      try {
        const userPrompt = buildSanitizedAuditPrompt(input, det.summary);

        const llmRes = await generateFeatherlessCompletion({
          prompt: userPrompt,
          systemPrompt: WORKFLOW_AUDITOR_SYSTEM_PROMPT,
          model,
          temperature: 0.2,
          maxTokens: 1024
        });

        // Parse structured output from LLM
        const rawContent = llmRes.content.trim();
        let parsed: any = null;

        // Try extracting JSON
        try {
          parsed = JSON.parse(rawContent);
        } catch {
          // Attempt markdown code block extraction
          const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              parsed = JSON.parse(jsonMatch[1]);
            } catch (jsonErr: any) {
              errors.push(`Failed to parse Featherless JSON: ${jsonErr.message}`);
            }
          }
        }

        if (parsed && typeof parsed === 'object') {
          // If deterministic found an anomaly, deterministic ANOMALY takes precedence over LLM PASS
          if (det.verdict === 'ANOMALY' || det.verdict === 'ERROR') {
            finalVerdict = det.verdict;
          } else if (parsed.verdict === 'PASS' || parsed.verdict === 'WARN' || parsed.verdict === 'ANOMALY' || parsed.verdict === 'ERROR') {
            finalVerdict = parsed.verdict;
          }

          if (typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 100) {
            finalConfidence = Math.round((det.confidence + parsed.confidence) / 2);
          }

          if (typeof parsed.summary === 'string' && parsed.summary.length > 5) {
            finalSummary = parsed.summary;
          }

          // Merge LLM findings with deterministic findings
          if (Array.isArray(parsed.findings)) {
            for (const f of parsed.findings) {
              if (f && f.title && f.description) {
                const isDuplicate = finalFindings.some(existing => existing.title === f.title || existing.category === f.category);
                if (!isDuplicate) {
                  finalFindings.push({
                    id: f.id || `FIND-LLM-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                    severity: f.severity || 'INFO',
                    category: f.category || 'MODEL_DISAGREEMENT',
                    stage: f.stage || 'COUNCIL',
                    title: f.title,
                    description: f.description,
                    expected: f.expected,
                    observed: f.observed,
                    recommendation: f.recommendation || 'Review diagnostic trace.'
                  });
                }
              }
            }
          }
        } else {
          errors.push('Featherless returned non-JSON response; retained deterministic audit.');
        }
      } catch (err: any) {
        errors.push(`Featherless audit failed: ${err.message}`);
        // Fail-safe: retains deterministic findings without crashing
      }
    }

    const latencyMs = Date.now() - startTime;

    const auditResult: WorkflowAuditResult = {
      auditId,
      timestamp: nowIso,
      cycleId: input.cycleId,
      correlationId: input.correlationId,
      mode: input.mode,
      symbol: input.symbol,
      systemDecision: det.systemDecision,
      systemDecisionStage: det.systemDecisionStage,
      verdict: finalVerdict,
      confidence: finalConfidence,
      summary: finalSummary,
      findings: finalFindings,
      checkedStages: det.checkedStages,
      ruleChecks: det.ruleChecks,
      evidenceChecks: det.evidenceChecks,
      brokerReconciliation: det.brokerReconciliation,
      modelMetadata: {
        provider,
        model
      },
      latencyMs,
      errors
    };

    // Store bounded audit history
    this.auditStore.set(auditId, auditResult);
    this.trimStoreIfNeeded();

    return auditResult;
  }

  public auditSimulationTrace(simResult: SimulationRunResult): Promise<WorkflowAuditResult> {
    const isBuy = simResult.scenario === 'SUCCESSFUL_BUY' || simResult.scenario === 'PROFIT_EXIT' || simResult.scenario === 'PROTECTIVE_EXIT';
    const isRejected = simResult.scenario === 'BUY_REJECTED';

    const input: AuditExecutionInput = {
      mode: 'SIMULATION',
      cycleId: `SIM-CYCLE-${Date.now().toString(36).toUpperCase()}`,
      correlationId: `SIM-CORR-${simResult.scenario}`,
      symbol: 'BTC/USD',
      candidateSnapshot: {
        symbol: 'BTC/USD',
        price: 85000,
        change24h: 3.5,
        relativeVolume: 1.85,
        momentumScore: 82,
        realizedVolatility: 28.0,
        rsi14: 62.0,
        liquidityUsd: 1177500,
        spreadBps: 6.5,
        timestamp: new Date().toISOString()
      },
      multiFactorScore: 82,
      decision: {
        action: isBuy ? 'BUY' : isRejected ? 'REJECT' : 'HOLD',
        conclusion: isBuy ? 'BUY' : isRejected ? 'REJECT' : 'HOLD',
        confidence: isBuy ? 88 : 45,
        opportunityScore: 82,
        thesis: `Simulation scenario ${simResult.scenario} executed with ${simResult.trace.length} trace steps.`,
        reasoningSummary: simResult.message
      },
      evidence: [
        { id: 'E1', type: 'TECHNICAL', title: '1H Breakout', description: 'Strong RVOL 1.85x' },
        { id: 'E2', type: 'FLOW', title: 'Volume Acceleration', description: '+42% expansion' },
        { id: 'E3', type: 'MARKET', title: 'Deep Liquidity', description: '$1.17M liquidity verified' }
      ],
      riskGateResult: {
        passed: isBuy,
        violations: isRejected ? ['Simulation rejection threshold triggered'] : []
      },
      sizingResult: {
        approvedQuantity: 0.05,
        positionValueUsd: 4250,
        allowed: isBuy
      },
      orderIntent: isBuy ? { symbol: 'BTC/USD', quantity: 0.05 } : null,
      brokerRequest: isBuy ? { symbol: 'BTC/USD', qty: 0.05, side: 'buy', orderType: 'market' } : null,
      brokerResponse: isBuy ? { status: 'FILLED', orderId: 'SIM-ORD-1' } : null,
      traceSteps: simResult.trace
    };

    return this.auditCycle(input);
  }

  public getAuditHistory(options?: {
    mode?: 'REAL_PAPER' | 'SIMULATION';
    limit?: number;
    cycleId?: string;
    symbol?: string;
  }): WorkflowAuditResult[] {
    let list = Array.from(this.auditStore.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options?.mode) {
      list = list.filter(a => a.mode === options.mode);
    }
    if (options?.cycleId) {
      list = list.filter(a => a.cycleId === options.cycleId);
    }
    if (options?.symbol) {
      list = list.filter(a => a.symbol?.toUpperCase() === options.symbol?.toUpperCase());
    }

    const limit = options?.limit ?? 50;
    return list.slice(0, limit);
  }

  public getAuditById(auditId: string): WorkflowAuditResult | undefined {
    return this.auditStore.get(auditId);
  }

  public getLatestAudit(mode?: 'REAL_PAPER' | 'SIMULATION'): WorkflowAuditResult | null {
    const list = this.getAuditHistory({ mode, limit: 1 });
    return list.length > 0 ? list[0] : null;
  }

  public clearHistory(): void {
    this.auditStore.clear();
  }

  private trimStoreIfNeeded(): void {
    if (this.auditStore.size > MAX_AUDIT_STORE_SIZE) {
      const keys = Array.from(this.auditStore.keys());
      const toDelete = keys.slice(0, keys.length - MAX_AUDIT_STORE_SIZE);
      toDelete.forEach(k => this.auditStore.delete(k));
    }
  }
}

// Global singleton attached to globalThis
const globalWorkflowAuditor = (globalThis as any).__WORKFLOW_AUDITOR__ || new WorkflowAuditor();
if (!(globalThis as any).__WORKFLOW_AUDITOR__) {
  (globalThis as any).__WORKFLOW_AUDITOR__ = globalWorkflowAuditor;
}

export const workflowAuditor: WorkflowAuditor = globalWorkflowAuditor;
