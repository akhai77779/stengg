
-- 1) Hide withdrawal_password_hash from client roles (column-level)
REVOKE SELECT (withdrawal_password_hash) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (withdrawal_password_hash, balance, total_income, user_code, is_frozen, is_trade_frozen, frozen_reason) ON public.profiles FROM anon, authenticated;

-- 2) Add WITH CHECK to profile UPDATE policy (defense in depth alongside existing trigger)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3) Lock down realtime.messages (Broadcast/Presence). postgres_changes is unaffected.
DROP POLICY IF EXISTS "Authenticated can read public realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write public realtime topics" ON realtime.messages;

-- Only allow topics scoped to the user's own uid, or admin-managed topics.
CREATE POLICY "Users access own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users write own realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
