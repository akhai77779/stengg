
SELECT cron.unschedule('run-live-price-sync');

SELECT cron.schedule(
  'run-live-price-sync',
  '* * * * *',
  $$
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
      RAISE WARNING 'run-live-price-sync cron: missing key or base URL';
      RETURN;
    END IF;

    PERFORM net.http_post(
      url := _base || '/functions/v1/run-live-price-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _key
      ),
      body := jsonb_build_object('cycles', 10)
    );
  END
  $inner$;
  $$
);
