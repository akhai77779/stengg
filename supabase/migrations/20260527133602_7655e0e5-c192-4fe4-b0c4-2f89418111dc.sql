
-- 1. Update process_trade: add frozen check after locking profile
CREATE OR REPLACE FUNCTION public.process_trade(_user_id uuid, _product_id uuid, _amount numeric, _trade_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _price NUMERIC;
  _total NUMERIC;
  _current_balance NUMERIC;
  _new_balance NUMERIC;
  _product_name TEXT;
  _transaction_id UUID;
  _is_frozen BOOLEAN;
  _is_trade_frozen BOOLEAN;
  _frozen_reason TEXT;
BEGIN
  IF NOT check_rate_limit(_user_id, 'trade', 10, 60) THEN
    INSERT INTO audit_logs (user_id, action, entity_type, details)
    VALUES (_user_id, 'rate_limit_exceeded', 'trade', jsonb_build_object(
      'trade_type', _trade_type, 'product_id', _product_id, 'amount', _amount
    ));
    RETURN jsonb_build_object('success', false, 'error', 'Too many trade requests. Please wait a moment.');
  END IF;

  IF _trade_type NOT IN ('buy', 'sell') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid trade type');
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  SELECT balance, COALESCE(is_frozen, false), COALESCE(is_trade_frozen, false), frozen_reason
    INTO _current_balance, _is_frozen, _is_trade_frozen, _frozen_reason
  FROM profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF _is_frozen OR _is_trade_frozen THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(NULLIF(_frozen_reason, ''), 'Tài khoản của bạn đang bị đóng băng giao dịch')
    );
  END IF;

  SELECT price, name INTO _price, _product_name
  FROM products
  WHERE id = _product_id AND status = 'available';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found or unavailable');
  END IF;

  IF _price IS NULL OR _price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid product price');
  END IF;

  _total := _amount * _price;

  IF _trade_type = 'buy' AND _total > COALESCE(_current_balance, 0) THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (_user_id, 'trade_failed', 'product', _product_id, jsonb_build_object(
      'reason', 'insufficient_balance', 'required', _total, 'available', _current_balance
    ));
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF _trade_type = 'buy' THEN
    _new_balance := COALESCE(_current_balance, 0) - _total;
  ELSE
    _new_balance := COALESCE(_current_balance, 0) + _total;
  END IF;

  UPDATE profiles SET balance = _new_balance, updated_at = now() WHERE id = _user_id;

  INSERT INTO transactions (user_id, type, amount, status, notes)
  VALUES (_user_id, _trade_type, _total, 'completed',
    format('%s %s %s @ %s', _trade_type, _amount, COALESCE(_product_name, 'product'), _price))
  RETURNING id INTO _transaction_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, 'trade_completed', 'transaction', _transaction_id, jsonb_build_object(
    'trade_type', _trade_type, 'product_id', _product_id, 'amount', _amount,
    'price', _price, 'total', _total, 'new_balance', _new_balance
  ));

  RETURN jsonb_build_object(
    'success', true, 'transaction_id', _transaction_id,
    'total', _total, 'new_balance', _new_balance
  );
END;
$function$;

-- 2. Update process_option_trade: add frozen check
CREATE OR REPLACE FUNCTION public.process_option_trade(_user_id uuid, _product_id uuid, _amount numeric, _direction text, _duration_seconds integer, _profit_rate numeric, _fee_rate numeric, _loss_rate numeric DEFAULT 0.15, _entry_price numeric DEFAULT NULL::numeric)
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
BEGIN
  IF NOT check_rate_limit(_user_id, 'option_trade', 5, 60) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quá nhiều lệnh. Vui lòng chờ.');
  END IF;

  IF _direction NOT IN ('buy', 'sell') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loại giao dịch không hợp lệ');
  END IF;

  IF _amount IS NULL OR _amount < 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số tiền tối thiểu là $100');
  END IF;

  IF _duration_seconds NOT IN (240, 360, 600) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Thời gian không hợp lệ');
  END IF;

  SELECT balance, COALESCE(is_frozen, false), COALESCE(is_trade_frozen, false), frozen_reason
    INTO _current_balance, _is_frozen, _is_trade_frozen, _frozen_reason
  FROM profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng');
  END IF;

  IF _is_frozen OR _is_trade_frozen THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(NULLIF(_frozen_reason, ''), 'Tài khoản của bạn đang bị đóng băng giao dịch')
    );
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
    _duration_seconds, _profit_rate, _fee_rate, _loss_rate,
    'active', _started_at, _expires_at
  ) RETURNING id INTO _trade_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, 'option_trade_placed', 'option_trade', _trade_id, jsonb_build_object(
    'direction', _direction, 'amount', _amount, 'entry_price', _entry_price,
    'duration_seconds', _duration_seconds, 'new_balance', _new_balance
  ));

  RETURN jsonb_build_object(
    'success', true, 'trade_id', _trade_id, 'new_balance', _new_balance,
    'started_at', _started_at, 'expires_at', _expires_at
  );
END;
$function$;

-- 3. Defense-in-depth: trigger to block direct inserts into option_trades when frozen
CREATE OR REPLACE FUNCTION public.block_frozen_user_option_trade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_frozen BOOLEAN;
  _is_trade_frozen BOOLEAN;
  _frozen_reason TEXT;
BEGIN
  SELECT COALESCE(is_frozen, false), COALESCE(is_trade_frozen, false), frozen_reason
    INTO _is_frozen, _is_trade_frozen, _frozen_reason
  FROM profiles WHERE id = NEW.user_id;

  IF _is_frozen OR _is_trade_frozen THEN
    RAISE EXCEPTION '%', COALESCE(NULLIF(_frozen_reason, ''), 'Tài khoản của bạn đang bị đóng băng giao dịch')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_frozen_user_option_trade ON public.option_trades;
CREATE TRIGGER trg_block_frozen_user_option_trade
BEFORE INSERT ON public.option_trades
FOR EACH ROW EXECUTE FUNCTION public.block_frozen_user_option_trade();
