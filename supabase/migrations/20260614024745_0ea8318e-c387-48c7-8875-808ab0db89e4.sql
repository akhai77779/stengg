
CREATE OR REPLACE FUNCTION public.notify_admin_on_transaction_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_email TEXT; _user_name TEXT; _user_code INTEGER;
  _title TEXT; _message TEXT; _ntype TEXT; _tag TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF NEW.type NOT IN ('withdraw', 'deposit') THEN
    RETURN NEW;
  END IF;

  SELECT email, full_name, user_code INTO _user_email, _user_name, _user_code
  FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.type = 'withdraw' THEN
    _title := '🔔 Yêu cầu rút tiền mới';
    _ntype := 'warning';
    _tag := 'withdrawal';
    _message := 'User: ' || COALESCE(_user_name, _user_email, NEW.user_id::text)
      || COALESCE(' (#' || _user_code || ')', '')
      || E'\nSố tiền: ' || NEW.amount || ' USD'
      || E'\nMạng/NH: ' || COALESCE(NEW.network, '-')
      || E'\nTài khoản: ' || COALESCE(NEW.wallet_address, '-');
  ELSE
    _title := '💵 Yêu cầu nạp tiền mới';
    _ntype := 'info';
    _tag := 'deposit';
    _message := 'User: ' || COALESCE(_user_name, _user_email, NEW.user_id::text)
      || COALESCE(' (#' || _user_code || ')', '')
      || E'\nSố tiền: ' || NEW.amount || ' USD'
      || E'\nMạng/NH: ' || COALESCE(NEW.network, '-');
  END IF;

  BEGIN
    PERFORM public.enqueue_telegram(
      jsonb_build_object(
        'type', 'notification',
        'title', _title,
        'message', _message,
        'notification_type', _ntype,
        'user_email', COALESCE(_user_email, 'N/A')
      ),
      _tag
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_telegram failed (%): %', _tag, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_admin_on_withdrawal ON public.transactions;
DROP TRIGGER IF EXISTS trigger_notify_admin_on_transaction ON public.transactions;
CREATE TRIGGER trigger_notify_admin_on_transaction
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_transaction_request();
