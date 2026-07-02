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
    $CRON$SELECT net.http_post(url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/sync-price-history', headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGlkZGNlbHl4ZmJ5dnNsb3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDI5NjQsImV4cCI6MjA4OTUxODk2NH0._A6_ykyYi7FqoAMO46ntG2q-oyRSWmtBKB7ANqcBlxc"}'::jsonb, body := '{}'::jsonb) AS request_id;$CRON$
  );
  PERFORM cron.schedule(
    'settle-expired-option-trades',
    '* * * * *',
    $CRON$SELECT net.http_post(url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/settle-expired-trades', headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGlkZGNlbHl4ZmJ5dnNsb3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDI5NjQsImV4cCI6MjA4OTUxODk2NH0._A6_ykyYi7FqoAMO46ntG2q-oyRSWmtBKB7ANqcBlxc"}'::jsonb, body := '{}'::jsonb) AS request_id;$CRON$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping cron schedule: %', SQLERRM;
END $mig$;
