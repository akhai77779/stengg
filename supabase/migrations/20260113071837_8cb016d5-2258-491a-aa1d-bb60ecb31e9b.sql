-- Create rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow internal access (via SECURITY DEFINER functions)
-- No direct user access to rate_limits table

-- Create index for efficient queries
CREATE INDEX idx_rate_limits_user_action_time ON public.rate_limits (user_id, action_type, created_at DESC);

-- Auto-cleanup old rate limit entries (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits WHERE created_at < now() - INTERVAL '1 hour';
END;
$$;

-- Rate limiting check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id UUID,
  _action_type TEXT,
  _max_requests INTEGER,
  _window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  -- Cleanup old entries periodically (1% chance per call to avoid overhead)
  IF random() < 0.01 THEN
    PERFORM cleanup_old_rate_limits();
  END IF;

  -- Count recent requests within the window
  SELECT COUNT(*) INTO _count
  FROM rate_limits
  WHERE user_id = _user_id
    AND action_type = _action_type
    AND created_at > now() - (_window_seconds || ' seconds')::INTERVAL;

  -- If under limit, record this request and allow
  IF _count < _max_requests THEN
    INSERT INTO rate_limits (user_id, action_type)
    VALUES (_user_id, _action_type);
    RETURN true;
  END IF;

  -- Rate limit exceeded
  RETURN false;
END;
$$;

-- Update process_trade function with rate limiting
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
  -- Rate limit: max 10 trades per minute
  IF NOT check_rate_limit(_user_id, 'trade', 10, 60) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many trade requests. Please wait a moment.');
  END IF;

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

-- Update create_withdrawal_request function with rate limiting
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
  -- Rate limit: max 5 withdrawal requests per hour
  IF NOT check_rate_limit(_user_id, 'withdrawal', 5, 3600) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many withdrawal requests. Please wait before trying again.');
  END IF;

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