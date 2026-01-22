-- Create per-product price simulation controls
CREATE TABLE IF NOT EXISTS public.product_price_controls (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'neutral',
  strength NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Basic validation (constant list is immutable-safe)
ALTER TABLE public.product_price_controls
  ADD CONSTRAINT product_price_controls_direction_check
  CHECK (direction IN ('up','down','neutral'));

ALTER TABLE public.product_price_controls
  ADD CONSTRAINT product_price_controls_strength_check
  CHECK (strength >= 0 AND strength <= 5);

-- Enable Row Level Security
ALTER TABLE public.product_price_controls ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Anyone authenticated can view product price controls" ON public.product_price_controls;
CREATE POLICY "Anyone authenticated can view product price controls"
  ON public.product_price_controls
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage product price controls" ON public.product_price_controls;
CREATE POLICY "Admins can manage product price controls"
  ON public.product_price_controls
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated-at trigger for this table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_price_controls_updated_at'
  ) THEN
    CREATE TRIGGER trg_product_price_controls_updated_at
    BEFORE UPDATE ON public.product_price_controls
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Helpful index for queries by direction (optional but cheap)
CREATE INDEX IF NOT EXISTS idx_product_price_controls_direction ON public.product_price_controls(direction);