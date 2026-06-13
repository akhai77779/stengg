
-- Restrict Realtime channel subscriptions to authenticated users only
-- and require users to subscribe to channels matching their own user id.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to own channels" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to own channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow if topic matches user's id, OR topic starts with user id (per-user channel)
  -- OR topic is a known public/admin channel (live_chat, products, etc.)
  realtime.topic() = (SELECT auth.uid()::text)
  OR realtime.topic() LIKE (SELECT auth.uid()::text) || ':%'
  OR realtime.topic() LIKE 'user:' || (SELECT auth.uid()::text) || '%'
  OR realtime.topic() IN ('products', 'price_history', 'engine_state', 'shock_events', 'hero_banners', 'news', 'charity_programs', 'savings_packages')
  OR realtime.topic() LIKE 'product:%'
  OR realtime.topic() LIKE 'live_chat:%'
);

DROP POLICY IF EXISTS "Authenticated can broadcast to own channels" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast to own channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = (SELECT auth.uid()::text)
  OR realtime.topic() LIKE (SELECT auth.uid()::text) || ':%'
  OR realtime.topic() LIKE 'user:' || (SELECT auth.uid()::text) || '%'
  OR realtime.topic() LIKE 'live_chat:%'
);
