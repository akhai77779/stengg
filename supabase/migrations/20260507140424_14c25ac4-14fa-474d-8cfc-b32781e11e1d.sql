
CREATE OR REPLACE FUNCTION public.notify_admin_on_withdrawal_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_email TEXT;
  _user_name TEXT;
  _user_code INTEGER;
  _title TEXT;
  _message TEXT;
BEGIN
  IF NEW.type <> 'withdraw' OR NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT email, full_name, user_code INTO _user_email, _user_name, _user_code
  FROM public.profiles WHERE id = NEW.user_id;

  _title := '🔔 Yêu cầu rút tiền mới';
  _message := 'User: ' || COALESCE(_user_name, _user_email, NEW.user_id::text)
    || COALESCE(' (#' || _user_code || ')', '')
    || E'\nSố tiền: ' || NEW.amount || ' USD'
    || E'\nMạng/NH: ' || COALESCE(NEW.network, '-')
    || E'\nTài khoản: ' || COALESCE(NEW.wallet_address, '-');

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
      'notification_type', 'warning',
      'user_email', COALESCE(_user_email, 'N/A')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_admin_on_withdrawal ON public.transactions;
CREATE TRIGGER trigger_notify_admin_on_withdrawal
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_withdrawal_request();
