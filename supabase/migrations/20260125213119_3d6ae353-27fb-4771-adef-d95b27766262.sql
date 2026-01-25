-- Fix: Recreate profiles_safe view with explicit SECURITY INVOKER
-- This ensures the view inherits RLS policies from the base 'profiles' table
-- Users will only see their own data, admins can see all data

-- Drop the existing view
DROP VIEW IF EXISTS public.profiles_safe;

-- Recreate with security_invoker enabled
CREATE VIEW public.profiles_safe
WITH (security_invoker = on) AS
SELECT 
    id,
    full_name,
    email,
    phone,
    avatar_url,
    department,
    "position",
    balance,
    total_income,
    wallet_address_bep20,
    wallet_address_trc20,
    wallet_address_erc20,
    user_code,
    is_frozen,
    is_trade_frozen,
    frozen_reason,
    last_login_at,
    created_at,
    updated_at
FROM profiles;

-- Add comment documenting the security design
COMMENT ON VIEW public.profiles_safe IS 'Secure view of profiles table that excludes sensitive fields (withdrawal_password_hash, last_login_ip). Uses security_invoker=on to inherit RLS policies from the base profiles table, ensuring users can only access their own data.';