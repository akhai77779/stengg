CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.engine_state (
  product_id uuid PRIMARY KEY,
  last_price numeric NOT NULL,
  last_recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_state TO authenticated;
GRANT ALL ON public.engine_state TO service_role;

ALTER TABLE public.engine_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage engine_state" ON public.engine_state;
CREATE POLICY "Admins manage engine_state"
ON public.engine_state
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages engine_state" ON public.engine_state;
CREATE POLICY "Service role manages engine_state"
ON public.engine_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  shock_type text NOT NULL CHECK (shock_type IN ('pump', 'dump')),
  magnitude numeric NOT NULL,
  scheduled_at timestamp with time zone NOT NULL DEFAULT now(),
  applied boolean NOT NULL DEFAULT false,
  applied_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shock_events TO authenticated;
GRANT ALL ON public.shock_events TO service_role;

ALTER TABLE public.shock_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage shock_events" ON public.shock_events;
CREATE POLICY "Admins manage shock_events"
ON public.shock_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages shock_events" ON public.shock_events;
CREATE POLICY "Service role manages shock_events"
ON public.shock_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shock_events_pending
ON public.shock_events (scheduled_at)
WHERE applied = false;

INSERT INTO public.engine_state (product_id, last_price, last_recorded_at, extra, updated_at)
SELECT
  p.id,
  COALESCE(NULLIF(p.price, 0), 100),
  now(),
  jsonb_build_object('seeded_from_products', true),
  now()
FROM public.products p
WHERE p.status = 'available'
ON CONFLICT (product_id) DO UPDATE
SET
  last_price = EXCLUDED.last_price,
  last_recorded_at = EXCLUDED.last_recorded_at,
  extra = public.engine_state.extra || jsonb_build_object('reseeded_from_products', true),
  updated_at = now()
WHERE public.engine_state.last_price IS NULL OR public.engine_state.last_price <= 0;

CREATE UNIQUE INDEX IF NOT EXISTS price_history_product_id_recorded_at_key
ON public.price_history (product_id, recorded_at);

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'market-engine-tick-every-minute';

SELECT cron.schedule(
  'market-engine-tick-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/market-engine-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);

DO $$
DECLARE
  sync_job_id integer;
BEGIN
  SELECT jobid INTO sync_job_id
  FROM cron.job
  WHERE jobname = 'run-live-price-sync'
  LIMIT 1;

  IF sync_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(sync_job_id);
    PERFORM cron.schedule(
      'run-live-price-sync',
      '* * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/run-live-price-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'email_queue_service_role_key'
          )
        ),
        body := jsonb_build_object('time', now())
      ) AS request_id;
      $job$
    );
  END IF;
END $$;