-- Create audit_logs table for compliance tracking
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs (no user access for security)
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert via SECURITY DEFINER functions
-- No direct user insert policy needed

-- Create index for efficient querying
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Update process_trade to include audit logging
CREATE OR REPLACE FUNCTION public.process_trade(_user_id uuid, _product_id uuid, _amount numeric, _trade_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _price NUMERIC;
  _total NUMERIC;
  _current_balance NUMERIC;
  _new_balance NUMERIC;
  _product_name TEXT;
  _transaction_id UUID;
BEGIN
  -- Rate limit: max 10 trades per minute
  IF NOT check_rate_limit(_user_id, 'trade', 10, 60) THEN
    -- Log rate limit violation
    INSERT INTO audit_logs (user_id, action, entity_type, details)
    VALUES (_user_id, 'rate_limit_exceeded', 'trade', jsonb_build_object(
      'trade_type', _trade_type,
      'product_id', _product_id,
      'amount', _amount
    ));
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
    -- Log failed trade attempt
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (_user_id, 'trade_failed', 'product', _product_id, jsonb_build_object(
      'reason', 'insufficient_balance',
      'trade_type', _trade_type,
      'amount', _amount,
      'total', _total,
      'balance', _current_balance,
      'product_name', _product_name
    ));
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Calculate new balance
  _new_balance := CASE
    WHEN _trade_type = 'buy' THEN COALESCE(_current_balance, 0) - _total
    ELSE COALESCE(_current_balance, 0) + _total
  END;
  
  -- Update balance atomically
  UPDATE profiles
  SET 
    balance = _new_balance,
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
  )
  RETURNING id INTO _transaction_id;
  
  -- Log successful trade for audit
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, 'trade_completed', 'transaction', _transaction_id, jsonb_build_object(
    'trade_type', _trade_type,
    'product_id', _product_id,
    'product_name', _product_name,
    'amount', _amount,
    'price', _price,
    'total', _total,
    'balance_before', _current_balance,
    'balance_after', _new_balance
  ));
  
  RETURN jsonb_build_object(
    'success', true, 
    'total', _total,
    'new_balance', _new_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error for debugging
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (_user_id, 'trade_error', 'product', _product_id, jsonb_build_object(
      'error', SQLERRM,
      'trade_type', _trade_type,
      'amount', _amount
    ));
    RETURN jsonb_build_object('success', false, 'error', 'Transaction failed. Please try again.');
END;
$$;

-- Update create_withdrawal_request to include audit logging
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(_user_id uuid, _amount numeric, _network text, _wallet_address text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_balance NUMERIC;
  _fee NUMERIC;
  _total_deduction NUMERIC;
  _transaction_id UUID;
BEGIN
  -- Rate limit: max 5 withdrawal requests per hour
  IF NOT check_rate_limit(_user_id, 'withdrawal', 5, 3600) THEN
    -- Log rate limit violation
    INSERT INTO audit_logs (user_id, action, entity_type, details)
    VALUES (_user_id, 'rate_limit_exceeded', 'withdrawal', jsonb_build_object(
      'amount', _amount,
      'network', _network
    ));
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
    -- Log invalid address attempt
    INSERT INTO audit_logs (user_id, action, entity_type, details)
    VALUES (_user_id, 'withdrawal_failed', 'withdrawal', jsonb_build_object(
      'reason', 'invalid_wallet_address',
      'network', _network,
      'amount', _amount
    ));
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
    -- Log insufficient balance attempt
    INSERT INTO audit_logs (user_id, action, entity_type, details)
    VALUES (_user_id, 'withdrawal_failed', 'withdrawal', jsonb_build_object(
      'reason', 'insufficient_balance',
      'amount', _amount,
      'fee', _fee,
      'total_required', _total_deduction,
      'balance', _current_balance,
      'network', _network
    ));
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
  )
  RETURNING id INTO _transaction_id;
  
  -- Log successful withdrawal request for audit
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, 'withdrawal_requested', 'transaction', _transaction_id, jsonb_build_object(
    'amount', _amount,
    'fee', _fee,
    'total_deduction', _total_deduction,
    'network', _network,
    'wallet_address', _wallet_address,
    'balance', _current_balance
  ));
  
  RETURN jsonb_build_object(
    'success', true,
    'amount', _amount,
    'fee', _fee,
    'total_deduction', _total_deduction
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error for debugging
    INSERT INTO audit_logs (user_id, action, entity_type, details)
    VALUES (_user_id, 'withdrawal_error', 'withdrawal', jsonb_build_object(
      'error', SQLERRM,
      'amount', _amount,
      'network', _network
    ));
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request failed. Please try again.');
END;
$$;