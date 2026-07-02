DO $mig$
BEGIN
  UPDATE public.news SET image_url = NULL WHERE image_url LIKE '%avqutkamqeblqirtckir%';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping news image cleanup: %', SQLERRM;
END $mig$;
