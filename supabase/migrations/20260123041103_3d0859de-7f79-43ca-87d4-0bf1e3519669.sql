
-- Create identity_verifications table
CREATE TABLE public.identity_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('cccd', 'passport')),
  document_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  front_image_url TEXT NOT NULL,
  back_image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification
CREATE POLICY "Users can view own verification"
ON public.identity_verifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own verification
CREATE POLICY "Users can insert own verification"
ON public.identity_verifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending verification
CREATE POLICY "Users can update own pending verification"
ON public.identity_verifications
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all verifications
CREATE POLICY "Admins can view all verifications"
ON public.identity_verifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all verifications
CREATE POLICY "Admins can update all verifications"
ON public.identity_verifications
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_identity_verifications_updated_at
BEFORE UPDATE ON public.identity_verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for identity documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('identity-documents', 'identity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for identity documents
CREATE POLICY "Users can upload own identity documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'identity-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own identity documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'identity-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all identity documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'identity-documents' AND has_role(auth.uid(), 'admin'::app_role));
