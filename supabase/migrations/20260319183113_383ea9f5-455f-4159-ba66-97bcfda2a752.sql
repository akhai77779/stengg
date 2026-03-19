
-- 1. Drop duplicate trigger
DROP TRIGGER IF EXISTS trigger_notify_transaction_status ON public.transactions;

-- 2. Fix the function to check 'approved' instead of 'completed'
CREATE OR REPLACE FUNCTION public.notify_transaction_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'approved' THEN
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
$function$;
