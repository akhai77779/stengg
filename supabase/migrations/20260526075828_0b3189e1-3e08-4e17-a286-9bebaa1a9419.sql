
-- 1. Extend live_chat_rooms
ALTER TABLE public.live_chat_rooms
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- 2. Extend live_chat_messages
ALTER TABLE public.live_chat_messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 3. agent_presence
CREATE TABLE IF NOT EXISTS public.agent_presence (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','away','offline')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage agent presence" ON public.agent_presence;
CREATE POLICY "Admins manage agent presence"
  ON public.agent_presence
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone authenticated views agent presence" ON public.agent_presence;
CREATE POLICY "Anyone authenticated views agent presence"
  ON public.agent_presence
  FOR SELECT
  TO authenticated
  USING (true);

-- Guests also need to read presence to show online badge
DROP POLICY IF EXISTS "Anon can view agent presence" ON public.agent_presence;
CREATE POLICY "Anon can view agent presence"
  ON public.agent_presence
  FOR SELECT
  TO anon
  USING (true);

-- 4. room_tags
CREATE TABLE IF NOT EXISTS public.room_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  tag text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_tags_room ON public.room_tags(room_id);

ALTER TABLE public.room_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage room tags" ON public.room_tags;
CREATE POLICY "Admins manage room tags"
  ON public.room_tags
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Expanded RLS for delivered_at on messages
-- Authenticated users can mark support/bot messages in their own room as delivered
DROP POLICY IF EXISTS "Room owner marks support messages as delivered" ON public.live_chat_messages;
CREATE POLICY "Room owner marks support messages as delivered"
  ON public.live_chat_messages
  FOR UPDATE
  TO authenticated
  USING (
    (sender_type = ANY (ARRAY['support'::text, 'bot'::text])) AND EXISTS (
      SELECT 1 FROM public.live_chat_rooms r
      WHERE r.id = live_chat_messages.room_id
        AND r.customer_id = auth.uid()::text
    )
  )
  WITH CHECK (
    (sender_type = ANY (ARRAY['support'::text, 'bot'::text])) AND EXISTS (
      SELECT 1 FROM public.live_chat_rooms r
      WHERE r.id = live_chat_messages.room_id
        AND r.customer_id = auth.uid()::text
    )
  );

-- (Existing "Guest marks support messages as read" already covers update of read_at AND delivered_at
-- because UPDATE policy applies to whole row; no additional anon policy required.)

-- 6. Trigger to keep agent_presence.updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_agent_presence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_agent_presence ON public.agent_presence;
CREATE TRIGGER trg_touch_agent_presence
  BEFORE UPDATE ON public.agent_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_agent_presence();

-- 7. Helper: count of currently online admins (last_seen_at within 2 min)
CREATE OR REPLACE FUNCTION public.online_admin_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.agent_presence
  WHERE status = 'online'
    AND last_seen_at > (now() - interval '2 minutes');
$$;

GRANT EXECUTE ON FUNCTION public.online_admin_count() TO anon, authenticated;
