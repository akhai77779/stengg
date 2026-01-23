-- Add loss_rate column to option_trades table
ALTER TABLE public.option_trades 
ADD COLUMN IF NOT EXISTS loss_rate numeric DEFAULT 0.15;

-- Update settle_option_trade function to use loss_rate
CREATE OR REPLACE FUNCTION public.settle_option_trade(_trade_id uuid, _exit_price numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _trade RECORD;
  _won BOOLEAN;
  _profit_loss NUMERIC;
  _new_balance NUMERIC;
  _payout NUMERIC;
  _loss_amount NUMERIC;
BEGIN
  -- Lock and get trade
  SELECT * INTO _trade
  FROM option_trades
  WHERE id = _trade_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Giao dịch không tìm thấy hoặc đã kết thúc');
  END IF;

  -- Determine win/lose
  IF _trade.admin_result IS NOT NULL THEN
    -- Admin has overridden the result
    _won := _trade.admin_result = 'win';
  ELSE
    -- Natural result based on price movement
    IF _trade.direction = 'buy' THEN
      _won := _exit_price > _trade.entry_price;
    ELSE
      _won := _exit_price < _trade.entry_price;
    END IF;
  END IF;

  -- Calculate profit/loss
  IF _won THEN
    -- Win: return original + profit (minus fee)
    _payout := _trade.amount + (_trade.amount * _trade.profit_rate) - (_trade.amount * _trade.fee_rate);
    _profit_loss := _payout - _trade.amount;
  ELSE
    -- Lose: only lose the loss_rate percentage, return remaining
    _loss_amount := _trade.amount * COALESCE(_trade.loss_rate, 0.15);
    _payout := _trade.amount - _loss_amount;
    _profit_loss := -_loss_amount;
  END IF;

  -- Update trade
  UPDATE option_trades
  SET 
    status = CASE WHEN _won THEN 'won' ELSE 'lost' END,
    exit_price = _exit_price,
    profit_loss = _profit_loss,
    settled_at = now(),
    updated_at = now()
  WHERE id = _trade_id;

  -- Credit payout (even on loss, user gets back the non-lost portion)
  IF _payout > 0 THEN
    UPDATE profiles
    SET 
      balance = balance + _payout,
      total_income = COALESCE(total_income, 0) + _profit_loss,
      updated_at = now()
    WHERE id = _trade.user_id
    RETURNING balance INTO _new_balance;
  ELSE
    SELECT balance INTO _new_balance
    FROM profiles WHERE id = _trade.user_id;
  END IF;

  -- Log to audit
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_trade.user_id, 'option_trade_settled', 'option_trade', _trade_id, jsonb_build_object(
    'result', CASE WHEN _won THEN 'won' ELSE 'lost' END,
    'admin_override', _trade.admin_result IS NOT NULL,
    'entry_price', _trade.entry_price,
    'exit_price', _exit_price,
    'amount', _trade.amount,
    'loss_rate', _trade.loss_rate,
    'profit_loss', _profit_loss,
    'payout', _payout,
    'new_balance', _new_balance
  ));

  RETURN jsonb_build_object(
    'success', true,
    'won', _won,
    'profit_loss', _profit_loss,
    'payout', _payout,
    'new_balance', _new_balance
  );
END;
$function$;

-- Update process_option_trade to accept loss_rate parameter
CREATE OR REPLACE FUNCTION public.process_option_trade(_user_id uuid, _product_id uuid, _amount numeric, _direction text, _duration_seconds integer, _profit_rate numeric, _fee_rate numeric, _loss_rate numeric DEFAULT 0.15)
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

  -- Get product price
  SELECT price, name INTO _price, _product_name
  FROM products
  WHERE id = _product_id AND status = 'available';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sản phẩm không khả dụng');
  END IF;

  IF _price IS NULL OR _price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Giá sản phẩm không hợp lệ');
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