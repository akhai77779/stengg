
-- Pure-DB tick: build/update 1-minute candles from products.price
CREATE OR REPLACE FUNCTION public.sync_price_history_tick(_min_vol INT DEFAULT 1000, _max_extra INT DEFAULT 4000)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket timestamptz := date_trunc('minute', now());
  _count INT;
BEGIN
  WITH src AS (
    SELECT id AS product_id, price::numeric AS price,
           (_min_vol + floor(random() * _max_extra))::numeric AS tick_vol
    FROM public.products
    WHERE status = 'available' AND price IS NOT NULL AND price > 0
  )
  INSERT INTO public.price_history (product_id, recorded_at, open_price, high_price, low_price, close_price, volume)
  SELECT product_id, _bucket, price, price, price, price, tick_vol FROM src
  ON CONFLICT (product_id, recorded_at) DO UPDATE
    SET high_price = GREATEST(public.price_history.high_price, EXCLUDED.close_price),
        low_price  = LEAST(public.price_history.low_price,  EXCLUDED.close_price),
        close_price = EXCLUDED.close_price,
        volume = public.price_history.volume + EXCLUDED.volume;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- Replacement for run_live_price_sync_loop: 12 ticks x 5s, all in-DB
CREATE OR REPLACE FUNCTION public.run_live_price_sync_db_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE i INT;
BEGIN
  FOR i IN 1..12 LOOP
    PERFORM public.sync_price_history_tick(200, 800);
    IF i < 12 THEN PERFORM pg_sleep(5); END IF;
  END LOOP;
END;
$$;

-- Reschedule cron: replace HTTP hops with direct DB calls
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('sync-price-history-every-minute','sync-live-price-loop');

SELECT cron.schedule(
  'sync-price-history-every-minute',
  '* * * * *',
  $$ SELECT public.sync_price_history_tick(1000, 4000); $$
);

SELECT cron.schedule(
  'sync-live-price-loop',
  '* * * * *',
  $$ SELECT public.run_live_price_sync_db_loop(); $$
);
