-- ===========================================
-- XÓA CẤU TRÚC ĐỊA CHỈ VÍ CRYPTO (TRC20, ERC20, BEP20)
-- ===========================================

-- 1. Xóa view profiles_safe hiện tại
DROP VIEW IF EXISTS public.profiles_safe;

-- 2. Xóa các cột wallet address từ bảng profiles
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS wallet_address_bep20,
DROP COLUMN IF EXISTS wallet_address_trc20,
DROP COLUMN IF EXISTS wallet_address_erc20;

-- 3. Tạo lại view profiles_safe KHÔNG có wallet addresses
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
    user_code,
    is_frozen,
    is_trade_frozen,
    frozen_reason,
    last_login_at,
    created_at,
    updated_at
FROM profiles;

-- 4. Comment documenting the view
COMMENT ON VIEW public.profiles_safe IS 'Secure view of profiles table that excludes sensitive fields (withdrawal_password_hash, last_login_ip, wallet_address_*). Uses security_invoker=on to inherit RLS policies.';

-- 5. Grant permissions
GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.profiles_safe TO anon;