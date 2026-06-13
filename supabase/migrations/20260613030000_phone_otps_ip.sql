ALTER TABLE public.phone_otps ADD COLUMN IF NOT EXISTS ip_address text;
CREATE INDEX IF NOT EXISTS idx_phone_otps_ip_created ON public.phone_otps (ip_address, created_at);
