-- Drop and recreate the status check constraint to include 'approved'
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'completed'::text, 'rejected'::text]));