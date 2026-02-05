-- Create table for admin quick reply templates
CREATE TABLE public.quick_reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag VARCHAR(50) NOT NULL,
  text TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quick_reply_templates ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage templates
CREATE POLICY "Admins can manage quick reply templates"
ON public.quick_reply_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow all authenticated users to read active templates
CREATE POLICY "Authenticated users can read active templates"
ON public.quick_reply_templates
FOR SELECT
TO authenticated
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_quick_reply_templates_updated_at
BEFORE UPDATE ON public.quick_reply_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.quick_reply_templates (tag, text, display_order) VALUES
  ('greeting', 'Xin chào! Tôi có thể giúp gì cho bạn?', 1),
  ('wait', 'Cảm ơn bạn đã liên hệ. Vui lòng chờ trong giây lát.', 2),
  ('noted', 'Vấn đề của bạn đã được ghi nhận. Chúng tôi sẽ phản hồi sớm nhất có thể.', 3),
  ('info', 'Bạn có thể cung cấp thêm thông tin chi tiết được không?', 4),
  ('thanks', 'Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!', 5),
  ('confirm', 'Quý khách vui lòng xác nhận lại giúp chúng tôi thêm 1 lần nữa.', 6),
  ('promo', 'Hiện tại chúng tôi đang có chương trình khuyến mãi đặc biệt dành cho quý khách!', 7),
  ('support', 'Đội ngũ hỗ trợ của chúng tôi sẽ liên hệ lại với bạn trong thời gian sớm nhất.', 8);