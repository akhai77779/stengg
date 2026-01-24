-- Step 1: Delete duplicate records, keeping only the newest one per (product_id, recorded_at)
DELETE FROM public.price_history
WHERE id NOT IN (
  SELECT DISTINCT ON (product_id, recorded_at) id
  FROM public.price_history
  ORDER BY product_id, recorded_at, created_at DESC
);

-- Step 2: Add unique constraint
ALTER TABLE public.price_history 
ADD CONSTRAINT price_history_product_id_recorded_at_key 
UNIQUE (product_id, recorded_at);

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_price_history_product_recorded 
ON public.price_history (product_id, recorded_at DESC);