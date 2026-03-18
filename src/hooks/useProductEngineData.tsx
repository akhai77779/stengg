import { useMemo } from 'react';
import { useMarketEngine } from '@/contexts/MarketEngineContext';
import { aggregateCandles } from '@/lib/chartUtils';
import { OHLCData } from '@/components/charts/CandlestickChart';

type UserTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '1d';

const TF_MAP: Record<UserTimeframe, import('@/types/trading').TimeInterval> = {
  '1m': '1M',
  '5m': '5M',
  '15m': '15M',
  '30m': '30M',
  '1h': '1H',
  '1d': '1D',
};

/**
 * Bridge hook: maps a DB product (by symbol) to the Market Engine
 * and returns live candle data + current price for chart rendering.
 */
export function useProductEngineData(dbSymbol: string | null | undefined, timeframe: UserTimeframe) {
  const {
    products: engineProducts,
    isReady,
    getCandles,
    getCurrentPrice,
  } = useMarketEngine();

  // Find matching engine product by symbol
  const engineProduct = useMemo(() => {
    if (!dbSymbol) return null;
    return engineProducts.find(p => p.symbol === dbSymbol) || null;
  }, [dbSymbol, engineProducts]);

  // Get and aggregate candles based on timeframe
  const candleData: OHLCData[] = useMemo(() => {
    if (!engineProduct) return [];
    const baseCandles = getCandles(engineProduct.id);
    const interval = TF_MAP[timeframe];
    const aggregated = interval === '1M' ? baseCandles : aggregateCandles(baseCandles, interval);

    return aggregated.map(c => ({
      time: new Date(c.time * 1000).toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
  }, [engineProduct, getCandles, timeframe]);

  const currentPrice = engineProduct ? getCurrentPrice(engineProduct.id) : null;

  return {
    isReady,
    engineProduct,
    candleData,
    currentPrice,
    hasEngineData: !!engineProduct && candleData.length > 0,
  };
}
