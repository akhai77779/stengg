
-- Table to store temporary SMS OTP codes
CREATE TABLE public.phone_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  full_name TEXT,
  password_hash TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_phone_otps_phone_code ON public.phone_otps (phone, code);

-- Auto-cleanup expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_phone_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.phone_otps WHERE expires_at < now() OR verified = true;
END;
$$;

-- Enable RLS
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- No direct client access - only edge functions via service role
-- No policies needed as all access goes through SECURITY DEFINER edge functions
