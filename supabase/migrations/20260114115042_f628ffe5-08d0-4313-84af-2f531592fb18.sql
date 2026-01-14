-- Create price_history table for OHLC candlestick data
CREATE TABLE public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  open_price NUMERIC NOT NULL,
  high_price NUMERIC NOT NULL,
  low_price NUMERIC NOT NULL,
  close_price NUMERIC NOT NULL,
  volume NUMERIC DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries by product and time
CREATE INDEX idx_price_history_product_time 
ON public.price_history(product_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view price history
CREATE POLICY "Anyone authenticated can view price history"
  ON public.price_history FOR SELECT
  USING (true);

-- Admins can manage price history
CREATE POLICY "Admins can manage price history"
  ON public.price_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial OHLC data for each product (720 records = 30 days x 24 hours)
INSERT INTO public.price_history (
  product_id, open_price, high_price, low_price, close_price, volume, recorded_at
)
SELECT 
  p.id,
  p.price * (1 + (random() - 0.5) * 0.08),
  GREATEST(p.price * (1 + (random() - 0.5) * 0.08), p.price * (1 + random() * 0.05)),
  LEAST(p.price * (1 + (random() - 0.5) * 0.08), p.price * (1 - random() * 0.05)),
  p.price * (1 + (random() - 0.5) * 0.1),
  floor(random() * 1000000),
  now() - (gs.n * interval '1 hour')
FROM products p
CROSS JOIN generate_series(1, 720) AS gs(n)
WHERE p.status = 'available' AND p.price IS NOT NULL;