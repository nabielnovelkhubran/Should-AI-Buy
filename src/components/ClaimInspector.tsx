'use client';
import React, { useState } from 'react';
import { Claim, Evidence } from '../lib/types';

interface ClaimInspectorProps {
  claim: Claim;
  evidence: Evidence[];
  allClaims: Claim[];
}

function claimTypeColor(type: Claim['type']): string {
  switch (type) {
    case 'BULLISH':    return 'text-[#00ff84]';
    case 'BEARISH':    return 'text-[#ff3b5c]';
    case 'REFUTATION': return 'text-orange-400';
    case 'RISK':       return 'text-amber-400';
    default:           return 'text-[#848388]';
  }
}

function claimStatusGlyph(status: Claim['status']) {
  switch (status) {
    case 'SUPPORTED':   return '✓';
    case 'CONTESTED':   return '⚠';
    case 'REFUTED':     return '✕';
    case 'UNSUPPORTED': return '—';
  }
}

function claimStatusColor(status: Claim['status']): string {
  switch (status) {
    case 'SUPPORTED':   return 'text-[#00ff84]';
    case 'CONTESTED':   return 'text-amber-400';
    case 'REFUTED':     return 'text-[#ff3b5c]';
    case 'UNSUPPORTED': return 'text-[#848388]';
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
      ? 'bg-[#ff3b5c]/5 border-[#ff3b5c]/20'
      : 'bg-[#1f1e23] border-[#28272e]'
  }`}>
    <span className={`tabular-nums text-[10px] shrink-0 mt-0.5 ${isContradicting ? 'text-[#ff3b5c]' : 'text-[#848388]'}`}>
      {ev.id}
    </span>
    <div className="min-w-0">
      <p className="font-medium text-white truncate">{ev.title}</p>
      <p className="text-[#848388] text-[10px]">{ev.source.publisher ?? ev.source.name}</p>
    </div>
    {ev.source.url && (
      <a href={ev.source.url} target="_blank" rel="noopener noreferrer" className="shrink-0 ml-auto text-xs text-[#848388] hover:text-white">
        ↗
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
    <div className={`rounded-lg border text-xs transition-all ${
      claim.status === 'REFUTED'
        ? 'bg-[#ff3b5c]/5 border-[#ff3b5c]/20'
        : claim.status === 'CONTESTED'
        ? 'bg-amber-500/5 border-amber-500/20'
        : claim.type === 'REFUTATION'
        ? 'bg-orange-500/5 border-orange-500/20'
        : 'bg-[#17161b] border-[#28272e]'
    }`}>

      {/* Header row */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Claim ID */}
        <span className="tabular-nums text-[10px] text-[#848388] shrink-0">{claim.id.split('-').slice(-2).join('-')}</span>

        {/* Type label without box border */}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${claimTypeColor(claim.type)}`}>
          [{claim.type}]
        </span>

        {/* Statement preview */}
        <p className="flex-1 text-[#e2e8f0] truncate font-medium">{claim.statement}</p>

        {/* Status */}
        <div className={`flex items-center gap-1.5 shrink-0 font-semibold ${claimStatusColor(claim.status)}`}>
          <span className="text-xs">{claimStatusGlyph(claim.status)}</span>
          <span className="text-[10px] hidden sm:block">{claim.status}</span>
        </div>

        <span className="text-[10px] text-[#848388] shrink-0">
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-[#28272e] pt-3">

          {/* Full statement */}
          <p className="text-[#e2e8f0] leading-relaxed text-xs">{claim.statement}</p>

          {/* Agent + confidence */}
          <div className="flex flex-wrap gap-3 text-[10px] text-[#848388]">
            <span>Agent: <strong className="text-white">{agentLabel(claim.agent)}</strong></span>
            <span>Stage: <strong className="text-white">{claim.stage}</strong></span>
            <span>Confidence: <strong className="text-white tabular-nums">{claim.confidence}%</strong></span>
          </div>

          {/* Refutation chain */}
          {claim.type === 'REFUTATION' && refutationTarget && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-300">
              <span className="text-xs">↳</span>
              <span>Refutes: <strong>{refutationTarget.id.split('-').slice(-2).join('-')}</strong> — "{refutationTarget.statement.slice(0, 60)}…"</span>
            </div>
          )}
          {refutedBy && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#ff3b5c]/10 border border-[#ff3b5c]/20 text-[10px] text-[#ff3b5c]">
              <span className="text-xs">✕</span>
              <span>Refuted by Red Team claim <strong>{refutedBy.id.split('-').slice(-2).join('-')}</strong></span>
            </div>
          )}

          {/* Supporting evidence */}
          {supportingEvidence.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#848388] uppercase tracking-wider mb-1.5">
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
              <p className="text-[10px] font-semibold text-[#ff3b5c] uppercase tracking-wider mb-1.5">
                ✕ Contradictory Evidence ({contradictingEvidence.length})
              </p>
              <div className="space-y-1.5">
                {contradictingEvidence.map(ev => (
                  <EvidenceMini key={ev.id} ev={ev} isContradicting />
                ))}
              </div>
            </div>
          )}

          {supportingEvidence.length === 0 && contradictingEvidence.length === 0 && (
            <p className="text-[10px] text-[#848388] italic">No evidence items linked to this claim.</p>
          )}
        </div>
      )}
    </div>
  );
};
