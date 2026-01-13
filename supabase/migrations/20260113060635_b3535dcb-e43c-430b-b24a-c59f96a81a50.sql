-- Function to validate wallet addresses server-side
CREATE OR REPLACE FUNCTION public.is_valid_wallet_address(_address TEXT, _network TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _address IS NULL OR _network IS NULL THEN
    RETURN false;
  END IF;
  
  CASE _network
    WHEN 'trc20' THEN
      -- TRC20: starts with T, 34 chars, base58
      RETURN _address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$';
    WHEN 'bep20', 'erc20' THEN
      -- ERC20/BEP20: 0x + 40 hex chars
      RETURN _address ~ '^0x[0-9a-fA-F]{40}$';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Function to process trades atomically with server-side validation
CREATE OR REPLACE FUNCTION public.process_trade(
  _user_id UUID,
  _product_id UUID,
  _amount NUMERIC,
  _trade_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _price NUMERIC;
  _total NUMERIC;
  _current_balance NUMERIC;
  _product_name TEXT;
BEGIN
  -- Validate trade type
  IF _trade_type NOT IN ('buy', 'sell') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid trade type');
  END IF;
  
  -- Validate amount
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Verify user exists and lock their profile row
  SELECT balance INTO _current_balance
  FROM profiles 
  WHERE id = _user_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get current product price
  SELECT price, name INTO _price, _product_name 
  FROM products 
  WHERE id = _product_id AND status = 'available';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found or unavailable');
  END IF;
  
  IF _price IS NULL OR _price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid product price');
  END IF;
  
  -- Calculate total
  _total := _amount * _price;
  
  -- Validate balance for buy
  IF _trade_type = 'buy' AND _total > COALESCE(_current_balance, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Update balance atomically
  UPDATE profiles
  SET 
    balance = CASE
      WHEN _trade_type = 'buy' THEN COALESCE(balance, 0) - _total
      ELSE COALESCE(balance, 0) + _total
    END,
    updated_at = now()
  WHERE id = _user_id;
  
  -- Create transaction record
  INSERT INTO transactions (user_id, type, amount, status, notes)
  VALUES (
    _user_id, 
    _trade_type, 
    _total, 
    'approved',
    CASE _trade_type 
      WHEN 'buy' THEN 'Mua ' || _amount::TEXT || ' ' || _product_name || ' @ $' || _price::TEXT
      ELSE 'Bán ' || _amount::TEXT || ' ' || _product_name || ' @ $' || _price::TEXT
    END
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'total', _total,
    'new_balance', CASE
      WHEN _trade_type = 'buy' THEN COALESCE(_current_balance, 0) - _total
      ELSE COALESCE(_current_balance, 0) + _total
    END
  );
END;
$$;

-- Function to create withdrawal requests with server-side validation
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  _user_id UUID,
  _amount NUMERIC,
  _network TEXT,
  _wallet_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_balance NUMERIC;
  _fee NUMERIC;
  _total_deduction NUMERIC;
BEGIN
  -- Validate amount
  IF _amount IS NULL OR _amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is $10');
  END IF;
  
  -- Validate network
  IF _network NOT IN ('bep20', 'trc20', 'erc20') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid network');
  END IF;
  
  -- Validate wallet address format server-side
  IF NOT is_valid_wallet_address(_wallet_address, _network) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid wallet address format');
  END IF;
  
  -- Calculate fee (1%)
  _fee := _amount * 0.01;
  _total_deduction := _amount + _fee;
  
  -- Lock user profile and check balance
  SELECT balance INTO _current_balance
  FROM profiles 
  WHERE id = _user_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF COALESCE(_current_balance, 0) < _total_deduction THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance (including 1% fee)');
  END IF;
  
  -- Create withdrawal request (pending status for admin approval)
  INSERT INTO transactions (user_id, type, amount, status, network, wallet_address, notes)
  VALUES (
    _user_id,
    'withdraw',
    _amount,
    'pending',
    _network,
    _wallet_address,
    'Fee: $' || _fee::TEXT
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'amount', _amount,
    'fee', _fee,
    'total_deduction', _total_deduction
  );
END;
$$;