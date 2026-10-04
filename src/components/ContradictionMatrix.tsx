'use client';
import React from 'react';
import { Claim } from '../lib/types';
import { buildContradictionMatrix } from '../lib/claims/contradiction';

interface ContradictionMatrixProps {
  claims: Claim[];
}

export const ContradictionMatrix: React.FC<ContradictionMatrixProps> = ({ claims }) => {
  const matrix = buildContradictionMatrix(claims);

  if (matrix.rows.length === 0) return null;

  return (
    <div className="p-4 rounded-lg border border-[#28272e] bg-[#1f1e23] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Contradiction Matrix</h3>
          <p className="text-[10px] text-[#848388] mt-0.5">Deterministic claim coverage per topic</p>
        </div>
        <div className="flex gap-3 text-[10px]">
          {matrix.totalContestedTopics > 0 && (
            <span className="text-amber-400 font-semibold">
              ⚠ {matrix.totalContestedTopics} contested
            </span>
          )}
          {matrix.totalRefutations > 0 && (
            <span className="text-[#ff3b5c] font-semibold">
              ✕ {matrix.totalRefutations} refuted
            </span>
          )}
        </div>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-[#28272e]">
              <th className="text-left py-2 pr-4 text-[#848388] font-semibold w-32 uppercase tracking-wider text-[9px]">Topic</th>
              <th className="text-center py-2 px-3 text-[#00ff84] font-semibold uppercase tracking-wider text-[9px]">Supports</th>
              <th className="text-center py-2 px-3 text-[#ff3b5c] font-semibold uppercase tracking-wider text-[9px]">Against</th>
              <th className="text-center py-2 px-3 text-orange-400 font-semibold uppercase tracking-wider text-[9px]">Refuted</th>
              <th className="text-center py-2 px-3 text-[#848388] font-semibold uppercase tracking-wider text-[9px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map(row => (
              <tr key={row.topic} className="border-b border-[#28272e]/50 hover:bg-[#28272e]/20 transition">
                <td className="py-2 pr-4 font-semibold text-white">{row.topic}</td>

                {/* Supporting */}
                <td className="text-center py-2 px-3">
                  {row.bullishClaims.length > 0 ? (
                    <span className="text-[#00ff84] tabular-nums font-semibold">
                      ✓ {row.bullishClaims.length}
                    </span>
                  ) : (
                    <span className="text-[#848388]">—</span>
                  )}
                </td>

                {/* Against */}
                <td className="text-center py-2 px-3">
                  {row.bearishClaims.length > 0 ? (
                    <span className="text-[#ff3b5c] tabular-nums font-semibold">
                      ✕ {row.bearishClaims.length}
                    </span>
                  ) : (
                    <span className="text-[#848388]">—</span>
                  )}
                </td>

                {/* Refuted */}
                <td className="text-center py-2 px-3">
                  {row.refutations.length > 0 ? (
                    <span className="text-orange-400 tabular-nums font-semibold">
                      ⚠ {row.refutations.length}
                    </span>
                  ) : (
                    <span className="text-[#848388]">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="text-center py-2 px-3">
                  {row.isContested ? (
                    <span className="text-amber-400 font-bold uppercase text-[10px]">
                      Contested
                    </span>
                  ) : row.bullishClaims.length > 0 ? (
                    <span className="text-[#00ff84] font-bold uppercase text-[10px]">
                      Supported
                    </span>
                  ) : (
                    <span className="text-[#848388] font-bold uppercase text-[10px]">
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
      <div className="flex flex-wrap gap-4 pt-2 text-[10px] text-[#848388] border-t border-[#28272e]/60">
        <span className="flex items-center gap-1"><span className="text-[#00ff84]">✓</span> Bullish claim with evidence</span>
        <span className="flex items-center gap-1"><span className="text-[#ff3b5c]">✕</span> Bearish/adverse claim</span>
        <span className="flex items-center gap-1"><span className="text-orange-400">⚠</span> Red Team refutation</span>
      </div>
    </div>
  );
};
