import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CandleRow {
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  product_id: string;
  recorded_at?: string;
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
  symbol: string | null;
  high_24h: number | null;
  low_24h: number | null;
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
      .select('id, name, description, image_url, price, volume, turnover, price_change, category, symbol, high_24h, low_24h')
      .order('created_at', { ascending: false });

    if (error || !data) {
      setIsLoading(false);
      return;
    }

    setProducts(data.map(p => ({ ...p, candles: [] })));
    setIsLoading(false);
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

  return { products, isLoading };
}
