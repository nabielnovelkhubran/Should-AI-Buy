'use client';
import React, { useState, useEffect } from 'react';
import { Search, Sparkles, ArrowRight, ShieldCheck, Flame, HelpCircle } from 'lucide-react';
import { AUTOCOMPLETE_SUGGESTIONS, AutocompleteSuggestion } from '../lib/command';

interface CommandCenterProps {
  onExecuteCommand: (command: string) => void;
  isLoading: boolean;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ onExecuteCommand, isLoading }) => {
  const [input, setInput] = useState('Should-AI buy $BTC?');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<AutocompleteSuggestion[]>(AUTOCOMPLETE_SUGGESTIONS);

  useEffect(() => {
    if (!input.trim()) {
      setFilteredSuggestions(AUTOCOMPLETE_SUGGESTIONS);
    } else {
      const q = input.toLowerCase();
      setFilteredSuggestions(
        AUTOCOMPLETE_SUGGESTIONS.filter(
          s => s.command.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
        )
      );
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setShowSuggestions(false);
    onExecuteCommand(input.trim());
  };

  const handleSelect = (cmd: string) => {
    setInput(cmd);
    setShowSuggestions(false);
    onExecuteCommand(cmd);
  };

  return (
    <div className="w-full relative z-30">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Ask the council... (e.g. Should-AI buy $BTC?)"
            className="w-full bg-[#1f1e23] text-white pl-12 pr-32 py-4 rounded-2xl border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-base font-medium shadow-xl transition"
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deliberating...
              </>
            ) : (
              <>
                Investigate
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1f1e23] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-slate-800/60">
            <div className="px-4 py-2 bg-[#1f1e23] text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Command Autocomplete & Live Alpaca Crypto Assets</span>
              <span>Select to run</span>
            </div>
            {filteredSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(item.command)}
                className="w-full px-4 py-3 text-left hover:bg-indigo-600/10 flex items-start justify-between gap-3 transition group"
              >
                <div>
                  <div className="text-sm font-semibold text-white group-hover:text-indigo-400 flex items-center gap-2">
                    {item.command}
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                      item.category === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      item.category === 'SELL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{item.description}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 mt-1 transition" />
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Quick Asset Chips (Crypto & Stocks) */}
      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-400">
        <span className="font-semibold text-slate-500">24/7 Crypto:</span>
        <button
          onClick={() => handleSelect('Should-AI buy $BTC?')}
          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 transition flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3 text-indigo-400" />
          $BTC
        </button>
        <button
          onClick={() => handleSelect('Should-AI buy $ETH?')}
          className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3 text-cyan-400" />
          $ETH
        </button>
        <span className="font-semibold text-slate-500 ml-2">US Stocks (Snapshot):</span>
        <button
          onClick={() => handleSelect('Should-AI buy $AAPL?')}
          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition flex items-center gap-1"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          $AAPL (Apple)
        </button>
        <button
          onClick={() => handleSelect('Should-AI buy $NVDA?')}
          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition flex items-center gap-1"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          $NVDA (NVIDIA)
        </button>
      </div>
    </div>
  );
};
