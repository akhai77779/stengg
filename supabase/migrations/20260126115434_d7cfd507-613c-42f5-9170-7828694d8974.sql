-- Drop existing policy that only allows pending status updates
DROP POLICY IF EXISTS "Users can update own pending verification" ON public.identity_verifications;

-- Create new policy that allows users to update their own verification when pending OR rejected
CREATE POLICY "Users can update own pending or rejected verification"
ON public.identity_verifications
FOR UPDATE
USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));