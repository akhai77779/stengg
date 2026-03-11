
-- Drop the restrictive admin ALL policy and replace with permissive one
DROP POLICY IF EXISTS "Admins can manage price history" ON public.price_history;

-- Add a PERMISSIVE policy so admin can fully manage price_history (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage price history permissive"
ON public.price_history
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Also make the public SELECT policy permissive (drop restrictive, recreate as permissive)
DROP POLICY IF EXISTS "Anyone authenticated can view price history" ON public.price_history;

CREATE POLICY "Anyone can view price history"
ON public.price_history
FOR SELECT
TO authenticated
USING (true);

-- Drop the redundant restrictive deny policies (the permissive admin policy handles access correctly)
DROP POLICY IF EXISTS "Deny non-admin deletes from price history" ON public.price_history;
DROP POLICY IF EXISTS "Deny non-admin inserts to price history" ON public.price_history;
DROP POLICY IF EXISTS "Deny non-admin updates to price history" ON public.price_history;

-- Clean up stale price_history data (older than 25 hours) so fresh seed takes effect
DELETE FROM public.price_history 
WHERE recorded_at < now() - interval '25 hours';
