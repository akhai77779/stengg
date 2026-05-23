-- Bịt lỗ hổng: user có thể UPDATE đổi user_id sang người khác
DROP POLICY IF EXISTS "Users can update own bank accounts" ON public.bank_accounts;

CREATE POLICY "Users can update own bank accounts"
ON public.bank_accounts
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);