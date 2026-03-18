import React, { createContext, useContext, ReactNode } from 'react';
import { useMarketEngine as useMarketEngineHook } from '@/hooks/useMarketEngine';

type MarketEngineReturn = ReturnType<typeof useMarketEngineHook>;

const MarketEngineContext = createContext<MarketEngineReturn | null>(null);

export function MarketEngineProvider({ children }: { children: ReactNode }) {
  const engine = useMarketEngineHook();
  return (
    <MarketEngineContext.Provider value={engine}>
      {children}
    </MarketEngineContext.Provider>
  );
}

export function useMarketEngine(): MarketEngineReturn {
  const ctx = useContext(MarketEngineContext);
  if (!ctx) {
    throw new Error('useMarketEngine must be used within MarketEngineProvider');
  }
  return ctx;
}
