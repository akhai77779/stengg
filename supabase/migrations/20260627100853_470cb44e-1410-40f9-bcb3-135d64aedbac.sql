DO $$
BEGIN
  UPDATE auth.users SET email_confirmed_at = now() WHERE email = '840974672855@phone.local' AND email_confirmed_at IS NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped auth.users backfill: %', SQLERRM;
END $$;
