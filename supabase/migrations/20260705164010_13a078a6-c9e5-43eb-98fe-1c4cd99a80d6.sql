
-- 1) Vault secret cho functions base URL (mặc định là URL Test/dev)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'functions_base_url') THEN
    PERFORM vault.create_secret(
      'https://nptiddcelyxfbyvslotv.supabase.co',
      'functions_base_url',
      'Base URL for calling this project''s edge functions'
    );
  END IF;
END $$;

-- 2) Helper đọc URL từ vault
CREATE OR REPLACE FUNCTION public.get_functions_base_url()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'functions_base_url'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_functions_base_url() FROM PUBLIC, anon, authenticated;

-- 3) Cập nhật loop function để dùng URL động
CREATE OR REPLACE FUNCTION public.run_live_price_sync_loop()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  i INTEGER;
  _key TEXT;
  _base TEXT;
BEGIN
  SELECT decrypted_secret INTO _key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF _key IS NULL THEN
    RAISE WARNING 'Service role key not found in vault';
    RETURN;
  END IF;

  _base := public.get_functions_base_url();
  IF _base IS NULL THEN
    RAISE WARNING 'functions_base_url not found in vault';
    RETURN;
  END IF;

  FOR i IN 1..12 LOOP
    PERFORM net.http_post(
      url := _base || '/functions/v1/run-live-price-sync',
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

-- 4) Reschedule cron sync-price-history-every-minute để URL đọc động lúc chạy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-price-history-every-minute') THEN
    PERFORM cron.unschedule('sync-price-history-every-minute');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-price-history-every-minute',
  '* * * * *',
  $cmd$
  SELECT net.http_post(
    url := public.get_functions_base_url() || '/functions/v1/sync-price-history',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $cmd$
);
