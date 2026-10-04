'use client';
import React, { useState, useEffect } from 'react';
import { X, Key, Send, CheckCircle2, AlertCircle, ShieldAlert, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'alpaca' | 'webhooks' | 'persistence'>('alpaca');

  // Alpaca Form State
  const [alpacaKey, setAlpacaKey] = useState('');
  const [alpacaSecret, setAlpacaSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [alpacaVerifying, setAlpacaVerifying] = useState(false);
  const [alpacaStatus, setAlpacaStatus] = useState<{ ok?: boolean; message?: string } | null>(null);

  // Webhooks Form State
  const [discordUrl, setDiscordUrl] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [showTgToken, setShowTgToken] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState<'discord' | 'telegram' | null>(null);
  const [webhookFeedback, setWebhookFeedback] = useState<{ ok?: boolean; message?: string } | null>(null);

  // Save State Feedback
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setAlpacaKey(localStorage.getItem('saib_custom_alpaca_key') || '');
        setAlpacaSecret(localStorage.getItem('saib_custom_alpaca_secret') || '');
        setDiscordUrl(localStorage.getItem('saib_custom_discord_url') || '');
        setTelegramToken(localStorage.getItem('saib_custom_telegram_token') || '');
        setTelegramChatId(localStorage.getItem('saib_custom_telegram_chat') || '');
      } catch {}
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Save all custom keys to localStorage
  const handleSave = () => {
    if (typeof window !== 'undefined') {
      try {
        if (alpacaKey) localStorage.setItem('saib_custom_alpaca_key', alpacaKey);
        else localStorage.removeItem('saib_custom_alpaca_key');

        if (alpacaSecret) localStorage.setItem('saib_custom_alpaca_secret', alpacaSecret);
        else localStorage.removeItem('saib_custom_alpaca_secret');

        if (discordUrl) localStorage.setItem('saib_custom_discord_url', discordUrl);
        else localStorage.removeItem('saib_custom_discord_url');

        if (telegramToken) localStorage.setItem('saib_custom_telegram_token', telegramToken);
        else localStorage.removeItem('saib_custom_telegram_token');

        if (telegramChatId) localStorage.setItem('saib_custom_telegram_chat', telegramChatId);
        else localStorage.removeItem('saib_custom_telegram_chat');

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch {}
    }
  };

  // Test Discord Webhook
  const handleTestDiscord = async () => {
    setWebhookTesting('discord');
    setWebhookFeedback(null);
    try {
      const res = await fetch('/api/notifications/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'TEST_ALERT',
          asset: 'BTC',
          title: 'Discord Integration Online',
          description: 'Live test alert dispatched from Should-AI Buy? Command Terminal.',
          severity: 'SUCCESS',
          overrides: { discordUrl },
        }),
      });
      const data = await res.json();
      if (data.delivered?.discordSent) {
        setWebhookFeedback({ ok: true, message: 'Discord test ping delivered successfully to your channel!' });
      } else {
        setWebhookFeedback({ ok: false, message: data.delivered?.errors?.[0] || 'Discord ping failed. Verify webhook URL.' });
      }
    } catch (err: any) {
      setWebhookFeedback({ ok: false, message: err.message || 'Network error reaching webhook API.' });
    } finally {
      setWebhookTesting(null);
    }
  };

  // Test Telegram Webhook
  const handleTestTelegram = async () => {
    setWebhookTesting('telegram');
    setWebhookFeedback(null);
    try {
      const res = await fetch('/api/notifications/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'TEST_ALERT',
          asset: 'BTC',
          title: 'Telegram Integration Online',
          description: 'Live test alert dispatched from Should-AI Buy? Command Terminal.',
          severity: 'SUCCESS',
          overrides: { telegramToken, telegramChatId },
        }),
      });
      const data = await res.json();
      if (data.delivered?.telegramSent) {
        setWebhookFeedback({ ok: true, message: 'Telegram test message delivered successfully to your chat!' });
      } else {
        setWebhookFeedback({ ok: false, message: data.delivered?.errors?.[0] || 'Telegram ping failed. Verify token and chat ID.' });
      }
    } catch (err: any) {
      setWebhookFeedback({ ok: false, message: err.message || 'Network error reaching webhook API.' });
    } finally {
      setWebhookTesting(null);
    }
  };

  // Verify Alpaca Connection
  const handleVerifyAlpaca = async () => {
    setAlpacaVerifying(true);
    setAlpacaStatus(null);
    try {
      const res = await fetch('/api/portfolio', { cache: 'no-store' });
      const data = await res.json();
      if (data.account) {
        setAlpacaStatus({
          ok: true,
          message: `Broker connected: Equity $${Number(data.account.equity || 100000).toLocaleString('en-US')} (Paper v2)`,
        });
      } else {
        setAlpacaStatus({ ok: false, message: data.errors?.[0] || 'Failed to verify account on Alpaca Paper v2.' });
      }
    } catch (err: any) {
      setAlpacaStatus({ ok: false, message: err.message || 'Error connecting to Alpaca broker.' });
    } finally {
      setAlpacaVerifying(false);
    }
  };

  const handleClear = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('saib_custom_alpaca_key');
        localStorage.removeItem('saib_custom_alpaca_secret');
        localStorage.removeItem('saib_custom_discord_url');
        localStorage.removeItem('saib_custom_telegram_token');
        localStorage.removeItem('saib_custom_telegram_chat');
        setAlpacaKey('');
        setAlpacaSecret('');
        setDiscordUrl('');
        setTelegramToken('');
        setTelegramChatId('');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch {}
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-2xl bg-[#17161d] border border-[#28272e] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ color: '#e2e8f0' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#28272e] bg-[#121117]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1f1e27] border border-[#28272e] flex items-center justify-center text-[#00ff84]">
              <Key className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                Integrations &amp; API Configuration
              </h2>
              <p className="text-[11px] text-[#848388]">
                Alpaca Paper Brokerage &amp; Outbound Alert Webhooks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#848388] hover:text-white hover:bg-[#1f1e27] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-[#28272e] bg-[#14131a] text-xs font-sans">
          <button
            onClick={() => setActiveTab('alpaca')}
            className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'alpaca'
                ? 'border-[#00ff84] text-[#00ff84]'
                : 'border-transparent text-[#848388] hover:text-white'
            }`}
          >
            Alpaca Broker
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'webhooks'
                ? 'border-[#00ff84] text-[#00ff84]'
                : 'border-transparent text-[#848388] hover:text-white'
            }`}
          >
            Discord &amp; Telegram
          </button>
          <button
            onClick={() => setActiveTab('persistence')}
            className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'persistence'
                ? 'border-[#00ff84] text-[#00ff84]'
                : 'border-transparent text-[#848388] hover:text-white'
            }`}
          >
            Storage &amp; Security
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs font-sans">
          {/* TAB 1: ALPACA */}
          {activeTab === 'alpaca' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-[#14131a] border border-[#28272e] flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-[#848388] leading-relaxed">
                  <strong className="text-white">Strict Paper Trading Sandbox:</strong> Outbound requests target{' '}
                  <code className="text-amber-400">https://paper-api.alpaca.markets/v2</code>. Production endpoints are blocked by fail-closed architectural invariants.
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#848388] uppercase tracking-wider mb-1.5">
                  Alpaca Paper API Key
                </label>
                <input
                  type="text"
                  value={alpacaKey}
                  onChange={(e) => setAlpacaKey(e.target.value)}
                  placeholder="PK..."
                  className="w-full px-3 py-2 rounded-lg bg-[#121117] border border-[#28272e] text-white focus:outline-none focus:border-[#00ff84]/60 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#848388] uppercase tracking-wider mb-1.5">
                  Alpaca Paper Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={alpacaSecret}
                    onChange={(e) => setAlpacaSecret(e.target.value)}
                    placeholder="Secret Key"
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-[#121117] border border-[#28272e] text-white focus:outline-none focus:border-[#00ff84]/60 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-2.5 text-[#848388] hover:text-white cursor-pointer"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleVerifyAlpaca}
                  disabled={alpacaVerifying}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f1e27] hover:bg-[#282733] text-white text-xs font-medium border border-[#28272e] transition cursor-pointer disabled:opacity-50"
                >
                  {alpacaVerifying ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff84]" />
                  )}
                  <span>{alpacaVerifying ? 'Verifying...' : 'Verify Broker Connectivity'}</span>
                </button>
              </div>

              {alpacaStatus && (
                <div
                  className={`p-3 rounded-lg text-[11px] flex items-center gap-2 ${
                    alpacaStatus.ok
                      ? 'bg-emerald-950/20 border border-emerald-900/40 text-[#00ff84]'
                      : 'bg-rose-950/20 border border-rose-900/40 text-[#ff3b5c]'
                  }`}
                >
                  {alpacaStatus.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{alpacaStatus.message}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WEBHOOKS */}
          {activeTab === 'webhooks' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#848388] uppercase tracking-wider">
                    Discord Incoming Webhook URL
                  </label>
                  <button
                    type="button"
                    onClick={handleTestDiscord}
                    disabled={!discordUrl || webhookTesting === 'discord'}
                    className="text-[10px] text-[#38bdf8] hover:underline flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-2.5 h-2.5" />
                    <span>{webhookTesting === 'discord' ? 'Pinging...' : 'Send Test Ping'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-3 py-2 rounded-lg bg-[#121117] border border-[#28272e] text-white focus:outline-none focus:border-[#00ff84]/60 font-mono text-xs"
                />
                <p className="text-[10px] text-[#848388] mt-1">
                  Channel Settings &rarr; Integrations &rarr; Webhooks &rarr; New Webhook
                </p>
              </div>

              <div className="pt-2 border-t border-[#28272e]/60 space-y-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#848388] uppercase tracking-wider">
                    Telegram Bot Token &amp; Chat ID
                  </label>
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={!telegramToken || !telegramChatId || webhookTesting === 'telegram'}
                    className="text-[10px] text-[#38bdf8] hover:underline flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-2.5 h-2.5" />
                    <span>{webhookTesting === 'telegram' ? 'Pinging...' : 'Send Test Ping'}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showTgToken ? 'text' : 'password'}
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl..."
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-[#121117] border border-[#28272e] text-white focus:outline-none focus:border-[#00ff84]/60 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTgToken(!showTgToken)}
                    className="absolute right-2.5 top-2.5 text-[#848388] hover:text-white cursor-pointer"
                  >
                    {showTgToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="Chat ID (e.g. -1001234567890 or 12345678)"
                  className="w-full px-3 py-2 rounded-lg bg-[#121117] border border-[#28272e] text-white focus:outline-none focus:border-[#00ff84]/60 font-mono text-xs"
                />
                <p className="text-[10px] text-[#848388]">
                  Generate bot via @BotFather. Retrieve Chat ID via @userinfobot.
                </p>
              </div>

              {webhookFeedback && (
                <div
                  className={`p-3 rounded-lg text-[11px] flex items-center gap-2 ${
                    webhookFeedback.ok
                      ? 'bg-emerald-950/20 border border-emerald-900/40 text-[#00ff84]'
                      : 'bg-rose-950/20 border border-rose-900/40 text-[#ff3b5c]'
                  }`}
                >
                  {webhookFeedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{webhookFeedback.message}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PERSISTENCE & AWS INVARIANTS */}
          {activeTab === 'persistence' && (
            <div className="space-y-3 text-[11px] text-[#848388] leading-relaxed">
              <div className="p-3 rounded-lg bg-[#14131a] border border-[#28272e] space-y-2">
                <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                  Cloud State &amp; Ledger Persistence
                </h4>
                <p>
                  <strong>Broker-Confirmed Positions &amp; Orders:</strong> All open positions, filled trades, cash balances, and order histories live authoritatively on Alpaca&apos;s cloud infrastructure. They are linked to your API credentials and never reset on application redeployment or AWS server restart.
                </p>
                <p>
                  <strong>Local Client Overrides:</strong> Keys entered into this dialog are stored in browser <code className="text-white">localStorage</code>. When left blank, the application automatically falls back to server-side <code className="text-white">.env.local</code> credentials.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-1.5 rounded-lg bg-[#1f1e27] hover:bg-[#282733] text-rose-400 hover:text-rose-300 border border-[#28272e] text-xs font-medium transition cursor-pointer"
                >
                  Reset to Server Defaults
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#28272e] bg-[#121117]">
          {saveSuccess ? (
            <span className="text-[11px] text-[#00ff84] font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Settings Saved
            </span>
          ) : (
            <span className="text-[10px] text-[#848388]">Changes apply immediately to this browser session.</span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#1e1d26] text-[#848388] hover:text-white transition text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-[#00ff84] text-black font-bold hover:bg-[#00ff84]/90 transition text-xs cursor-pointer shadow-sm"
            >
              Save &amp; Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
