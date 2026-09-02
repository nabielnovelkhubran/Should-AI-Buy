'use client';
import React, { useState } from 'react';
import { Claim, Evidence } from '../lib/types';
import {
  CheckCircle2, XCircle, AlertTriangle, MinusCircle,
  ChevronDown, ChevronUp, Link2, ExternalLink
} from 'lucide-react';

interface ClaimInspectorProps {
  claim: Claim;
  evidence: Evidence[];
  allClaims: Claim[];
}

function claimTypeColor(type: Claim['type']): string {
  switch (type) {
    case 'BULLISH':    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'BEARISH':    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'REFUTATION': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'RISK':       return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    default:           return 'bg-slate-700/50 text-slate-300 border-slate-600';
  }
}

function claimStatusIcon(status: Claim['status']) {
  switch (status) {
    case 'SUPPORTED':   return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'CONTESTED':   return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    case 'REFUTED':     return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
    case 'UNSUPPORTED': return <MinusCircle className="w-3.5 h-3.5 text-slate-500" />;
  }
}

function claimStatusColor(status: Claim['status']): string {
  switch (status) {
    case 'SUPPORTED':   return 'text-emerald-400';
    case 'CONTESTED':   return 'text-amber-400';
    case 'REFUTED':     return 'text-rose-400';
    case 'UNSUPPORTED': return 'text-slate-500';
  }
}

function agentLabel(agent: Claim['agent']): string {
  const labels: Record<string, string> = {
    discovery: 'Discovery',
    quant: 'Quant',
    intelligence: 'Intelligence',
    risk: 'Risk',
    red_team: 'Red Team',
    decision: 'Decision'
  };
  return labels[agent] ?? agent;
}

const EvidenceMini: React.FC<{ ev: Evidence; isContradicting?: boolean }> = ({ ev, isContradicting }) => (
  <div className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${
    isContradicting
      ? 'bg-rose-950/20 border-rose-500/20'
      : 'bg-[#1f1e23] border-slate-700/50'
  }`}>
    <span className={`font-mono text-[10px] shrink-0 mt-0.5 ${isContradicting ? 'text-rose-400' : 'text-indigo-400'}`}>
      {ev.id}
    </span>
    <div className="min-w-0">
      <p className="font-medium text-white truncate">{ev.title}</p>
      <p className="text-slate-400 text-[10px]">{ev.source.publisher ?? ev.source.name}</p>
    </div>
    {ev.source.url && (
      <a href={ev.source.url} target="_blank" rel="noopener noreferrer" className="shrink-0 ml-auto">
        <ExternalLink className="w-3 h-3 text-slate-500 hover:text-indigo-400" />
      </a>
    )}
  </div>
);

export const ClaimInspector: React.FC<ClaimInspectorProps> = ({ claim, evidence, allClaims }) => {
  const [expanded, setExpanded] = useState(false);

  const supportingEvidence = evidence.filter(e => claim.supportingEvidenceIds.includes(e.id));
  const contradictingEvidence = evidence.filter(e => claim.contradictoryEvidenceIds.includes(e.id));
  const refutedBy = allClaims.find(c => c.id === claim.refutedByClaimId);
  const refutationTarget = claim.refutationOf ? allClaims.find(c => c.id === claim.refutationOf) : null;

  return (
    <div className={`rounded-xl border text-xs transition-all ${
      claim.status === 'REFUTED'
        ? 'bg-rose-950/10 border-rose-500/30'
        : claim.status === 'CONTESTED'
        ? 'bg-amber-950/10 border-amber-500/20'
        : claim.type === 'REFUTATION'
        ? 'bg-orange-950/10 border-orange-500/25'
        : 'bg-[#0e1117] border-slate-800'
    }`}>

      {/* Header row */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Claim ID */}
        <span className="font-mono text-[10px] text-slate-500 shrink-0">{claim.id.split('-').slice(-2).join('-')}</span>

        {/* Type badge */}
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${claimTypeColor(claim.type)}`}>
          {claim.type}
        </span>

        {/* Statement preview */}
        <p className="flex-1 text-slate-300 truncate font-medium">{claim.statement}</p>

        {/* Status */}
        <div className={`flex items-center gap-1 shrink-0 font-semibold ${claimStatusColor(claim.status)}`}>
          {claimStatusIcon(claim.status)}
          <span className="text-[10px] hidden sm:block">{claim.status}</span>
        </div>

        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        }
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-800/60 pt-3">

          {/* Full statement */}
          <p className="text-slate-200 leading-relaxed text-xs">{claim.statement}</p>

          {/* Agent + confidence */}
          <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
            <span>Agent: <strong className="text-white">{agentLabel(claim.agent)}</strong></span>
            <span>Stage: <strong className="text-white">{claim.stage}</strong></span>
            <span>Confidence: <strong className="text-white">{claim.confidence}%</strong></span>
          </div>

          {/* Refutation chain */}
          {claim.type === 'REFUTATION' && refutationTarget && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-950/20 border border-orange-500/20 text-[10px] text-orange-300">
              <Link2 className="w-3 h-3 shrink-0" />
              <span>Refutes: <strong>{refutationTarget.id.split('-').slice(-2).join('-')}</strong> — "{refutationTarget.statement.slice(0, 60)}…"</span>
            </div>
          )}
          {refutedBy && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-950/20 border border-rose-500/20 text-[10px] text-rose-300">
              <XCircle className="w-3 h-3 shrink-0" />
              <span>Refuted by Red Team claim <strong>{refutedBy.id.split('-').slice(-2).join('-')}</strong></span>
            </div>
          )}

          {/* Supporting evidence */}
          {supportingEvidence.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                ✓ Supporting Evidence ({supportingEvidence.length})
              </p>
              <div className="space-y-1.5">
                {supportingEvidence.map(ev => (
                  <EvidenceMini key={ev.id} ev={ev} />
                ))}
              </div>
            </div>
          )}

          {/* Contradicting evidence */}
          {contradictingEvidence.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider mb-1.5">
                ✗ Contradictory Evidence ({contradictingEvidence.length})
              </p>
              <div className="space-y-1.5">
                {contradictingEvidence.map(ev => (
                  <EvidenceMini key={ev.id} ev={ev} isContradicting />
                ))}
              </div>
            </div>
          )}

          {supportingEvidence.length === 0 && contradictingEvidence.length === 0 && (
            <p className="text-[10px] text-slate-500 italic">No evidence items linked to this claim.</p>
          )}
        </div>
      )}
    </div>
  );
};
