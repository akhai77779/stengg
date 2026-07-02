DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-price-history-every-minute') THEN
    PERFORM cron.unschedule('sync-price-history-every-minute');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'settle-expired-option-trades') THEN
    PERFORM cron.unschedule('settle-expired-option-trades');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-price-history-every-minute',
  '* * * * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/sync-price-history',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $CRON$
);

SELECT cron.schedule(
  'settle-expired-option-trades',
  '* * * * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/settle-expired-trades',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $CRON$
);
