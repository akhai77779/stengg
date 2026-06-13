
-- Drop the public read policy that exposes all uploads
DROP POLICY IF EXISTS "Public read access for uploads" ON storage.objects;

-- Authenticated users can read any file in uploads (they get signed URLs via client)
CREATE POLICY "Authenticated users can read uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'uploads');

-- Guests can read live-chat files only in their own verified room
CREATE POLICY "Guests can read own live-chat files"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'live-chat'
  AND EXISTS (
    SELECT 1 FROM public.live_chat_rooms r
    WHERE (r.id)::text = (storage.foldername(objects.name))[2]
      AND r.customer_id LIKE 'guest_%'
      AND public.verify_guest_session(r.customer_id)
  )
);
