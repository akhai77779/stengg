CREATE OR REPLACE FUNCTION public.notify_admin_on_option_trade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_email TEXT;
  _user_name TEXT;
  _user_code INTEGER;
  _product_name TEXT;
  _product_symbol TEXT;
  _direction TEXT;
  _title TEXT;
  _message TEXT;
BEGIN
  SELECT email, full_name, user_code INTO _user_email, _user_name, _user_code
  FROM public.profiles WHERE id = NEW.user_id;

  SELECT name, symbol INTO _product_name, _product_symbol
  FROM public.products WHERE id = NEW.product_id;

  _direction := CASE
    WHEN NEW.direction = 'buy' THEN '📈 MUA (Up)'
    WHEN NEW.direction = 'sell' THEN '📉 BÁN (Down)'
    ELSE NEW.direction
  END;

  _title := '⚡ Lệnh quyền chọn mới';
  _message := 'User: ' || COALESCE(_user_name, _user_email, NEW.user_id::text)
    || COALESCE(' (#' || _user_code || ')', '')
    || E'\nSản phẩm: ' || COALESCE(_product_name, '-') || COALESCE(' (' || _product_symbol || ')', '')
    || E'\nHướng: ' || _direction
    || E'\nSố tiền: ' || NEW.amount || ' USD'
    || E'\nGiá vào: ' || NEW.entry_price
    || E'\nThời gian: ' || NEW.duration_seconds || 's';

  PERFORM net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGlkZGNlbHl4ZmJ5dnNsb3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDI5NjQsImV4cCI6MjA4OTUxODk2NH0._A6_ykyYi7FqoAMO46ntG2q-oyRSWmtBKB7ANqcBlxc'
    ),
    body := jsonb_build_object(
      'type', 'notification',
      'title', _title,
      'message', _message,
      'notification_type', 'info',
      'user_email', COALESCE(_user_email, 'N/A')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_admin_on_option_trade ON public.option_trades;
CREATE TRIGGER trigger_notify_admin_on_option_trade
  AFTER INSERT ON public.option_trades
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_option_trade();