import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Currency = 'USD' | 'VND';

interface ExchangeRates {
  usd_to_vnd: number;
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  exchangeRates: ExchangeRates;
  formatCurrency: (amount: number, fromCurrency?: Currency) => string;
  convertCurrency: (amount: number, from: Currency, to: Currency) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  usd_to_vnd: 25000,
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('currency');
    return (saved as Currency) || 'USD';
  });

  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);

  useEffect(() => {
    fetchExchangeRates();
  }, []);

  const fetchExchangeRates = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'exchange_rates')
        .single();

      if (error) {
        console.error('Error fetching exchange rates:', error);
        return;
      }

      if (data?.value && typeof data.value === 'object' && 'usd_to_vnd' in data.value) {
        setExchangeRates(data.value as unknown as ExchangeRates);
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
    }
  };

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('currency', newCurrency);
  };

  const convertCurrency = (amount: number, from: Currency, to: Currency): number => {
    if (from === to) return amount;

    if (from === 'USD' && to === 'VND') {
      return amount * exchangeRates.usd_to_vnd;
    }

    if (from === 'VND' && to === 'USD') {
      return amount / exchangeRates.usd_to_vnd;
    }

    return amount;
  };

  const formatCurrency = (amount: number, fromCurrency: Currency = 'USD'): string => {
    const convertedAmount = convertCurrency(amount, fromCurrency, currency);

    if (currency === 'VND') {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(convertedAmount);
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(convertedAmount);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        exchangeRates,
        formatCurrency,
        convertCurrency,
      }}
    >
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
