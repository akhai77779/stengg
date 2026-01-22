-- Add wallet address columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wallet_address_bep20 TEXT,
ADD COLUMN IF NOT EXISTS wallet_address_trc20 TEXT,
ADD COLUMN IF NOT EXISTS wallet_address_erc20 TEXT;