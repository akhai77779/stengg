CREATE OR REPLACE FUNCTION public.run_live_price_sync_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    PERFORM net.http_post(
      url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/run-live-price-sync',
      headers := '{"Content-Type":"application/json","x-cron-secret":"wRm6XpMe2XcaBYpu6mV2NRpX_EabPTTOGwY6zrxXz1So363dmVVD6eIj5kqcLTVt"}'::jsonb,
      body := '{"cycles": 1}'::jsonb
    );
    IF i < 12 THEN
      PERFORM pg_sleep(5);
    END IF;
  END LOOP;
END;
$function$;