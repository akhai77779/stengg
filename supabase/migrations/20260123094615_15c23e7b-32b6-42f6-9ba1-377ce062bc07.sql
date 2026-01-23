-- Add turnover column to products table for 24h trading turnover
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS turnover text NULL;