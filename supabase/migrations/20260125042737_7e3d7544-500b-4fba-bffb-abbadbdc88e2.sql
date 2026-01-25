-- Create a secure view that excludes sensitive fields (withdrawal_password_hash, last_login_ip)
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  full_name,
  email,
  phone,
  avatar_url,
  department,
  position,
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
FROM public.profiles;
-- Intentionally excludes: withdrawal_password_hash, last_login_ip

-- Grant access to authenticated and anonymous users
GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.profiles_safe TO anon;

-- Create a helper function to check if user has withdrawal password without exposing the hash
CREATE OR REPLACE FUNCTION public.has_withdrawal_password(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = _user_id 
      AND withdrawal_password_hash IS NOT NULL
      AND withdrawal_password_hash != ''
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.has_withdrawal_password(UUID) TO authenticated;