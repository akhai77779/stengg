
-- Allow authenticated room owner to mark support/bot messages as read
CREATE POLICY "Room owner marks support messages as read"
ON public.live_chat_messages
FOR UPDATE
TO authenticated
USING (
  sender_type IN ('support','bot')
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_messages.room_id
      AND r.customer_id = (auth.uid())::text
  )
)
WITH CHECK (
  sender_type IN ('support','bot')
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_messages.room_id
      AND r.customer_id = (auth.uid())::text
  )
);

-- Allow guest (with valid session token) to mark support/bot messages as read
CREATE POLICY "Guest marks support messages as read"
ON public.live_chat_messages
FOR UPDATE
TO anon
USING (
  sender_type IN ('support','bot')
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_messages.room_id
      AND r.customer_id LIKE 'guest_%'
      AND public.verify_guest_session(r.customer_id)
  )
)
WITH CHECK (
  sender_type IN ('support','bot')
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE r.id = live_chat_messages.room_id
      AND r.customer_id LIKE 'guest_%'
      AND public.verify_guest_session(r.customer_id)
  )
);
