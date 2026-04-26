ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

DROP POLICY IF EXISTS "Service role can manage phone otps" ON public.phone_otps;
CREATE POLICY "Service role can manage phone otps"
ON public.phone_otps
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');