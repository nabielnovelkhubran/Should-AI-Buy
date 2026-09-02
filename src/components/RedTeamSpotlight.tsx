'use client';
import React, { useState } from 'react';
import { Flame, ShieldAlert, AlertOctagon, CheckCircle2, XCircle, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { AgentResult, Claim, Evidence } from '../lib/types';
import { ClaimInspector } from './ClaimInspector';

interface RedTeamSpotlightProps {
  redTeamResult?: AgentResult;
  asset: string;
  /** Phase 3: all claims from the investigation — Red Team refutations extracted here */
  claims?: Claim[];
  evidence?: Evidence[];
}

export const RedTeamSpotlight: React.FC<RedTeamSpotlightProps> = ({
  redTeamResult,
  asset,
  claims = [],
  evidence = []
}) => {
  const [showRefutations, setShowRefutations] = useState(true);

  if (!redTeamResult) return null;

  const details = redTeamResult.redTeamAttackDetails;
  const isDisproved = details?.thesisStatus === 'DISPROVED';
  const isWeakened = details?.thesisStatus === 'WEAKENED';

  // Phase 3: Extract REFUTATION claims from the claim graph
  const refutationClaims = claims.filter(c => c.agent === 'red_team' && c.type === 'REFUTATION');
  const hasRefutations = refutationClaims.length > 0;

  return (
    <div className={`p-6 rounded-lg border relative overflow-hidden transition ${
      isDisproved 
        ? 'bg-gradient-to-b from-rose-950/30 to-[#1f1e23] border-rose-500/40 glow-redteam' 
        : isWeakened 
        ? 'bg-gradient-to-b from-amber-950/20 to-[#1f1e23] border-amber-500/30' 
        : 'bg-gradient-to-b from-emerald-950/20 to-[#1f1e23] border-[#00ff84]/20'
    }`}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/40 flex items-center justify-center">
            <Flame className="w-4 h-4 text-[#ff3b5c]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              🔴 Red-Team Adversarial Challenge
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-[#ff3b5c] font-mono font-bold">
                Core Differentiator
              </span>
            </h3>
            <p className="text-xs text-[#848388]">
              Mandatory refutation attack against initial bull thesis before trade execution
            </p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 ${
          isDisproved
            ? 'bg-rose-500/20 text-[#ff3b5c] border border-rose-500/40'
            : isWeakened
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : 'bg-[#00ff84]/10 text-[#00ff84] border border-emerald-500/40'
        }`}>
          {isDisproved ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Thesis Status: {details?.thesisStatus || redTeamResult.verdict}
        </div>
      </div>

      {/* Summary Banner */}
      <div className="p-3.5 rounded-lg bg-[#1f1e23] border border-[#28272e] text-xs text-slate-200 leading-relaxed mb-4">
        <strong className="text-[#ff3b5c]">Red-Team Findings: </strong>
        {redTeamResult.summary}
      </div>

      {/* Attack Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        {/* Assumptions Tested */}
        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e]">
          <h4 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Assumptions Challenged
          </h4>
          <ul className="space-y-2 text-xs text-[#848388]">
            {details?.assumptionsChallenged?.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[#848388] font-mono">[{i + 1}]</span>
                <span>{a}</span>
              </li>
            )) || <li>No assumptions logged.</li>}
          </ul>
        </div>

        {/* Vulnerabilities Found */}
        <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e]">
          <h4 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isDisproved ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            Counter-Evidence &amp; Vulnerabilities
          </h4>
          <ul className="space-y-2 text-xs">
            {details?.vulnerabilitiesFound?.map((v, i) => (
              <li key={i} className="flex items-start gap-2 text-[#ff3b5c]">
                <AlertOctagon className="w-3.5 h-3.5 text-[#ff3b5c] shrink-0 mt-0.5" />
                <span>{v}</span>
              </li>
            )) || <li className="text-[#00ff84]">No vulnerabilities detected. Opportunity passed attack.</li>}
          </ul>
        </div>
      </div>

      {/* Phase 3: REFUTATION Claims — structured adversarial assertions */}
      {hasRefutations && (
        <div className="border border-orange-500/20 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowRefutations(r => !r)}
            className="w-full flex items-center justify-between px-4 py-3 bg-orange-950/20 hover:bg-orange-950/30 transition"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-orange-300 uppercase tracking-wider">
              <Link2 className="w-3.5 h-3.5" />
              <span>Structured Refutation Claims ({refutationClaims.length})</span>
              <span className="text-[10px] text-orange-400/60 font-mono normal-case tracking-normal">
                — traceable chain to prior claims &amp; evidence
              </span>
            </div>
            {showRefutations
              ? <ChevronUp className="w-4 h-4 text-orange-400" />
              : <ChevronDown className="w-4 h-4 text-orange-400" />
            }
          </button>

          {showRefutations && (
            <div className="p-3 space-y-2 bg-[#1f1e23]">
              {refutationClaims.map(claim => (
                <ClaimInspector
                  key={claim.id}
                  claim={claim}
                  evidence={evidence}
                  allClaims={claims}
                />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
