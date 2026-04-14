
-- Drop both overloaded versions first
DROP FUNCTION IF EXISTS public.process_option_trade(uuid, uuid, numeric, text, integer, numeric, numeric);
DROP FUNCTION IF EXISTS public.process_option_trade(uuid, uuid, numeric, text, integer, numeric, numeric, numeric);

-- Recreate with _entry_price parameter
CREATE OR REPLACE FUNCTION public.process_option_trade(
  _user_id uuid, 
  _product_id uuid, 
  _amount numeric, 
  _direction text, 
  _duration_seconds integer, 
  _profit_rate numeric, 
  _fee_rate numeric, 
  _loss_rate numeric DEFAULT 0.15,
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
BEGIN
  -- Rate limit: max 5 option trades per minute
  IF NOT check_rate_limit(_user_id, 'option_trade', 5, 60) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quá nhiều lệnh. Vui lòng chờ.');
  END IF;

  -- Validate direction
  IF _direction NOT IN ('buy', 'sell') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loại giao dịch không hợp lệ');
  END IF;

  -- Validate amount
  IF _amount IS NULL OR _amount < 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số tiền tối thiểu là $100');
  END IF;

  -- Validate duration
  IF _duration_seconds NOT IN (240, 360, 600) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Thời gian không hợp lệ');
  END IF;

  -- Get user balance and lock
  SELECT balance INTO _current_balance
  FROM profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng');
  END IF;

  -- Check balance
  IF COALESCE(_current_balance, 0) < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số dư không đủ');
  END IF;

  -- Get product name (always needed for audit)
  SELECT name INTO _product_name
  FROM products
  WHERE id = _product_id AND status = 'available';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sản phẩm không khả dụng');
  END IF;

  -- Use client-provided price if available, otherwise fall back to DB price
  IF _entry_price IS NOT NULL AND _entry_price > 0 THEN
    _price := _entry_price;
  ELSE
    SELECT price INTO _price FROM products WHERE id = _product_id;
    IF _price IS NULL OR _price <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Giá sản phẩm không hợp lệ');
    END IF;
  END IF;

  -- Calculate times
  _started_at := now();
  _expires_at := now() + (_duration_seconds || ' seconds')::interval;

  -- Deduct balance
  _new_balance := COALESCE(_current_balance, 0) - _amount;
  UPDATE profiles
  SET balance = _new_balance, updated_at = now()
  WHERE id = _user_id;

  -- Create option trade with loss_rate
  INSERT INTO option_trades (
    user_id, product_id, direction, amount, entry_price,
    duration_seconds, profit_rate, fee_rate, loss_rate, status,
    started_at, expires_at
  ) VALUES (
    _user_id, _product_id, _direction, _amount, _price,
    _duration_seconds, _profit_rate, _fee_rate, _loss_rate, 'active',
    _started_at, _expires_at
  )
  RETURNING id INTO _trade_id;

  -- Log to audit
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, 'option_trade_created', 'option_trade', _trade_id, jsonb_build_object(
    'product_id', _product_id,
    'product_name', _product_name,
    'direction', _direction,
    'amount', _amount,
    'entry_price', _price,
    'price_source', CASE WHEN _entry_price IS NOT NULL AND _entry_price > 0 THEN 'realtime' ELSE 'database' END,
    'duration_seconds', _duration_seconds,
    'profit_rate', _profit_rate,
    'loss_rate', _loss_rate,
    'balance_before', _current_balance,
    'balance_after', _new_balance
  ));

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', _trade_id,
    'entry_price', _price,
    'expires_at', _expires_at,
    'new_balance', _new_balance
  );
END;
$function$;
