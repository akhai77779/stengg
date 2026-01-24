-- Enable realtime for price_history table
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_history;

-- Create index for fast lookups by product and time
CREATE INDEX IF NOT EXISTS idx_price_history_product_recorded 
ON public.price_history (product_id, recorded_at DESC);