-- 1. Fix live_chat_messages anon INSERT policy to require verify_guest_session
DROP POLICY IF EXISTS "Secure send messages to room" ON public.live_chat_messages;

CREATE POLICY "Secure send messages to room"
ON public.live_chat_messages
FOR INSERT
TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.live_chat_rooms r
      WHERE r.id = live_chat_messages.room_id
        AND r.customer_id = (auth.uid())::text
    )
  )
  OR (
    auth.uid() IS NULL
    AND EXISTS (
      SELECT 1 FROM public.live_chat_rooms r
      WHERE r.id = live_chat_messages.room_id
        AND r.customer_id LIKE 'guest_%'
        AND public.verify_guest_session(r.customer_id)
    )
  )
);

-- 2. Fix anonymous live-chat storage policies to require verify_guest_session
DROP POLICY IF EXISTS "Allow anonymous uploads for live-chat" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous updates for live-chat" ON storage.objects;

CREATE POLICY "Allow anonymous uploads for live-chat"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'live-chat'
  AND (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.live_chat_rooms r
      WHERE r.id::text = (storage.foldername(name))[2]
        AND r.customer_id LIKE 'guest_%'
        AND public.verify_guest_session(r.customer_id)
    )
  )
);

CREATE POLICY "Allow anonymous updates for live-chat"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'live-chat'
  AND (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.live_chat_rooms r
      WHERE r.id::text = (storage.foldername(name))[2]
        AND r.customer_id LIKE 'guest_%'
        AND public.verify_guest_session(r.customer_id)
    )
  )
);