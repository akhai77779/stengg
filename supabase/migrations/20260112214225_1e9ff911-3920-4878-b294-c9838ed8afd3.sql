
-- Create transactions table for deposit/withdrawal history
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  wallet_address TEXT,
  network TEXT,
  tx_hash TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own transactions
CREATE POLICY "Users can create own transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can manage all transactions
CREATE POLICY "Admins can manage transactions" 
ON public.transactions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add balance column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_income NUMERIC DEFAULT 0;

-- Create trigger for updated_at
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
