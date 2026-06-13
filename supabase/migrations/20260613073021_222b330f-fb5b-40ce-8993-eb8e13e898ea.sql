
DROP POLICY IF EXISTS "Authenticated users can read uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users read own folder" ON storage.objects;
CREATE POLICY "Authenticated users read own folder"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users read live-chat folder" ON storage.objects;
CREATE POLICY "Authenticated users read live-chat folder"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = 'live-chat');

DROP POLICY IF EXISTS "Admins can read all uploads" ON storage.objects;
CREATE POLICY "Admins can read all uploads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'uploads' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
ON realtime.messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages;
CREATE POLICY "Authenticated can publish realtime"
ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true);
