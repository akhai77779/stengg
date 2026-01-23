-- Add high_24h and low_24h columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS high_24h numeric NULL,
ADD COLUMN IF NOT EXISTS low_24h numeric NULL;