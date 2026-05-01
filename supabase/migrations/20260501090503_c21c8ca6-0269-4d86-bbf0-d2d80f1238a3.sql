
-- 1) Fix run_live_price_sync_loop: correct function name + service role key
CREATE OR REPLACE FUNCTION public.run_live_price_sync_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  i INTEGER;
  _key TEXT;
BEGIN
  SELECT decrypted_secret INTO _key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF _key IS NULL THEN
    RAISE WARNING 'Service role key not found in vault';
    RETURN;
  END IF;

  FOR i IN 1..12 LOOP
    PERFORM net.http_post(
      url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/run-live-price-sync',
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

-- 2) Reschedule settle-expired-trades cron with service role key
SELECT cron.unschedule('settle-expired-trades');

SELECT cron.schedule(
  'settle-expired-trades',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/settle-expired-trades',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- 3) Reschedule settle-matured-savings-hourly cron with service role key
SELECT cron.unschedule('settle-matured-savings-hourly');

SELECT cron.schedule(
  'settle-matured-savings-hourly',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/settle-matured-savings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $cron$
);
