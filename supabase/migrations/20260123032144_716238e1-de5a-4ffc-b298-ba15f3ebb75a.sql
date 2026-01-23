-- Add columns for account freezing and trading lock
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_trade_frozen BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
ADD COLUMN IF NOT EXISTS user_code INTEGER;

-- Create sequence for user codes starting at 68101
CREATE SEQUENCE IF NOT EXISTS user_code_seq START WITH 68101;

-- Update existing users with sequential codes
UPDATE public.profiles 
SET user_code = nextval('user_code_seq')
WHERE user_code IS NULL;

-- Create trigger to auto-assign user code on new profile
CREATE OR REPLACE FUNCTION public.assign_user_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_code IS NULL THEN
    NEW.user_code := nextval('user_code_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assign_user_code ON public.profiles;
CREATE TRIGGER trigger_assign_user_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_user_code();