-- Add volume and price_change fields for trade products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS volume text DEFAULT '0',
ADD COLUMN IF NOT EXISTS price_change numeric DEFAULT 0;