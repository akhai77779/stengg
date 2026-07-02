DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-price-history-every-minute') THEN
    PERFORM cron.unschedule('sync-price-history-every-minute');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'settle-expired-option-trades') THEN
    PERFORM cron.unschedule('settle-expired-option-trades');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping cron unschedule: %', SQLERRM;
END $mig$;

DO $mig$
BEGIN
  PERFORM cron.schedule(
    'sync-price-history-every-minute',
    '* * * * *',
    $CRON$SELECT net.http_post(url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/sync-price-history', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb);$CRON$
  );
  PERFORM cron.schedule(
    'settle-expired-option-trades',
    '* * * * *',
    $CRON$SELECT net.http_post(url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/settle-expired-trades', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb);$CRON$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping cron schedule: %', SQLERRM;
END $mig$;
