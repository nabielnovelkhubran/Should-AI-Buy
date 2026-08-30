"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'IDR';

const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 150.5,
  IDR: 15600,
};

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatCurrency: (amount: number, forceDecimals?: boolean) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('USD');

  const formatCurrency = (amount: number, forceDecimals?: boolean) => {
    const converted = amount * EXCHANGE_RATES[currency];
    
    // For large denominations like IDR/JPY, we usually drop cents unless forced
    const isZeroDecimal = currency === 'IDR' || currency === 'JPY';
    const minDecimals = forceDecimals ? 2 : (isZeroDecimal ? 0 : 2);
    const maxDecimals = forceDecimals ? 4 : (isZeroDecimal ? 0 : 2);

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(converted);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
