-- Drop overly permissive realtime.messages policies that override scoped ones
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Users write own realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can broadcast to own channels" ON realtime.messages;

-- Recreate a tight INSERT policy aligned with the scoped SELECT policy
CREATE POLICY "Authenticated can broadcast to own channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = (SELECT (auth.uid())::text)
  OR realtime.topic() ~~ ((SELECT (auth.uid())::text) || ':%')
  OR realtime.topic() ~~ ('user:' || (SELECT (auth.uid())::text) || '%')
  OR realtime.topic() ~~ 'live_chat:%'
  OR has_role(auth.uid(), 'admin'::app_role)
);