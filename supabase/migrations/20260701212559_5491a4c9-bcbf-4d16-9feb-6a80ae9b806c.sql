-- Unschedule any leftover jobs pointing to the old backend
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid, jobname FROM cron.job
           WHERE command ILIKE '%avqutkamqeblqirtckir%'
              OR jobname IN ('sync-price-history-every-minute','settle-expired-option-trades','sync-live-price-loop')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- Reschedule market sync jobs on current backend
SELECT cron.schedule(
  'sync-price-history-every-minute',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/sync-price-history',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'settle-expired-option-trades',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/settle-expired-trades',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'run-live-price-sync',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/run-live-price-sync',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('time', now())
  );$$
);