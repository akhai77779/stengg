
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-price-history-every-minute') THEN
    PERFORM cron.unschedule('sync-price-history-every-minute');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-price-history-every-minute',
  '* * * * *',
  $cmd$
  DO $inner$
  DECLARE
    _key TEXT;
    _base TEXT;
  BEGIN
    SELECT decrypted_secret INTO _key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key';

    _base := public.get_functions_base_url();
    IF _key IS NULL OR _base IS NULL THEN
      RAISE WARNING 'sync-price-history cron: missing key or base URL';
      RETURN;
    END IF;

    PERFORM net.http_post(
      url := _base || '/functions/v1/sync-price-history',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _key
      ),
      body := '{}'::jsonb
    );
  END
  $inner$;
  $cmd$
);
