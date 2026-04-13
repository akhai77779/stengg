
CREATE OR REPLACE FUNCTION public.notify_option_trade_settled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_product_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Trigger on status change to 'won' or 'lost'
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status IN ('won', 'lost') THEN
    SELECT name INTO v_product_name FROM public.products WHERE id = NEW.product_id;
    SELECT email INTO v_user_email FROM public.profiles WHERE id = NEW.user_id;
    
    IF NEW.status = 'won' THEN
      v_type := 'success';
      v_title := '🎉 Giao dịch thắng';
      v_message := '👤 ' || COALESCE(v_user_email, 'N/A') || E'\n' ||
                   'Lệnh ' || UPPER(NEW.direction) || ' ' || COALESCE(v_product_name, 'N/A') || 
                   ' thắng +' || ROUND(COALESCE(NEW.profit_loss, 0)::numeric, 2) || ' USDT' || E'\n' ||
                   '💰 Số tiền: ' || NEW.amount || ' USDT';
    ELSE
      v_type := 'error';
      v_title := '📉 Giao dịch thua';
      v_message := '👤 ' || COALESCE(v_user_email, 'N/A') || E'\n' ||
                   'Lệnh ' || UPPER(NEW.direction) || ' ' || COALESCE(v_product_name, 'N/A') || 
                   ' thua ' || ROUND(COALESCE(NEW.profit_loss, 0)::numeric, 2) || ' USDT' || E'\n' ||
                   '💰 Số tiền: ' || NEW.amount || ' USDT';
    END IF;

    INSERT INTO public.user_notifications (user_id, title, message, type, metadata)
    VALUES (NEW.user_id, v_title, v_message, v_type, jsonb_build_object('trade_id', NEW.id, 'product', v_product_name, 'profit_loss', NEW.profit_loss));
  END IF;

  -- Also notify when a NEW trade is created (status = 'active')
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    SELECT name INTO v_product_name FROM public.products WHERE id = NEW.product_id;
    SELECT email INTO v_user_email FROM public.profiles WHERE id = NEW.user_id;
    
    v_type := 'info';
    v_title := '📊 Lệnh giao dịch mới';
    v_message := '👤 ' || COALESCE(v_user_email, 'N/A') || E'\n' ||
                 'Lệnh ' || UPPER(NEW.direction) || ' ' || COALESCE(v_product_name, 'N/A') || E'\n' ||
                 '💰 Số tiền: ' || NEW.amount || ' USDT' || E'\n' ||
                 '⏱ Thời gian: ' || NEW.duration_seconds || 's' || E'\n' ||
                 '📈 Giá vào: ' || ROUND(NEW.entry_price::numeric, 4);

    INSERT INTO public.user_notifications (user_id, title, message, type, metadata)
    VALUES (NEW.user_id, v_title, v_message, v_type, jsonb_build_object('trade_id', NEW.id, 'product', v_product_name, 'event', 'option_trade_created'));
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate trigger to fire on both INSERT and UPDATE
DROP TRIGGER IF EXISTS on_option_trade_settled ON public.option_trades;
CREATE TRIGGER on_option_trade_settled
  AFTER INSERT OR UPDATE ON public.option_trades
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_option_trade_settled();
