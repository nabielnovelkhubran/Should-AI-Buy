'use client';
import React, { useState } from 'react';
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
    <div id="red-team-spotlight" className={`p-5 rounded-lg border transition scroll-mt-14 ${
      isDisproved 
        ? 'bg-[#1f1e23] border-[#ff3b5c]/40' 
        : isWeakened 
        ? 'bg-[#1f1e23] border-amber-500/30' 
        : 'bg-[#1f1e23] border-[#28272e]'
    }`}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Red-Team Adversarial Challenge
          </h3>
          <p className="text-xs text-[#848388]">
            Mandatory refutation attack against initial bull thesis before trade execution
          </p>
        </div>

        <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
          isDisproved
            ? 'text-[#ff3b5c]'
            : isWeakened
            ? 'text-amber-400'
            : 'text-[#00ff84]'
        }`}>
          <span>{isDisproved ? '✕' : isWeakened ? '⚠' : '✓'}</span>
          Thesis Status: {(details?.thesisStatus || redTeamResult.verdict).replace(/_/g, ' ')}
        </div>
      </div>

      {/* Summary Banner */}
      <div className="p-3.5 rounded-lg bg-[#17161b] border border-[#28272e] text-xs text-[#e2e8f0] leading-relaxed mb-4">
        <strong className="text-[#ff3b5c]">Red-Team Findings: </strong>
        {redTeamResult.summary}
      </div>

      {/* Attack Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        {/* Assumptions Tested */}
        <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e]">
          <h4 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-2.5">
            Assumptions Challenged
          </h4>
          <ul className="space-y-2 text-xs text-[#848388]">
            {details?.assumptionsChallenged?.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[#848388] tabular-nums">[{i + 1}]</span>
                <span>{a}</span>
              </li>
            )) || <li>No assumptions logged.</li>}
          </ul>
        </div>

        {/* Vulnerabilities Found */}
        <div className="p-4 rounded-lg bg-[#17161b] border border-[#28272e]">
          <h4 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-2.5">
            Counter-Evidence &amp; Vulnerabilities
          </h4>
          <ul className="space-y-2 text-xs">
            {details?.vulnerabilitiesFound?.map((v, i) => (
              <li key={i} className="flex items-start gap-2 text-[#ff3b5c]">
                <span className="text-[#ff3b5c] shrink-0">•</span>
                <span>{v}</span>
              </li>
            )) || <li className="text-[#00ff84]">No vulnerabilities detected. Opportunity passed attack.</li>}
          </ul>
        </div>
      </div>

      {/* Phase 3: REFUTATION Claims — structured adversarial assertions */}
      {hasRefutations && (
        <div className="border border-[#28272e] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowRefutations(r => !r)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#17161b] hover:bg-[#28272e]/30 transition"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
              <span>↳</span>
              <span>Structured Refutation Claims ({refutationClaims.length})</span>
              <span className="text-[10px] text-[#848388] font-sans normal-case tracking-normal">
                — traceable chain to prior claims &amp; evidence
              </span>
            </div>
            <span className="text-[10px] text-[#848388]">
              {showRefutations ? '▲' : '▼'}
            </span>
          </button>

          {showRefutations && (
            <div className="p-3 space-y-2 bg-[#17161b]">
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
