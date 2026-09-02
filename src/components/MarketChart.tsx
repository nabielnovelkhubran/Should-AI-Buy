'use client';
import React, { useState } from 'react';
import { MarketSnapshot } from '../lib/types';
import { useCurrency } from './CurrencyProvider';

interface MarketChartProps {
  snapshot?: MarketSnapshot;
}

export const MarketChart: React.FC<MarketChartProps> = ({ snapshot }) => {
  const [interval, setInterval] = useState<'1H' | '4H' | '1D' | '7D' | '30D'>('1H');
  const { currency, formatCurrency } = useCurrency();

  if (!snapshot) return null;

  const candles = snapshot.candles[interval] || snapshot.candles['1H'] || [];
  if (candles.length === 0) return null;

  const maxPrice = Math.max(...candles.map(c => c.high));
  const minPrice = Math.min(...candles.map(c => c.low));
  const priceRange = maxPrice - minPrice || 1;

  const firstDate = candles[0]?.dateStr || '';
  const lastDate = candles[candles.length - 1]?.dateStr || '';

  const chartHeight = 160;
  const chartWidth = 550;

  return (
    <div className="p-4 rounded-lg bg-[#1f1e23] border border-[#28272e]">
      
      {/* Header & Timeframe selector */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-[#848388] font-mono uppercase">Interactive Market History</div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            {formatCurrency(snapshot.price, true)}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
              snapshot.change24h >= 0 ? 'bg-[#00ff84]/10 text-[#00ff84]' : 'bg-rose-500/20 text-[#ff3b5c]'
            }`}>
              {snapshot.change24h >= 0 ? '+' : ''}{snapshot.change24h}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#1f1e23] p-1 rounded-lg border border-[#28272e]">
          {(['1H', '4H', '1D', '7D', '30D'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setInterval(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                interval === t ? 'bg-[#00ff84] text-black font-bold' : 'text-[#8b8a91] hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Candlestick Chart */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44">
          {/* Background Grid Lines */}
          <line x1="0" y1="40" x2={chartWidth} y2="40" stroke="#1e2433" strokeDasharray="4 4" />
          <line x1="0" y1="80" x2={chartWidth} y2="80" stroke="#1e2433" strokeDasharray="4 4" />
          <line x1="0" y1="120" x2={chartWidth} y2="120" stroke="#1e2433" strokeDasharray="4 4" />

          {/* Candle Bars */}
          {candles.map((candle, idx) => {
            const candleWidth = (chartWidth / candles.length) * 0.7;
            const x = (idx * (chartWidth / candles.length)) + 5;
            
            const isBullish = candle.close >= candle.open;
            const topY = chartHeight - ((candle.high - minPrice) / priceRange) * chartHeight;
            const botY = chartHeight - ((candle.low - minPrice) / priceRange) * chartHeight;
            
            const openY = chartHeight - ((candle.open - minPrice) / priceRange) * chartHeight;
            const closeY = chartHeight - ((candle.close - minPrice) / priceRange) * chartHeight;
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));

            return (
              <g key={idx} className="transition hover:opacity-80">
                <title>{`${candle.dateStr}: O $${candle.open} H $${candle.high} L $${candle.low} C $${candle.close}`}</title>
                {/* Wick */}
                <line
                  x1={x + candleWidth / 2}
                  y1={topY}
                  x2={x + candleWidth / 2}
                  y2={botY}
                  stroke={isBullish ? '#10b981' : '#ef4444'}
                  strokeWidth="1.5"
                />
                {/* Body */}
                <rect
                  x={x}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={isBullish ? '#10b981' : '#ef4444'}
                  rx="1"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#2d3748] font-mono mt-2 pt-2 border-t border-[#28272e]/80">
        <span>Low: {formatCurrency(minPrice, true)}</span>
        <span>
          {interval} ({candles.length} bars{firstDate && lastDate ? ` • ${firstDate} - ${lastDate}` : ''}) · {currency}
        </span>
        <span>High: {formatCurrency(maxPrice, true)}</span>
      </div>

    </div>
  );
};
