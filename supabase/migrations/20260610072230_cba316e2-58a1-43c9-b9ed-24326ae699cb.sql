CREATE OR REPLACE FUNCTION public.get_ohlc_aggregated(
  p_product_id uuid,
  p_bucket_seconds integer,
  p_since timestamptz
)
RETURNS TABLE (
  bucket_start timestamptz,
  open_price numeric,
  high_price numeric,
  low_price numeric,
  close_price numeric,
  volume numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bucketed AS (
    SELECT
      to_timestamp(floor(extract(epoch FROM recorded_at) / p_bucket_seconds) * p_bucket_seconds) AS bucket_start,
      recorded_at, open_price, high_price, low_price, close_price, volume
    FROM public.price_history
    WHERE product_id = p_product_id AND recorded_at >= p_since
  )
  SELECT
    bucket_start,
    (array_agg(open_price  ORDER BY recorded_at ASC ))[1],
    max(high_price),
    min(low_price),
    (array_agg(close_price ORDER BY recorded_at DESC))[1],
    coalesce(sum(volume), 0)
  FROM bucketed
  GROUP BY bucket_start
  ORDER BY bucket_start ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_ohlc_aggregated(uuid, integer, timestamptz) TO anon, authenticated, service_role;