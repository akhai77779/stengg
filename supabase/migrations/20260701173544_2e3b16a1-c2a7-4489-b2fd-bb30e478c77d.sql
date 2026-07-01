
-- 1) option_trades_user_controlled_rates
--    Force server-side rates and remove client INSERT policy.

CREATE OR REPLACE FUNCTION public.process_option_trade(
  _user_id uuid,
  _product_id uuid,
  _amount numeric,
  _direction text,
  _duration_seconds integer,
  _profit_rate numeric DEFAULT NULL,
  _fee_rate numeric DEFAULT NULL,
  _loss_rate numeric DEFAULT NULL,
  _entry_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_balance NUMERIC;
  _price NUMERIC;
  _product_name TEXT;
  _new_balance NUMERIC;
  _trade_id UUID;
  _started_at TIMESTAMP WITH TIME ZONE;
  _expires_at TIMESTAMP WITH TIME ZONE;
  _is_frozen BOOLEAN;
  _is_trade_frozen BOOLEAN;
  _frozen_reason TEXT;
  _min_amount NUMERIC;
  _srv_profit NUMERIC;
  _srv_loss NUMERIC;
  _srv_fee NUMERIC := 0.002;
BEGIN
  -- Server-authoritative rates keyed by duration. Ignore client-supplied values.
  IF _duration_seconds = 240 THEN
    _srv_profit := 0.06;  _srv_loss := 0.15;  _min_amount := 200;
  ELSIF _duration_seconds = 360 THEN
    _srv_profit := 0.10;  _srv_loss := 0.12;  _min_amount := 10000;
  ELSIF _duration_seconds = 600 THEN
    _srv_profit := 0.15;  _srv_loss := 0.18;  _min_amount := 100000;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Thời gian không hợp lệ');
  END IF;

  IF NOT check_rate_limit(_user_id, 'option_trade', 5, 60) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quá nhiều lệnh. Vui lòng chờ.');
  END IF;

  IF _direction NOT IN ('buy', 'sell') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loại giao dịch không hợp lệ');
  END IF;

  IF _amount IS NULL OR _amount < _min_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số tiền không đạt tối thiểu');
  END IF;

  SELECT balance, COALESCE(is_frozen, false), COALESCE(is_trade_frozen, false), frozen_reason
    INTO _current_balance, _is_frozen, _is_trade_frozen, _frozen_reason
  FROM profiles WHERE id = _user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng');
  END IF;

  IF _is_frozen OR _is_trade_frozen THEN
    RETURN jsonb_build_object('success', false,
      'error', COALESCE(NULLIF(_frozen_reason, ''), 'Tài khoản của bạn đang bị đóng băng giao dịch'));
  END IF;

  IF _amount > COALESCE(_current_balance, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số dư không đủ');
  END IF;

  SELECT price, name INTO _price, _product_name
  FROM products WHERE id = _product_id AND status = 'available';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sản phẩm không khả dụng');
  END IF;

  IF _entry_price IS NULL OR _entry_price <= 0 THEN
    _entry_price := _price;
  END IF;

  IF _entry_price IS NULL OR _entry_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Giá không hợp lệ');
  END IF;

  _new_balance := COALESCE(_current_balance, 0) - _amount;
  UPDATE profiles SET balance = _new_balance, updated_at = now() WHERE id = _user_id;

  _started_at := now();
  _expires_at := _started_at + make_interval(secs => _duration_seconds);

  INSERT INTO option_trades (
    user_id, product_id, direction, amount, entry_price,
    duration_seconds, profit_rate, fee_rate, loss_rate,
    status, started_at, expires_at
  ) VALUES (
    _user_id, _product_id, _direction, _amount, _entry_price,
    _duration_seconds, _srv_profit, _srv_fee, _srv_loss,
    'active', _started_at, _expires_at
  ) RETURNING id INTO _trade_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, 'option_trade_placed', 'option_trade', _trade_id, jsonb_build_object(
    'direction', _direction, 'amount', _amount, 'entry_price', _entry_price,
    'duration_seconds', _duration_seconds, 'new_balance', _new_balance,
    'profit_rate', _srv_profit, 'loss_rate', _srv_loss, 'fee_rate', _srv_fee
  ));

  RETURN jsonb_build_object(
    'success', true, 'trade_id', _trade_id, 'new_balance', _new_balance,
    'started_at', _started_at, 'expires_at', _expires_at,
    'profit_rate', _srv_profit, 'loss_rate', _srv_loss, 'fee_rate', _srv_fee
  );
END;
$function$;

-- Remove client-side INSERT policy so users cannot bypass the RPC to set
-- arbitrary profit/loss rates. Inserts must go through process_option_trade
-- (SECURITY DEFINER, function owned by postgres — bypasses RLS).
DROP POLICY IF EXISTS "Users can create own option trades" ON public.option_trades;

-- 3) uploads_bucket_any_authenticated_overwrite
--    Drop UPDATE policies on uploads bucket — files are write-once.
DROP POLICY IF EXISTS "Authenticated users update own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous updates for live-chat" ON storage.objects;
