ALTER TABLE public.products ALTER COLUMN price TYPE numeric(20,6);

CREATE OR REPLACE FUNCTION public.sync_price_history_tick(
  _min_vol integer DEFAULT 1000,
  _max_extra integer DEFAULT 4000,
  _vol_pct numeric DEFAULT 0.015
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _bucket timestamptz := date_trunc('minute', now());
  _count INT;
BEGIN
  WITH src AS (
    SELECT
      p.id AS product_id,
      GREATEST(
        (p.price::numeric) * (1 + (random() - 0.5) * 2 * _vol_pct),
        0.000001
      )::numeric(20,6) AS new_price,
      (_min_vol + floor(random() * _max_extra))::numeric AS tick_vol
    FROM public.products p
    WHERE p.status = 'available'
      AND p.price IS NOT NULL
      AND p.price > 0
  ),
  upd AS (
    UPDATE public.products p
       SET price = s.new_price,
           updated_at = now()
      FROM src s
     WHERE p.id = s.product_id
     RETURNING p.id
  ),
  ins AS (
    INSERT INTO public.price_history
      (product_id, recorded_at, open_price, high_price, low_price, close_price, volume)
    SELECT s.product_id, _bucket, s.new_price, s.new_price, s.new_price, s.new_price, s.tick_vol
      FROM src s
    ON CONFLICT (product_id, recorded_at) DO UPDATE
      SET high_price  = GREATEST(public.price_history.high_price, EXCLUDED.close_price),
          low_price   = LEAST(public.price_history.low_price,  EXCLUDED.close_price),
          close_price = EXCLUDED.close_price,
          volume      = public.price_history.volume + EXCLUDED.volume
    RETURNING 1
  )
  SELECT count(*) INTO _count FROM ins;
  RETURN _count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_live_price_sync_db_loop()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE i INT;
BEGIN
  FOR i IN 1..12 LOOP
    PERFORM public.sync_price_history_tick(200, 800, 0.015);
    IF i < 12 THEN PERFORM pg_sleep(5); END IF;
  END LOOP;
END;
$function$;