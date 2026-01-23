-- Drop public SELECT policies on app_settings
DROP POLICY IF EXISTS "Anyone authenticated can view settings" ON public.app_settings;

-- Create admin-only SELECT policy for app_settings
CREATE POLICY "Admins can view settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop public SELECT policy on product_price_controls
DROP POLICY IF EXISTS "Anyone authenticated can view product price controls" ON public.product_price_controls;

-- Create admin-only SELECT policy for product_price_controls
CREATE POLICY "Admins can view product price controls"
ON public.product_price_controls
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));