
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND balance IS NOT DISTINCT FROM (SELECT p.balance FROM public.profiles p WHERE p.id = auth.uid())
  AND total_income IS NOT DISTINCT FROM (SELECT p.total_income FROM public.profiles p WHERE p.id = auth.uid())
  AND is_frozen IS NOT DISTINCT FROM (SELECT p.is_frozen FROM public.profiles p WHERE p.id = auth.uid())
  AND is_trade_frozen IS NOT DISTINCT FROM (SELECT p.is_trade_frozen FROM public.profiles p WHERE p.id = auth.uid())
  AND withdrawal_password_hash IS NOT DISTINCT FROM (SELECT p.withdrawal_password_hash FROM public.profiles p WHERE p.id = auth.uid())
  AND user_code IS NOT DISTINCT FROM (SELECT p.user_code FROM public.profiles p WHERE p.id = auth.uid())
);
