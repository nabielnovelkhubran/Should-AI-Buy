'use client';
import React from 'react';
import { Flame, ShieldAlert, AlertOctagon, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { AgentResult } from '../lib/types';

interface RedTeamSpotlightProps {
  redTeamResult?: AgentResult;
  asset: string;
}

export const RedTeamSpotlight: React.FC<RedTeamSpotlightProps> = ({ redTeamResult, asset }) => {
  if (!redTeamResult) return null;

  const details = redTeamResult.redTeamAttackDetails;
  const isDisproved = details?.thesisStatus === 'DISPROVED';
  const isWeakened = details?.thesisStatus === 'WEAKENED';
  const isIntact = details?.thesisStatus === 'INTACT';

  return (
    <div className={`p-6 rounded-2xl border relative overflow-hidden transition ${
      isDisproved 
        ? 'bg-gradient-to-b from-rose-950/30 to-[#11141d] border-rose-500/40 glow-redteam' 
        : isWeakened 
        ? 'bg-gradient-to-b from-amber-950/20 to-[#11141d] border-amber-500/30' 
        : 'bg-gradient-to-b from-emerald-950/20 to-[#11141d] border-emerald-500/30'
    }`}>
      
      {/* Decorative Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/40 flex items-center justify-center">
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              🔴 Red-Team Adversarial Challenge
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold">
                Core Differentiator
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Mandatory refutation attack against initial bull thesis before trade execution
            </p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 ${
          isDisproved
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            : isWeakened
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
        }`}>
          {isDisproved ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Thesis Status: {details?.thesisStatus || redTeamResult.verdict}
        </div>
      </div>

      {/* Summary Banner */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 leading-relaxed mb-4">
        <strong className="text-rose-400">Red-Team Findings: </strong>
        {redTeamResult.summary}
      </div>

      {/* Attack Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assumptions Tested */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Assumptions Challenged
          </h4>
          <ul className="space-y-2 text-xs text-slate-400">
            {details?.assumptionsChallenged?.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-indigo-400 font-mono">[{i + 1}]</span>
                <span>{a}</span>
              </li>
            )) || <li>No assumptions logged.</li>}
          </ul>
        </div>

        {/* Vulnerabilities Found */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isDisproved ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            Counter-Evidence & Vulnerabilities
          </h4>
          <ul className="space-y-2 text-xs">
            {details?.vulnerabilitiesFound?.map((v, i) => (
              <li key={i} className="flex items-start gap-2 text-rose-300">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{v}</span>
              </li>
            )) || <li className="text-emerald-400">No vulnerabilities detected. Opportunity passed attack.</li>}
          </ul>
        </div>
      </div>

    </div>
  );
};
