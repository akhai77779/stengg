DO $$
DECLARE
  _jobid bigint;
BEGIN
  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'process-telegram-outbox-every-30s';
  IF _jobid IS NOT NULL THEN
    PERFORM cron.unschedule(_jobid);
  END IF;

  PERFORM cron.schedule(
    'process-telegram-outbox-every-30s',
    '*/30 * * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/process-telegram-outbox',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGlkZGNlbHl4ZmJ5dnNsb3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDI5NjQsImV4cCI6MjA4OTUxODk2NH0._A6_ykyYi7FqoAMO46ntG2q-oyRSWmtBKB7ANqcBlxc'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
    $cron$
  );
END $$;