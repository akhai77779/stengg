CREATE OR REPLACE FUNCTION public.run_live_price_sync_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  i INTEGER;
  _key TEXT;
  _base TEXT;
BEGIN
  SELECT decrypted_secret INTO _key
  FROM vault.decrypted_secrets
  WHERE name = 'cron_bearer_token';

  IF _key IS NULL THEN
    RAISE WARNING 'cron_bearer_token not found in vault';
    RETURN;
  END IF;

  _base := public.get_functions_base_url();
  IF _base IS NULL THEN
    RAISE WARNING 'functions_base_url not found in vault';
    RETURN;
  END IF;

  FOR i IN 1..12 LOOP
    PERFORM net.http_post(
      url := _base || '/functions/v1/run-live-price-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _key
      ),
      body := '{"cycles": 1}'::jsonb
    );
    IF i < 12 THEN
      PERFORM pg_sleep(5);
    END IF;
  END LOOP;
END;
$function$;