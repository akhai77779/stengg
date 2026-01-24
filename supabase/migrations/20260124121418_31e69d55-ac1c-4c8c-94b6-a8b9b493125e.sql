-- Add unique constraint for upsert to work properly
ALTER TABLE public.price_history 
ADD CONSTRAINT price_history_product_recorded_unique 
UNIQUE (product_id, recorded_at);