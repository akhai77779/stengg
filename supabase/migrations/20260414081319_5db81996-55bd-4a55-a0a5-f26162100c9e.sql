
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
      url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/sync-live-price',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGlkZGNlbHl4ZmJ5dnNsb3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDI5NjQsImV4cCI6MjA4OTUxODk2NH0._A6_ykyYi7FqoAMO46ntG2q-oyRSWmtBKB7ANqcBlxc"}'::jsonb,
      body := '{}'::jsonb
    );
    IF i < 12 THEN
      PERFORM pg_sleep(5);
    END IF;
  END LOOP;
END;
$function$;
