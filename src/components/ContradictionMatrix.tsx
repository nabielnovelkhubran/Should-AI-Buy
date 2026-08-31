'use client';
import React from 'react';
import { Claim } from '../lib/types';
import { buildContradictionMatrix } from '../lib/claims/contradiction';
import { CheckCircle2, XCircle, AlertTriangle, Minus } from 'lucide-react';

interface ContradictionMatrixProps {
  claims: Claim[];
}

export const ContradictionMatrix: React.FC<ContradictionMatrixProps> = ({ claims }) => {
  const matrix = buildContradictionMatrix(claims);

  if (matrix.rows.length === 0) return null;

  return (
    <div className="p-4 rounded-2xl border border-slate-800 bg-[#0e1117] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Contradiction Matrix</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">Deterministic claim coverage per topic</p>
        </div>
        <div className="flex gap-3 text-[10px] text-slate-400">
          {matrix.totalContestedTopics > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              {matrix.totalContestedTopics} contested
            </span>
          )}
          {matrix.totalRefutations > 0 && (
            <span className="flex items-center gap-1 text-rose-400">
              <XCircle className="w-3 h-3" />
              {matrix.totalRefutations} refuted
            </span>
          )}
        </div>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-2 pr-4 text-slate-400 font-semibold w-32">Topic</th>
              <th className="text-center py-2 px-3 text-emerald-400 font-semibold">Supports</th>
              <th className="text-center py-2 px-3 text-rose-400 font-semibold">Against</th>
              <th className="text-center py-2 px-3 text-orange-400 font-semibold">Refuted</th>
              <th className="text-center py-2 px-3 text-slate-400 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map(row => (
              <tr key={row.topic} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition">
                <td className="py-2 pr-4 font-semibold text-white">{row.topic}</td>

                {/* Supporting */}
                <td className="text-center py-2 px-3">
                  {row.bullishClaims.length > 0 ? (
                    <span className="flex items-center justify-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{row.bullishClaims.length}</span>
                    </span>
                  ) : (
                    <Minus className="w-3 h-3 text-slate-700 mx-auto" />
                  )}
                </td>

                {/* Against */}
                <td className="text-center py-2 px-3">
                  {row.bearishClaims.length > 0 ? (
                    <span className="flex items-center justify-center gap-1 text-rose-400">
                      <XCircle className="w-3 h-3" />
                      <span>{row.bearishClaims.length}</span>
                    </span>
                  ) : (
                    <Minus className="w-3 h-3 text-slate-700 mx-auto" />
                  )}
                </td>

                {/* Refuted */}
                <td className="text-center py-2 px-3">
                  {row.refutations.length > 0 ? (
                    <span className="flex items-center justify-center gap-1 text-orange-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{row.refutations.length}</span>
                    </span>
                  ) : (
                    <Minus className="w-3 h-3 text-slate-700 mx-auto" />
                  )}
                </td>

                {/* Status */}
                <td className="text-center py-2 px-3">
                  {row.isContested ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold uppercase">
                      Contested
                    </span>
                  ) : row.bullishClaims.length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold uppercase">
                      Supported
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-700/50 border border-slate-600 text-slate-400 font-bold uppercase">
                      Risk Only
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-1 text-[10px] text-slate-500 border-t border-slate-800/50">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Bullish claim with evidence</span>
        <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-rose-500" /> Bearish/adverse claim</span>
        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-orange-500" /> Red Team refutation</span>
      </div>
    </div>
  );
};
