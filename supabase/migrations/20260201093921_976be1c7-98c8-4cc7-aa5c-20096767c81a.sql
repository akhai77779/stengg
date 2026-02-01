-- Create user_notifications table for storing notifications
CREATE TABLE public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, success, warning, error, admin_message
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  -- For auto-cleanup after 30 days
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days')
);

-- Enable RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.user_notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
ON public.user_notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.user_notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can insert notifications for any user
CREATE POLICY "Admins can insert notifications"
ON public.user_notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
ON public.user_notifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX idx_user_notifications_created_at ON public.user_notifications(created_at DESC);
CREATE INDEX idx_user_notifications_expires_at ON public.user_notifications(expires_at);
CREATE INDEX idx_user_notifications_is_read ON public.user_notifications(user_id, is_read);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- Function to clean up expired notifications (can be called via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_notifications WHERE expires_at < now();
END;
$$;

-- Trigger function to create notification when transaction status changes
CREATE OR REPLACE FUNCTION public.notify_transaction_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
BEGIN
  -- Only notify on status change (not initial insert)
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'completed' THEN
      v_type := 'success';
      IF NEW.type = 'deposit' THEN
        v_title := '💰 Nạp tiền thành công';
        v_message := 'Yêu cầu nạp ' || NEW.amount || ' USDT đã được phê duyệt';
      ELSE
        v_title := '💸 Rút tiền thành công';
        v_message := 'Yêu cầu rút ' || NEW.amount || ' USDT đã được xử lý';
      END IF;
    ELSIF NEW.status = 'rejected' THEN
      v_type := 'error';
      IF NEW.type = 'deposit' THEN
        v_title := '❌ Nạp tiền bị từ chối';
        v_message := 'Yêu cầu nạp ' || NEW.amount || ' USDT đã bị từ chối' || COALESCE('. Lý do: ' || NEW.notes, '');
      ELSE
        v_title := '❌ Rút tiền bị từ chối';
        v_message := 'Yêu cầu rút ' || NEW.amount || ' USDT đã bị từ chối' || COALESCE('. Lý do: ' || NEW.notes, '');
      END IF;
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.user_notifications (user_id, title, message, type, metadata)
    VALUES (NEW.user_id, v_title, v_message, v_type, jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'type', NEW.type));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_transaction_status
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_transaction_status_change();

-- Trigger for option trade settlement
CREATE OR REPLACE FUNCTION public.notify_option_trade_settled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_product_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'settled' THEN
    SELECT name INTO v_product_name FROM public.products WHERE id = NEW.product_id;
    
    IF NEW.profit_loss IS NOT NULL AND NEW.profit_loss > 0 THEN
      v_type := 'success';
      v_title := '🎉 Giao dịch thắng';
      v_message := 'Lệnh ' || UPPER(NEW.direction) || ' ' || COALESCE(v_product_name, 'N/A') || ' thắng +' || ROUND(NEW.profit_loss::numeric, 2) || ' USDT';
    ELSE
      v_type := 'error';
      v_title := '📉 Giao dịch thua';
      v_message := 'Lệnh ' || UPPER(NEW.direction) || ' ' || COALESCE(v_product_name, 'N/A') || ' thua ' || ROUND(COALESCE(NEW.profit_loss, 0)::numeric, 2) || ' USDT';
    END IF;

    INSERT INTO public.user_notifications (user_id, title, message, type, metadata)
    VALUES (NEW.user_id, v_title, v_message, v_type, jsonb_build_object('trade_id', NEW.id, 'product', v_product_name, 'profit_loss', NEW.profit_loss));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_option_trade_settled
AFTER UPDATE ON public.option_trades
FOR EACH ROW
EXECUTE FUNCTION public.notify_option_trade_settled();

-- Trigger for identity verification status change
CREATE OR REPLACE FUNCTION public.notify_identity_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'approved' THEN
      v_type := 'success';
      v_title := '✅ Xác minh danh tính thành công';
      v_message := 'Tài liệu của bạn đã được xác minh thành công. Bạn có thể sử dụng đầy đủ các tính năng.';
    ELSIF NEW.status = 'rejected' THEN
      v_type := 'error';
      v_title := '❌ Xác minh danh tính bị từ chối';
      v_message := 'Tài liệu của bạn đã bị từ chối' || COALESCE('. Lý do: ' || NEW.rejection_reason, '. Vui lòng thử lại.');
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.user_notifications (user_id, title, message, type, metadata)
    VALUES (NEW.user_id, v_title, v_message, v_type, jsonb_build_object('verification_id', NEW.id));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_identity_verification
AFTER UPDATE ON public.identity_verifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_identity_verification_status();