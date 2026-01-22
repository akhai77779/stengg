-- Add RLS policies for rate_limits (used internally for throttling)
-- Table already exists; ensure RLS is enabled
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view only their own rate limit rows
DROP POLICY IF EXISTS "Users can view own rate limits" ON public.rate_limits;
CREATE POLICY "Users can view own rate limits"
  ON public.rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users (and security-definer functions called by them) can insert only their own rows
DROP POLICY IF EXISTS "Users can insert own rate limits" ON public.rate_limits;
CREATE POLICY "Users can insert own rate limits"
  ON public.rate_limits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policies on purpose.