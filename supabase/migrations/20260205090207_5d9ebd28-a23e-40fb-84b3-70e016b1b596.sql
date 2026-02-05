-- Update the whitelist policy to include withdraw_settings
DROP POLICY IF EXISTS "Authenticated users can read whitelisted settings" ON public.app_settings;

CREATE POLICY "Authenticated users can read whitelisted settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key IN ('exchange_rates', 'option_times', 'withdraw_settings'));