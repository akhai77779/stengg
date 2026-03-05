import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CandleRow {
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  product_id: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  volume: string | null;
  turnover: string | null;
  price_change: number | null;
  category: string | null;
}

export interface ProductWithChart extends Product {
  candles: CandleRow[];
}

export function useProductsData(userId: string | undefined) {
  const [products, setProducts] = useState<ProductWithChart[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, image_url, price, volume, turnover, price_change, category')
      .order('created_at', { ascending: false });

    if (error || !data) {
      setIsLoading(false);
      return;
    }

    setProducts(data.map(p => ({ ...p, candles: [] })));
    setIsLoading(false);

    const productIds = data.map(p => p.id);
    if (productIds.length === 0) return;

    const { data: allCandles } = await supabase
      .from('price_history')
      .select('product_id, open_price, high_price, low_price, close_price, recorded_at')
      .in('product_id', productIds)
      .order('recorded_at', { ascending: false })
      .limit(30 * productIds.length);

    if (!allCandles) return;

    const candleMap: Record<string, CandleRow[]> = {};
    for (const c of allCandles) {
      if (!candleMap[c.product_id]) candleMap[c.product_id] = [];
      if (candleMap[c.product_id].length < 30) {
        candleMap[c.product_id].push(c as CandleRow);
      }
    }
    for (const id of Object.keys(candleMap)) {
      candleMap[id].reverse();
    }

    setProducts(data.map(p => ({ ...p, candles: candleMap[p.id] || [] })));
  }, []);

  useEffect(() => {
    if (userId) fetchProducts();
  }, [userId, fetchProducts]);

  // Realtime: product updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('products-list-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        setProducts(prev => prev.map(p =>
          p.id === payload.new.id ? { ...p, ...(payload.new as Product) } : p
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Realtime: price history updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('products-price-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_history' }, (payload) => {
        const row = payload.new as CandleRow & { recorded_at: string };
        if (!row?.product_id) return;
        setProducts(prev => prev.map(p => {
          if (p.id !== row.product_id) return p;
          const existing = p.candles.findIndex((c: CandleRow & { recorded_at?: string }) =>
            (c as unknown as { recorded_at: string }).recorded_at === row.recorded_at
          );
          const updated = existing >= 0
            ? p.candles.map((c, i) => i === existing ? row : c)
            : [...p.candles.slice(-29), row];
          return { ...p, candles: updated };
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return { products, isLoading };
}
