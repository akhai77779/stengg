CREATE POLICY "Admins can upload to shared uploads folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND (storage.foldername(name))[1] IN ('products', 'news', 'banners', 'deposit-qr', 'charity', 'savings')
);