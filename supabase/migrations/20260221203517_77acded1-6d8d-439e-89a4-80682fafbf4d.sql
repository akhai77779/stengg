
ALTER TABLE public.product_price_controls 
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
