-- Allow authenticated users to read bankquay_enabled setting
DROP POLICY IF EXISTS "Authenticated users can read whitelisted settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read whitelisted settings"
ON public.app_settings
FOR SELECT
USING (key = ANY (ARRAY['exchange_rates'::text, 'option_times'::text, 'withdraw_settings'::text, 'bankquay_enabled'::text]));
