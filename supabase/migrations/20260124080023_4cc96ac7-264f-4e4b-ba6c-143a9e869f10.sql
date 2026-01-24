-- Create bank_accounts table for storing user bank accounts
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  branch TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own bank accounts
CREATE POLICY "Users can view own bank accounts"
ON public.bank_accounts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own bank accounts
CREATE POLICY "Users can create own bank accounts"
ON public.bank_accounts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own bank accounts
CREATE POLICY "Users can update own bank accounts"
ON public.bank_accounts
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own bank accounts
CREATE POLICY "Users can delete own bank accounts"
ON public.bank_accounts
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all bank accounts
CREATE POLICY "Admins can view all bank accounts"
ON public.bank_accounts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();