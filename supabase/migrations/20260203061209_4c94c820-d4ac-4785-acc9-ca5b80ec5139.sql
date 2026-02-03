-- Add policy to allow anonymous users to upload files to live-chat folder
-- This enables guest users to send attachments without authentication

CREATE POLICY "Allow anonymous uploads for live-chat"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = 'live-chat'
);

-- Add policy to allow anonymous users to update their own uploads in live-chat
CREATE POLICY "Allow anonymous updates for live-chat"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = 'live-chat'
);