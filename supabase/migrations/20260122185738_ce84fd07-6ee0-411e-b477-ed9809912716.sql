-- Add symbol column to products table for external API integration
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS symbol TEXT;