
-- Ensure pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add hashed token column
ALTER TABLE public.live_chat_rooms
  ADD COLUMN IF NOT EXISTS guest_token_hash text;

-- 2. Header-reading helpers
CREATE OR REPLACE FUNCTION public.current_guest_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NULLIF(
    (current_setting('request.headers', true)::json) ->> 'x-guest-id',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.current_guest_token()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NULLIF(
    (current_setting('request.headers', true)::json) ->> 'x-guest-token',
    ''
  );
$$;

-- 3. Verify the supplied token matches stored hash for a customer_id
CREATE OR REPLACE FUNCTION public.verify_guest_session(_customer_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.live_chat_rooms r
    WHERE r.customer_id = _customer_id
      AND _customer_id = public.current_guest_id()
      AND r.guest_token_hash IS NOT NULL
      AND public.current_guest_token() IS NOT NULL
      AND r.guest_token_hash = encode(
        extensions.digest(public.current_guest_token(), 'sha256'),
        'hex'
      )
  );
$$;

-- 4. Drop old permissive anon policies
DROP POLICY IF EXISTS "Guests view own rooms by customer_id" ON public.live_chat_rooms;
DROP POLICY IF EXISTS "Guests create own rooms"             ON public.live_chat_rooms;
DROP POLICY IF EXISTS "Guests update rooms"                 ON public.live_chat_rooms;

DROP POLICY IF EXISTS "Guests view room messages" ON public.live_chat_messages;
DROP POLICY IF EXISTS "Guests insert messages"    ON public.live_chat_messages;

DROP POLICY IF EXISTS "Guests view typing"   ON public.live_chat_typing;
DROP POLICY IF EXISTS "Guests insert typing" ON public.live_chat_typing;
DROP POLICY IF EXISTS "Guests update typing" ON public.live_chat_typing;
DROP POLICY IF EXISTS "Guests delete typing" ON public.live_chat_typing;

-- 5. New token-scoped policies for live_chat_rooms
CREATE POLICY "Guests view own room by token"
ON public.live_chat_rooms FOR SELECT TO anon
USING (
  customer_id LIKE 'guest_%'
  AND public.verify_guest_session(customer_id)
);

CREATE POLICY "Guests update own room by token"
ON public.live_chat_rooms FOR UPDATE TO anon
USING (
  customer_id LIKE 'guest_%'
  AND public.verify_guest_session(customer_id)
)
WITH CHECK (
  customer_id LIKE 'guest_%'
  AND public.verify_guest_session(customer_id)
);

-- Guest INSERT on rooms removed: edge function (service role) creates rooms.

-- 6. New token-scoped policies for live_chat_messages
CREATE POLICY "Guests view own room messages by token"
ON public.live_chat_messages FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_messages.room_id
      AND r.customer_id LIKE 'guest_%'
      AND public.verify_guest_session(r.customer_id)
  )
);

CREATE POLICY "Guests insert messages by token"
ON public.live_chat_messages FOR INSERT TO anon
WITH CHECK (
  sender_id LIKE 'guest_%'
  AND sender_type = 'customer'
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_messages.room_id
      AND r.customer_id = sender_id
      AND public.verify_guest_session(r.customer_id)
  )
);

-- 7. New token-scoped policies for live_chat_typing
CREATE POLICY "Guests view typing by token"
ON public.live_chat_typing FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_typing.room_id
      AND r.customer_id LIKE 'guest_%'
      AND public.verify_guest_session(r.customer_id)
  )
);

CREATE POLICY "Guests insert typing by token"
ON public.live_chat_typing FOR INSERT TO anon
WITH CHECK (
  user_id LIKE 'guest_%'
  AND user_type = 'customer'
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_typing.room_id
      AND r.customer_id = user_id
      AND public.verify_guest_session(r.customer_id)
  )
);

CREATE POLICY "Guests update typing by token"
ON public.live_chat_typing FOR UPDATE TO anon
USING (
  user_id LIKE 'guest_%'
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_typing.room_id
      AND r.customer_id = user_id
      AND public.verify_guest_session(r.customer_id)
  )
)
WITH CHECK (user_id LIKE 'guest_%');

CREATE POLICY "Guests delete typing by token"
ON public.live_chat_typing FOR DELETE TO anon
USING (
  user_id LIKE 'guest_%'
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_typing.room_id
      AND r.customer_id = user_id
      AND public.verify_guest_session(r.customer_id)
  )
);
