
-- engine_state: one row per product
CREATE TABLE public.engine_state (
  product_id uuid PRIMARY KEY,
  last_price numeric NOT NULL,
  last_recorded_at timestamptz NOT NULL DEFAULT now(),
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_state TO authenticated;
GRANT ALL ON public.engine_state TO service_role;

ALTER TABLE public.engine_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage engine_state"
ON public.engine_state
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- shock_events
CREATE TABLE public.shock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  shock_type text NOT NULL CHECK (shock_type IN ('pump','dump')),
  magnitude numeric NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  applied boolean NOT NULL DEFAULT false,
  applied_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shock_events_pending ON public.shock_events (scheduled_at)
WHERE applied = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shock_events TO authenticated;
GRANT ALL ON public.shock_events TO service_role;

ALTER TABLE public.shock_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shock_events"
ON public.shock_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
