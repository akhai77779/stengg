-- Create deposit_settings table to store deposit configuration
CREATE TABLE public.deposit_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  method_type TEXT NOT NULL CHECK (method_type IN ('bank', 'crypto', 'qr')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(method_type)
);

-- Enable RLS
ALTER TABLE public.deposit_settings ENABLE ROW LEVEL SECURITY;

-- Public read policy - everyone can view active deposit settings
CREATE POLICY "Anyone can view active deposit settings" 
ON public.deposit_settings 
FOR SELECT 
USING (is_active = true);

-- Admin full access policy
CREATE POLICY "Admins can manage deposit settings" 
ON public.deposit_settings 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_deposit_settings_updated_at
BEFORE UPDATE ON public.deposit_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default deposit methods
INSERT INTO public.deposit_settings (method_type, is_active, display_order, config) VALUES
('bank', true, 1, '{"bank_name": "Vietcombank", "account_number": "1234567890", "account_holder": "CONG TY TNHH ST ENGINEERING", "branch": "Chi nhánh HCM"}'::jsonb),
('crypto', true, 2, '{"wallets": [{"network": "TRC20", "address": "", "currency": "USDT"}, {"network": "ERC20", "address": "", "currency": "USDT"}, {"network": "BEP20", "address": "", "currency": "USDT"}]}'::jsonb),
('qr', true, 3, '{"qr_image_url": "", "bank_name": "Vietcombank", "account_number": "1234567890", "account_holder": "CONG TY TNHH ST ENGINEERING"}'::jsonb);