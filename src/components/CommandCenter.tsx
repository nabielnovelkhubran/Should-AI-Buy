'use client';
import React, { useState, useEffect, useRef } from 'react';
import { AUTOCOMPLETE_SUGGESTIONS, AutocompleteSuggestion } from '../lib/command';

interface CommandCenterProps {
  onExecuteCommand: (command: string) => void;
  isLoading: boolean;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ onExecuteCommand, isLoading }) => {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<AutocompleteSuggestion[]>(AUTOCOMPLETE_SUGGESTIONS);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Zero-click autofocus on mount & whenever command tab is activated
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 40);

    const handleFocusEvent = () => {
      inputRef.current?.focus();
    };
    window.addEventListener('saib:focus-command-input', handleFocusEvent);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('saib:focus-command-input', handleFocusEvent);
    };
  }, []);

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
    setSelectedIndex(-1);
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
      handleSelect(filteredSuggestions[selectedIndex].command);
      return;
    }
    if (!input.trim() || isLoading) return;
    setShowSuggestions(false);
    onExecuteCommand(input.trim());
  };

  const handleSelect = (cmd: string) => {
    setInput(cmd);
    setShowSuggestions(false);
    onExecuteCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setInput('');
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full relative z-30 select-none pb-2">
      {/* 1. Welcoming Hero Branding (Claude / ChatGPT Aesthetic) */}
      <div className="flex flex-col items-center text-center mb-6 sm:mb-8 pt-3 sm:pt-6">
        <div className="flex items-center gap-2.5 mb-3.5 select-none">
          <img
            src="/logo.png"
            alt="SAIB Logo"
            className="w-9 h-9 object-contain"
          />
          <span
            className="text-base sm:text-lg font-extrabold tracking-tight font-phantom"
            style={{ color: '#00ff84', letterSpacing: '-0.03em' }}
          >
            SHOULD-AI BUY?
          </span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white font-phantom">
          Where should the council deliberate?
        </h1>
        <p className="text-xs sm:text-sm text-[#848388] mt-2 max-w-xl leading-relaxed">
          Ask any asset, challenge macro theses, or run stress-tests. The 7-stage council cross-examines evidence and executes with risk gate authorization.
        </p>
      </div>

      {/* 2. Main AI Command Input (Spacious, Focus-First) */}
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center bg-[#181720] border border-[#2d2c38] focus-within:border-[#00ff84]/70 focus-within:shadow-[0_4px_18px_rgba(0,255,132,0.06)] rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 transition-all">
            <span className="text-[#00ff84] font-phantom font-bold text-xl select-none mr-3 leading-none shrink-0">
              ›
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowSuggestions(e.target.value.trim().length > 0);
              }}
              onFocus={() => {
                if (input.trim().length > 0) setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... ($BTC, $NVDA, audit thesis)"
              className="w-full text-white text-sm sm:text-base font-medium outline-none bg-transparent placeholder-[#686772] pr-28 sm:pr-36"
              autoFocus
            />

            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput('');
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                className="mr-2 text-xs font-sans text-[#848388] hover:text-white px-1.5 py-0.5 rounded hover:bg-[#28272e] transition shrink-0 cursor-pointer"
                title="Clear input (Esc)"
              >
                ✕
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 sm:gap-2 transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-md"
              style={{
                background: '#00ff84',
                color: '#121117',
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#121117] border-t-transparent rounded-full animate-spin" />
                  <span>Deliberating...</span>
                </>
              ) : (
                <>
                  <span>Investigate</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-sans font-bold bg-[#121117]/20 text-[#121117]">
                    ↵
                  </kbd>
                </>
              )}
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {showSuggestions && input.trim().length > 0 && filteredSuggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-[#23222a]"
              style={{
                background: '#191820',
                border: '1px solid #28272e',
              }}
            >
              <div
                className="px-4 py-2 text-[10px] font-sans font-bold uppercase tracking-wider flex items-center justify-between"
                style={{ background: '#141318', color: '#848388' }}
              >
                <span>Command Autocomplete &amp; Alpaca Assets Master</span>
                <span>Use ↑↓ arrows to navigate, Enter to run</span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredSuggestions.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelect(item.command)}
                      className={`w-full px-4 py-2.5 text-left flex items-start justify-between gap-3 transition group ${
                        isSelected ? 'bg-[#24232c]' : 'hover:bg-[#201f28]'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-[#00ff84] flex items-center gap-2">
                          <span>{item.command}</span>
                          <span
                            className="text-[10px] font-sans font-bold"
                            style={{
                              color:
                                item.category === 'BUY'
                                  ? '#00ff84'
                                  : item.category === 'SELL'
                                  ? '#ff3b5c'
                                  : item.category === 'WATCH'
                                  ? '#60a5fa'
                                  : '#fbbf24',
                            }}
                          >
                            {item.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#848388] mt-0.5">{item.description}</div>
                      </div>
                      <span className="text-xs text-[#848388] group-hover:text-[#00ff84] mt-1 transition">→</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>

        {/* 3. Action Prompt Chips (Claude / ChatGPT Inspiration) */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => handleSelect('Should-AI buy $BTC?')}
            className="px-3.5 py-1.5 rounded-full bg-[#1e1d26] hover:bg-[#282733] text-[#d1d5db] hover:text-white transition font-sans text-xs font-medium cursor-pointer"
          >
            $BTC Consensus
          </button>

          <button
            type="button"
            onClick={() => handleSelect('Should-AI buy $ETH?')}
            className="px-3.5 py-1.5 rounded-full bg-[#1e1d26] hover:bg-[#282733] text-[#d1d5db] hover:text-white transition font-sans text-xs font-medium cursor-pointer"
          >
            $ETH Momentum
          </button>

          <button
            type="button"
            onClick={() => handleSelect('Should-AI buy $SOL?')}
            className="px-3.5 py-1.5 rounded-full bg-[#1e1d26] hover:bg-[#282733] text-[#d1d5db] hover:text-white transition font-sans text-xs font-medium cursor-pointer"
          >
            $SOL Breakout
          </button>

          <button
            type="button"
            onClick={() => handleSelect('Should-AI buy $NVDA?')}
            className="px-3.5 py-1.5 rounded-full bg-[#1e1d26] hover:bg-[#282733] text-[#d1d5db] hover:text-white transition font-sans text-xs font-medium cursor-pointer"
          >
            $NVDA (NVIDIA)
          </button>

          <button
            type="button"
            onClick={() => handleSelect('Should-AI buy $AAPL?')}
            className="px-3.5 py-1.5 rounded-full bg-[#1e1d26] hover:bg-[#282733] text-[#d1d5db] hover:text-white transition font-sans text-xs font-medium cursor-pointer"
          >
            $AAPL (Apple)
          </button>

          <button
            type="button"
            onClick={() => handleSelect('Why did you reject $BTC?')}
            className="px-3.5 py-1.5 rounded-full bg-[#1e1d26] hover:bg-[#282733] text-amber-300 hover:text-amber-200 transition font-sans text-xs font-medium cursor-pointer"
          >
            Why reject $BTC?
          </button>

          <button
            type="button"
            onClick={() => handleSelect('Should-AI sell $BTC?')}
            className="px-3.5 py-1.5 rounded-full bg-[#1e1d26] hover:bg-[#282733] text-rose-300 hover:text-rose-200 transition font-sans text-xs font-medium cursor-pointer"
          >
            Should-AI sell $BTC?
          </button>
        </div>

        {/* 4. Footer Shortcut Bar */}
        <div className="mt-4 pt-3 border-t border-[#23222a]/60 flex items-center justify-center gap-2 font-sans text-[10px] text-[#848388]">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[#1c1b22] border border-[#28272e] text-white">Enter ↵</kbd> to deliberate</span>
          <span>•</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-[#1c1b22] border border-[#28272e] text-white">Esc</kbd> to clear</span>
        </div>
      </div>
    </div>
  );
};
