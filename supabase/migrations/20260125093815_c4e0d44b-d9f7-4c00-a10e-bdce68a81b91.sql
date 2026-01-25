-- Allow all authenticated users to read exchange_rates from app_settings
CREATE POLICY "Anyone authenticated can read exchange_rates"
ON public.app_settings
FOR SELECT
USING (key = 'exchange_rates');