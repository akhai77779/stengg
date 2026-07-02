DO $mig$
BEGIN
  UPDATE public.products SET image_url = NULL WHERE image_url LIKE '%avqutkamqeblqirtckir%';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping product image cleanup: %', SQLERRM;
END $mig$;

DO $mig$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('sync-price-history-every-minute','settle-expired-option-trades');
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

CREATE OR REPLACE FUNCTION public.run_live_price_sync_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    PERFORM net.http_post(
      url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/run-live-price-sync',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"cycles": 1}'::jsonb
    );
    IF i < 12 THEN
      PERFORM pg_sleep(5);
    END IF;
  END LOOP;
END;
$$;
