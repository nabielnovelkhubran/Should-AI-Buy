'use client';
import React, { useState } from 'react';
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
        return <span className="text-[10px] font-bold text-[#00ff84] uppercase font-sans">[PRIMARY]</span>;
      case 'REPUTABLE':
        return <span className="text-[10px] font-bold text-cyan-400 uppercase font-sans">[REPUTABLE]</span>;
      case 'SECONDARY':
        return <span className="text-[10px] font-bold text-amber-400 uppercase font-sans">[SECONDARY]</span>;
      default:
        return <span className="text-[10px] font-bold text-[#848388] uppercase font-sans">[UNVERIFIED]</span>;
    }
  };

  // Phase 3 & 4: Verification status badge
  const getVerificationBadge = (status?: VerificationStatus, adapterSource?: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="text-[10px] font-bold text-[#00ff84] uppercase">
            LIVE
          </span>
        );
      case 'MOCK':
        return (
          <span className="text-[10px] font-bold text-[#848388] uppercase">
            {adapterSource === 'hackathon-demo-fallback' ? 'HACKATHON DEMO' : 'DEMO DATA'}
          </span>
        );
      case 'FAILED':
        return (
          <span className="text-[10px] font-bold text-[#ff3b5c] uppercase">
            SOURCE FAILED
          </span>
        );
      case 'STALE':
        return (
          <span className="text-[10px] font-bold text-amber-400 uppercase">
            STALE
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
      <span className={`text-[10px] ${colors[freshness] ?? 'text-[#848388]'}`}>
        {freshness}
      </span>
    );
  };

  return (
    <div className="space-y-4">

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
                className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                  filter === cat
                    ? 'bg-[#00ff84] text-black font-bold shadow-md'
                    : 'bg-[#17161b] text-[#848388] hover:text-white border border-[#28272e]'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="text-xs text-[#848388] flex items-center gap-1.5">
          <span>Source Provenance: <strong className="text-white">Full Traceability</strong></span>
        </div>
      </div>

      {/* Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-lg border flex flex-col justify-between transition ${
              item.isContradictory
                ? 'bg-[#1f1e23] border-[#ff3b5c]/40'
                : 'bg-[#1f1e23] border-[#28272e] hover:border-[#34333b]'
            }`}
          >
            <div>
              {/* Row 1: Type + ID + Reliability + Verification */}
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase ${
                    item.type === 'NEWS'    ? 'text-cyan-400' :
                    item.type === 'MARKET' ? 'text-[#00ff84]' :
                    item.type === 'FLOW'   ? 'text-purple-400' :
                    'text-amber-400'
                  }`}>
                    [{item.type}]
                  </span>
                  <span className="text-[10px] text-[#848388]">{item.id}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Phase 3 & 4: Verification badge before reliability */}
                  {getVerificationBadge(item.verificationStatus, item.adapterSource)}
                  {getReliabilityBadge(item.reliability)}
                  {item.isContradictory && (
                    <span className="text-[10px] font-bold text-[#ff3b5c] font-sans">
                      ⚠ Contradictory
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Title + Description */}
              <h4 className="text-sm font-bold text-white mb-1.5 leading-snug">{item.title}</h4>
              <p className="text-xs text-[#848388] leading-relaxed mb-3">{item.description}</p>

              {/* Phase 3: Claim reference chips */}
              {item.claimIds && item.claimIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {item.claimIds.map(cid => {
                    const claim = claimsById?.get(cid);
                    return (
                      <span
                        key={cid}
                        title={`Referenced by ${claim ? `${claim.agent} (${claim.type})` : cid}`}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-[#28272e] bg-[#17161b] text-[#848388]"
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
                      className="text-[9px] px-1.5 py-0.5 rounded border border-[#ff3b5c]/30 bg-[#ff3b5c]/10 text-[#ff3b5c]"
                    >
                      ↯ {eid.split('-').slice(-2).join('-')}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Source Provenance Footer */}
            <div className="pt-3 border-t border-[#28272e] space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-[#848388] flex items-center gap-1.5">
                  <span className="font-medium text-[#848388]">{item.source.publisher || item.source.name}</span>
                </div>

                {item.source.url ? (
                  <a
                    href={item.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#848388] hover:text-white flex items-center gap-1 hover:underline"
                  >
                    Inspect Source ↗
                  </a>
                ) : (
                  <span className="text-[10px] text-[#848388]">
                    Internal Adapter
                  </span>
                )}
              </div>

              {/* Phase 3: Timestamp separation — observedAt vs retrievedAt */}
              <div className="flex flex-wrap gap-3 text-[10px] text-[#848388] tabular-nums">
                <span>
                  <span>observed: </span>
                  {new Date(item.observedAt).toLocaleTimeString()}
                </span>
                <span>
                  <span>fetched: </span>
                  {new Date(item.source.retrievedAt).toLocaleTimeString()}
                </span>
                {getFreshnessChip(item.freshness)}
                {item.adapterSource && (
                  <span className="text-[#848388]">via {item.adapterSource}</span>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
