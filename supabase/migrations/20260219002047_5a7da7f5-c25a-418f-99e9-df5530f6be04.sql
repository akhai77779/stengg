
-- Create a function that calls sync-live-price in a loop every 5 seconds (12 times per minute)
CREATE OR REPLACE FUNCTION public.run_live_price_sync_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    PERFORM net.http_post(
      url := 'https://avqutkamqeblqirtckir.supabase.co/functions/v1/sync-live-price',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cXV0a2FtcWVibHFpcnRja2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzk1MjQsImV4cCI6MjA4MzgxNTUyNH0.ewqEUo7vB_sjWdlY9o4Lw_A3uXWOECDfBj99Tq8pUi0"}'::jsonb,
      body := '{}'::jsonb
    );
    IF i < 12 THEN
      PERFORM pg_sleep(5);
    END IF;
  END LOOP;
END;
$$;
