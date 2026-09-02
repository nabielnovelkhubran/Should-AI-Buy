'use client';
import React, { useState } from 'react';
import { ExternalLink, AlertTriangle, Globe, Database, ShieldCheck, Wifi, WifiOff, Clock, FlaskConical } from 'lucide-react';
import { Evidence, ReliabilityRating, VerificationStatus } from '../lib/types';

interface EvidenceExplorerProps {
  evidence: Evidence[];
  initialCategory?: string;
  /** If provided, renders claim reference chips on evidence cards */
  claimsById?: Map<string, { id: string; type: string; agent: string }>;
}

export const EvidenceExplorer: React.FC<EvidenceExplorerProps> = ({
  evidence,
  initialCategory = 'ALL',
  claimsById
}) => {
  const [filter, setFilter] = useState<string>(initialCategory.toUpperCase());

  React.useEffect(() => {
    setFilter(initialCategory.toUpperCase());
  }, [initialCategory]);

  const categories = ['ALL', 'MARKET', 'NEWS', 'FLOW', 'RISK', 'TECHNICAL'] as const;
  const filtered = filter === 'ALL' ? evidence : evidence.filter(e => e.type === filter);

  const getReliabilityBadge = (rating: ReliabilityRating) => {
    switch (rating) {
      case 'PRIMARY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00ff84]/8 text-[#00ff84] border border-[#00ff84]/20">PRIMARY SOURCE</span>;
      case 'REPUTABLE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-[#00ff84] border border-cyan-500/20">REPUTABLE</span>;
      case 'SECONDARY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">SECONDARY</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-[#848388] border border-[#34333b]">UNVERIFIED</span>;
    }
  };

  // Phase 3 & 4: Verification status badge
  const getVerificationBadge = (status?: VerificationStatus, adapterSource?: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#00ff84]/8 text-[#00ff84] border border-[#00ff84]/20">
            <Wifi className="w-2.5 h-2.5" /> LIVE
          </span>
        );
      case 'MOCK':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-[#848388] border border-indigo-500/20">
            <FlaskConical className="w-2.5 h-2.5" /> {adapterSource === 'hackathon-demo-fallback' ? 'HACKATHON DEMO' : 'DEMO DATA'}
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#ff3b5c]/8 text-[#ff3b5c] border border-rose-500/20">
            <WifiOff className="w-2.5 h-2.5" /> SOURCE FAILED
          </span>
        );
      case 'STALE':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-2.5 h-2.5" /> STALE
          </span>
        );
      default:
        return null;
    }
  };

  // Phase 3: Freshness indicator
  const getFreshnessChip = (freshness?: Evidence['freshness']) => {
    if (!freshness) return null;
    const colors: Record<string, string> = {
      LIVE:   'text-[#00ff84]',
      RECENT: 'text-[#00ff84]',
      STALE:  'text-amber-400'
    };
    return (
      <span className={`text-[10px] font-mono ${colors[freshness] ?? 'text-[#2d3748]'}`}>
        {freshness}
      </span>
    );
  };

  return (
    <div className="space-y-2">

      {/* Category Filter & Provenance Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1f1e23] p-3.5 rounded-lg border border-[#28272e]">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const count = cat === 'ALL' ? evidence.length : evidence.filter(e => e.type === cat).length;
            if (count === 0 && cat !== 'ALL') return null;

            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filter === cat
                    ? 'bg-[#00ff84] text-black font-bold shadow-md'
                    : 'bg-[#1f1e23] text-[#848388] hover:text-white border border-[#28272e]'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="text-xs text-[#848388] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#848388]" />
          <span>Source Provenance: <strong className="text-white">Full Traceability</strong></span>
        </div>
      </div>

      {/* Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-lg border flex flex-col justify-between transition ${
              item.isContradictory
                ? 'bg-rose-950/10 border-rose-500/30'
                : 'bg-[#1f1e23] border-[#28272e] hover:border-[#34333b]'
            }`}
          >
            <div>
              {/* Row 1: Type + ID + Reliability + Verification */}
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    item.type === 'NEWS'    ? 'bg-cyan-500/20 text-[#00ff84]' :
                    item.type === 'MARKET' ? 'bg-[#00ff84]/10 text-[#00ff84]' :
                    item.type === 'FLOW'   ? 'bg-purple-500/20 text-[#848388]' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-[10px] font-mono text-[#2d3748]">{item.id}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Phase 3 & 4: Verification badge before reliability */}
                  {getVerificationBadge(item.verificationStatus, item.adapterSource)}
                  {getReliabilityBadge(item.reliability)}
                  {item.isContradictory && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-[#ff3b5c] border border-rose-500/40 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Contradictory
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Title + Description */}
              <h4 className="text-sm font-bold text-white mb-1.5 leading-snug">{item.title}</h4>
              <p className="text-xs text-[#9ca3af] leading-relaxed mb-3">{item.description}</p>

              {/* Phase 3: Claim reference chips */}
              {item.claimIds && item.claimIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {item.claimIds.map(cid => {
                    const claim = claimsById?.get(cid);
                    return (
                      <span
                        key={cid}
                        title={`Referenced by ${claim ? `${claim.agent} (${claim.type})` : cid}`}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-[#848388]"
                      >
                        {cid.split('-').slice(-2).join('-')}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Phase 3: Level-1 contradiction chips */}
              {item.contradicts && item.contradicts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {item.contradicts.map(eid => (
                    <span
                      key={eid}
                      title={`This item contradicts ${eid}`}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-rose-500/30 bg-[#ff3b5c]/8 text-[#ff3b5c]"
                    >
                      ↯ {eid.split('-').slice(-2).join('-')}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Source Provenance Footer — Phase 3: shows observedAt + retrievedAt separately */}
            <div className="pt-3 border-t border-[#28272e]/70 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-[#848388] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#2d3748] shrink-0" />
                  <span className="font-medium text-[#9ca3af]">{item.source.publisher || item.source.name}</span>
                </div>

                {item.source.url ? (
                  <a
                    href={item.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#848388] hover:text-[#848388] flex items-center gap-1 hover:underline"
                  >
                    Inspect Source
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-[10px] font-mono text-[#2d3748] flex items-center gap-1">
                    <Database className="w-3 h-3 text-slate-600" /> Internal Adapter
                  </span>
                )}
              </div>

              {/* Phase 3: Timestamp separation — observedAt vs retrievedAt */}
              <div className="flex flex-wrap gap-3 text-[10px] text-slate-600 font-mono">
                <span>
                  <span className="text-[#2d3748]">observed: </span>
                  {new Date(item.observedAt).toLocaleTimeString()}
                </span>
                <span>
                  <span className="text-[#2d3748]">fetched: </span>
                  {new Date(item.source.retrievedAt).toLocaleTimeString()}
                </span>
                {getFreshnessChip(item.freshness)}
                {item.adapterSource && (
                  <span className="text-slate-600">via {item.adapterSource}</span>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
