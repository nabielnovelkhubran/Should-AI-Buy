'use client';
import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { CommandCenter } from '@/components/CommandCenter';
import { DeliberationFeed } from '@/components/DeliberationFeed';
import { RedTeamSpotlight } from '@/components/RedTeamSpotlight';
import { EvidenceExplorer } from '@/components/EvidenceExplorer';
import { MarketChart } from '@/components/MarketChart';
import { PortfolioView } from '@/components/PortfolioView';
import { Investigation, MarketSnapshot, AlpacaAccount, Position, AlpacaOrder } from '@/lib/types';
import { AlertCircle } from 'lucide-react';
import { CurrencyProvider } from '@/components/CurrencyProvider';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'council' | 'portfolio' | 'evidence' | 'thesis'>('council');
  const [selectedEvidenceCategory, setSelectedEvidenceCategory] = useState<string>('ALL');
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [account, setAccount] = useState<AlpacaAccount | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<AlpacaOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPortfolio();
    handleRunCommand('Should-AI buy $BTC?');
  }, []);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account);
        setPositions(data.positions || []);
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Portfolio fetch error', err);
    }
  };

  const handleRunCommand = async (cmd: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      if (data.investigation) {
        setInvestigation(data.investigation);
        if (data.investigation.status === 'FAILED') {
          setErrorMessage(data.investigation.error || 'Investigation failed.');
        } else if (data.investigation.snapshot) {
          // Single Authoritative Snapshot synced directly from investigation
          setSnapshot(data.investigation.snapshot);
        }
        await fetchPortfolio();
      } else if (data.error) {
        setErrorMessage(data.error);
      }
    } catch (err: any) {
      console.error('Investigation error', err);
      setErrorMessage(err.message || 'Investigation request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewEvidence = (category?: string) => {
    setSelectedEvidenceCategory(category || 'ALL');
    setActiveTab('evidence');
  };

  const handleReevaluate = async (symbol: string, executeSell: boolean) => {
    try {
      const res = await fetch('/api/re-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, executeSell })
      });
      const data = await res.json();
      if (data.monitoringResult) {
        alert(data.monitoringResult.summary);
        await fetchPortfolio();
      } else if (data.error) {
        alert('Re-evaluation error: ' + data.error);
      }
    } catch (err: any) {
      console.error('Re-evaluate error', err);
      alert('Re-evaluation failed: ' + err.message);
    }
  };

  return (
    <CurrencyProvider>
      <main className="min-h-screen bg-[#090b10] text-slate-100 flex flex-col">
        <Header account={account} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 space-y-6 flex-1">
        <CommandCenter onExecuteCommand={handleRunCommand} isLoading={isLoading} />

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-rose-200 block mb-0.5">Market Data / Council Error:</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {activeTab === 'council' && investigation && investigation.status !== 'FAILED' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <RedTeamSpotlight
                redTeamResult={investigation.agentRuns['red_team']}
                asset={investigation.asset}
                claims={investigation.claims ?? []}
                evidence={investigation.evidence}
              />
              <DeliberationFeed
                investigation={investigation}
                onViewEvidence={handleViewEvidence}
              />
            </div>

            <div className="space-y-6">
              <MarketChart snapshot={snapshot || undefined} />
              <div className="p-4 rounded-2xl bg-[#11141d] border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Key Evidence ({investigation.evidence.length} items)
                  </h4>
                  <button
                    onClick={() => handleViewEvidence('ALL')}
                    className="text-xs font-semibold text-indigo-400 hover:underline"
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-2">
                  {investigation.evidence.slice(0, 3).map((e) => (
                    <div key={e.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                      <div className="font-bold text-white">{e.title}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">{e.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evidence' && investigation && (
          <EvidenceExplorer
            evidence={investigation.evidence}
            initialCategory={selectedEvidenceCategory}
          />
        )}

        {activeTab === 'portfolio' && (
          <PortfolioView
            account={account}
            positions={positions}
            orders={orders}
            onReevaluate={handleReevaluate}
          />
        )}
      </div>

      <footer className="border-t border-slate-800/80 bg-[#0d111a] py-4 text-center text-xs text-slate-500">
          Should-AI Buy? • Built for Alpaca AI Trading Agents Hackathon • Discover. Challenge. Decide.
        </footer>
      </main>
    </CurrencyProvider>
  );
}
