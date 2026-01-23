-- Fix function search path for assign_user_code
CREATE OR REPLACE FUNCTION public.assign_user_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_code IS NULL THEN
    NEW.user_code := nextval('user_code_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;