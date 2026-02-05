-- Insert default withdraw settings if not exists
INSERT INTO public.app_settings (key, value)
VALUES ('withdraw_settings', '{"fee_rate": 0.01, "min_amount": 10}'::jsonb)
ON CONFLICT (key) DO NOTHING;