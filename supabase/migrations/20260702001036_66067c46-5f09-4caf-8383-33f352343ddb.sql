
SELECT cron.unschedule('sync-price-history-every-minute');
SELECT cron.unschedule('settle-expired-option-trades');

SELECT cron.schedule(
  'sync-price-history-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/sync-price-history',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'settle-expired-option-trades',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/settle-expired-trades',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
