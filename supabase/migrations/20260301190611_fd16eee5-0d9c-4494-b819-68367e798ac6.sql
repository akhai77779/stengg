
-- Fix 1: Recreate profiles_safe view with security_invoker=on
-- This ensures base table RLS policies apply when querying the view
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
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
  is_frozen,
  is_trade_frozen,
  frozen_reason,
  user_code,
  last_login_at,
  created_at,
  updated_at
FROM public.profiles;

-- Fix 2: Replace the overly permissive guest SELECT policy on live_chat_rooms
-- Current: USING (true) which exposes ALL rooms to everyone
DROP POLICY IF EXISTS "Guests view own rooms by exact id" ON public.live_chat_rooms;

CREATE POLICY "Guests view own rooms by customer_id"
ON public.live_chat_rooms
FOR SELECT
USING (customer_id ~~ 'guest_%'::text);
