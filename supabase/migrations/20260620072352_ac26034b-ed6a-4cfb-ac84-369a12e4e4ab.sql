
DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'process-telegram-outbox-every-30s' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'process-telegram-outbox-every-30s',
  '30 seconds',
  $cron$
  SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/process-telegram-outbox',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGlkZGNlbHl4ZmJ5dnNsb3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDI5NjQsImV4cCI6MjA4OTUxODk2NH0._A6_ykyYi7FqoAMO46ntG2q-oyRSWmtBKB7ANqcBlxc"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $cron$
);
