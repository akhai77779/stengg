-- Update create_withdrawal_request to support bank withdrawals
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
  current_balance NUMERIC;
  withdrawal_fee NUMERIC;
  net_amount NUMERIC;
  transaction_id UUID;
  is_frozen BOOLEAN;
  is_trade_frozen BOOLEAN;
  is_crypto_network BOOLEAN;
BEGIN
  -- Check if user account is frozen
  SELECT p.is_frozen, p.is_trade_frozen INTO is_frozen, is_trade_frozen
  FROM profiles p WHERE p.id = _user_id;
  
  IF is_frozen OR is_trade_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;
  
  -- Get current balance
  SELECT balance INTO current_balance FROM profiles WHERE id = _user_id;
  
  IF current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Calculate 1% fee
  withdrawal_fee := _amount * 0.01;
  net_amount := _amount - withdrawal_fee;
  
  -- Minimum withdrawal check
  IF _amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is $10');
  END IF;
  
  -- Check if sufficient balance
  IF current_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Check if this is a crypto network or bank transfer
  is_crypto_network := _network IN ('bep20', 'trc20', 'erc20');
  
  -- For crypto networks, validate wallet address format
  IF is_crypto_network THEN
    IF NOT is_valid_wallet_address(_wallet_address, _network) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid wallet address format');
    END IF;
  END IF;
  
  -- For bank transfers, just validate that wallet_address is not empty
  IF NOT is_crypto_network THEN
    IF _wallet_address IS NULL OR LENGTH(TRIM(_wallet_address)) < 5 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid bank account information');
    END IF;
  END IF;
  
  -- Create pending withdrawal transaction
  INSERT INTO transactions (user_id, type, amount, network, wallet_address, status, notes)
  VALUES (
    _user_id,
    'withdraw',
    _amount,
    CASE WHEN is_crypto_network THEN _network ELSE 'bank' END,
    _wallet_address,
    'pending',
    'Fee: ' || withdrawal_fee || ' USD, Net: ' || net_amount || ' USD'
  )
  RETURNING id INTO transaction_id;
  
  -- Log the withdrawal request
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    _user_id,
    'withdrawal_request',
    'transaction',
    transaction_id,
    jsonb_build_object(
      'amount', _amount,
      'fee', withdrawal_fee,
      'net_amount', net_amount,
      'network', CASE WHEN is_crypto_network THEN _network ELSE 'bank' END,
      'wallet_address', _wallet_address
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', transaction_id,
    'amount', _amount,
    'fee', withdrawal_fee,
    'net_amount', net_amount
  );
END;
$$;