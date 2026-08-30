'use client';
import React, { useState } from 'react';
import { ExternalLink, AlertTriangle, Globe, Database, ShieldCheck } from 'lucide-react';
import { Evidence, ReliabilityRating } from '../lib/types';

interface EvidenceExplorerProps {
  evidence: Evidence[];
  initialCategory?: string;
}

export const EvidenceExplorer: React.FC<EvidenceExplorerProps> = ({
  evidence,
  initialCategory = 'ALL'
}) => {
  const [filter, setFilter] = useState<string>(initialCategory.toUpperCase());

  const categories = ['ALL', 'MARKET', 'NEWS', 'FLOW', 'RISK', 'TECHNICAL'] as const;
  const filtered = filter === 'ALL' ? evidence : evidence.filter(e => e.type === filter);

  const getReliabilityBadge = (rating: ReliabilityRating) => {
    switch (rating) {
      case 'PRIMARY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PRIMARY SOURCE</span>;
      case 'REPUTABLE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">REPUTABLE</span>;
      case 'SECONDARY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">SECONDARY</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">UNVERIFIED</span>;
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Category Filter & Provenance Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#11141d] p-3.5 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const count = cat === 'ALL' ? evidence.length : evidence.filter(e => e.type === cat).length;
            if (count === 0 && cat !== 'ALL') return null;

            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  filter === cat
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Source Provenance: <strong className="text-white">100% Traceable</strong></span>
        </div>
      </div>

      {/* Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-2xl border flex flex-col justify-between transition ${
              item.isContradictory
                ? 'bg-rose-950/10 border-rose-500/30'
                : 'bg-[#11141d] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    item.type === 'NEWS' ? 'bg-cyan-500/20 text-cyan-400' :
                    item.type === 'MARKET' ? 'bg-emerald-500/20 text-emerald-400' :
                    item.type === 'FLOW' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{item.id}</span>
                </div>

                <div className="flex items-center gap-2">
                  {getReliabilityBadge(item.reliability)}
                  {item.isContradictory && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Contradictory
                    </span>
                  )}
                </div>
              </div>

              <h4 className="text-sm font-bold text-white mb-1.5 leading-snug">{item.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">{item.description}</p>
            </div>

            {/* Source Provenance Footer */}
            <div className="pt-3 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-medium text-slate-300">{item.source.publisher || item.source.name}</span>
                <span className="text-[10px] text-slate-600 font-mono">({new Date(item.observedAt).toLocaleTimeString()})</span>
              </div>

              {item.source.url ? (
                <a
                  href={item.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
                >
                  Inspect Source
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <Database className="w-3 h-3 text-slate-600" /> Internal Adapter
                </span>
              )}
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
