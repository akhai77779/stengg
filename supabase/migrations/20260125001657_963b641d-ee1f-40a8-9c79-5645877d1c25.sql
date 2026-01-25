-- Add withdrawal_password column to profiles table
ALTER TABLE public.profiles
ADD COLUMN withdrawal_password_hash TEXT DEFAULT NULL;

-- Add comment to describe the column
COMMENT ON COLUMN public.profiles.withdrawal_password_hash IS 'Hashed withdrawal password for secure fund withdrawals';