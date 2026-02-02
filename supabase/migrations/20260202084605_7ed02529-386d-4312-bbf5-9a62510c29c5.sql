-- ===========================================
-- FIX 1: Rate limiting for live_chat_rooms creation
-- ===========================================

-- Create a function to check and enforce room creation limits
CREATE OR REPLACE FUNCTION public.check_live_chat_room_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_count INTEGER;
  max_rooms CONSTANT INTEGER := 5;
  window_hours CONSTANT INTEGER := 1;
BEGIN
  -- Count active/waiting rooms for this customer in the last hour
  SELECT COUNT(*)
  INTO room_count
  FROM public.live_chat_rooms
  WHERE customer_id = NEW.customer_id
    AND status IN ('active', 'waiting')
    AND created_at > NOW() - INTERVAL '1 hour' * window_hours;

  IF room_count >= max_rooms THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum % chat rooms per hour allowed', max_rooms;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to enforce rate limit on INSERT
DROP TRIGGER IF EXISTS enforce_live_chat_room_limit ON public.live_chat_rooms;
CREATE TRIGGER enforce_live_chat_room_limit
  BEFORE INSERT ON public.live_chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.check_live_chat_room_limit();

-- ===========================================
-- FIX 2: Whitelist specific readable app_settings keys
-- ===========================================

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone authenticated can read exchange_rates" ON public.app_settings;

-- Create new policy with explicit whitelist
CREATE POLICY "Authenticated users can read whitelisted settings"
  ON public.app_settings
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR (
      auth.role() = 'authenticated' 
      AND key IN ('exchange_rates', 'support_enabled', 'banners_enabled')
    )
  );