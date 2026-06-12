DROP POLICY IF EXISTS "Anyone can view active deposit settings" ON public.deposit_settings;
CREATE POLICY "Authenticated users can view active deposit settings"
ON public.deposit_settings
FOR SELECT
TO authenticated
USING (is_active = true);