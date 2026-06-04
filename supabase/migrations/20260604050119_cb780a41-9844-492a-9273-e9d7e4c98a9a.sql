
-- 1) Outbox table for Telegram notifications
CREATE TABLE IF NOT EXISTS public.telegram_outbox (
  id BIGSERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_telegram_outbox_status_created
  ON public.telegram_outbox (status, created_at)
  WHERE status IN ('pending','failed');

GRANT SELECT ON public.telegram_outbox TO authenticated;
GRANT ALL ON public.telegram_outbox TO service_role;
ALTER TABLE public.telegram_outbox ENABLE ROW LEVEL SECURITY;

-- Only admins can view the outbox; only service_role can write
DROP POLICY IF EXISTS "Admins can view telegram outbox" ON public.telegram_outbox;
CREATE POLICY "Admins can view telegram outbox"
  ON public.telegram_outbox FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Helper: enqueue
CREATE OR REPLACE FUNCTION public.enqueue_telegram(_payload JSONB, _source TEXT DEFAULT NULL)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id BIGINT;
BEGIN
  INSERT INTO public.telegram_outbox(payload, source)
  VALUES (_payload, _source)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- 3) Replace 3 trigger functions to use outbox instead of pg_net direct
CREATE OR REPLACE FUNCTION public.notify_telegram_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_email TEXT;
BEGIN
  SELECT email INTO _user_email FROM public.profiles WHERE id = NEW.user_id;

  BEGIN
    PERFORM public.enqueue_telegram(
      jsonb_build_object(
        'type', 'notification',
        'title', NEW.title,
        'message', NEW.message,
        'notification_type', NEW.type,
        'user_email', COALESCE(_user_email, 'N/A')
      ),
      'user_notifications'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_telegram failed (notification): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_withdrawal_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_email TEXT; _user_name TEXT; _user_code INTEGER;
  _title TEXT; _message TEXT;
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

  BEGIN
    PERFORM public.enqueue_telegram(
      jsonb_build_object(
        'type', 'notification',
        'title', _title,
        'message', _message,
        'notification_type', 'warning',
        'user_email', COALESCE(_user_email, 'N/A')
      ),
      'withdrawal'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_telegram failed (withdraw): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_option_trade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_email TEXT; _user_name TEXT; _user_code INTEGER;
  _product_name TEXT; _product_symbol TEXT;
  _direction TEXT; _title TEXT; _message TEXT;
BEGIN
  SELECT email, full_name, user_code INTO _user_email, _user_name, _user_code
  FROM public.profiles WHERE id = NEW.user_id;
  SELECT name, symbol INTO _product_name, _product_symbol
  FROM public.products WHERE id = NEW.product_id;

  _direction := CASE
    WHEN NEW.direction = 'buy' THEN '📈 MUA (Up)'
    WHEN NEW.direction = 'sell' THEN '📉 BÁN (Down)'
    ELSE NEW.direction END;

  _title := '⚡ Lệnh quyền chọn mới';
  _message := 'User: ' || COALESCE(_user_name, _user_email, NEW.user_id::text)
    || COALESCE(' (#' || _user_code || ')', '')
    || E'\nSản phẩm: ' || COALESCE(_product_name, '-') || COALESCE(' (' || _product_symbol || ')', '')
    || E'\nHướng: ' || _direction
    || E'\nSố tiền: ' || NEW.amount || ' USD'
    || E'\nGiá vào: ' || NEW.entry_price
    || E'\nThời gian: ' || NEW.duration_seconds || 's';

  BEGIN
    PERFORM public.enqueue_telegram(
      jsonb_build_object(
        'type', 'notification',
        'title', _title,
        'message', _message,
        'notification_type', 'info',
        'user_email', COALESCE(_user_email, 'N/A')
      ),
      'option_trade'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_telegram failed (option_trade): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4) New trigger: enqueue Telegram for new customer live chat messages
CREATE OR REPLACE FUNCTION public.notify_telegram_on_live_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title TEXT; _message TEXT;
BEGIN
  IF NEW.sender_type <> 'customer' THEN
    RETURN NEW;
  END IF;

  _title := '💬 Tin nhắn Live Chat mới';
  _message := '👤 ' || COALESCE(NEW.sender_name, 'Khách')
    || E'\n📝 ' || COALESCE(NULLIF(NEW.message,''), 'Tệp đính kèm')
    || E'\n🆔 Phòng: ' || COALESCE(NEW.room_id::text, '-');

  BEGIN
    PERFORM public.enqueue_telegram(
      jsonb_build_object(
        'type', 'notification',
        'title', _title,
        'message', _message,
        'notification_type', 'info',
        'user_email', COALESCE(NEW.sender_name, 'guest')
      ),
      'live_chat'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_telegram failed (live_chat): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_telegram_on_live_chat ON public.live_chat_messages;
CREATE TRIGGER trigger_telegram_on_live_chat
  AFTER INSERT ON public.live_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_telegram_on_live_chat();
