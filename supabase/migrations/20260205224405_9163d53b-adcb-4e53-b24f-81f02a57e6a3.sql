-- Update create_withdrawal_request to read fee_rate and min_amount from app_settings
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(_user_id uuid, _amount numeric, _network text, _wallet_address text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC;
  withdrawal_fee NUMERIC;
  net_amount NUMERIC;
  new_balance NUMERIC;
  transaction_id UUID;
  is_frozen BOOLEAN;
  is_trade_frozen BOOLEAN;
  is_crypto_network BOOLEAN;
  total_deduction NUMERIC;
  fee_rate NUMERIC;
  min_amount NUMERIC;
  settings_value JSONB;
BEGIN
  -- Get fee_rate and min_amount from app_settings
  SELECT value INTO settings_value
  FROM app_settings
  WHERE key = 'withdraw_settings';
  
  -- Default values if not found
  fee_rate := COALESCE((settings_value->>'fee_rate')::NUMERIC, 0.01);
  min_amount := COALESCE((settings_value->>'min_amount')::NUMERIC, 10);

  -- Check if user account is frozen
  SELECT p.is_frozen, p.is_trade_frozen INTO is_frozen, is_trade_frozen
  FROM profiles p WHERE p.id = _user_id;
  
  IF is_frozen OR is_trade_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;
  
  -- Get current balance with lock for update
  SELECT balance INTO current_balance 
  FROM profiles 
  WHERE id = _user_id
  FOR UPDATE;
  
  IF current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Calculate fee based on settings
  withdrawal_fee := _amount * fee_rate;
  net_amount := _amount - withdrawal_fee;
  total_deduction := _amount + withdrawal_fee;
  
  -- Minimum withdrawal check using settings
  IF _amount < min_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is $' || min_amount::TEXT);
  END IF;
  
  -- Check if sufficient balance (including fee)
  IF current_balance < total_deduction THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance (including ' || (fee_rate * 100)::TEXT || '% fee)');
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
  
  -- DEDUCT BALANCE IMMEDIATELY
  new_balance := current_balance - total_deduction;
  
  UPDATE profiles
  SET balance = new_balance, updated_at = now()
  WHERE id = _user_id;
  
  -- Create pending withdrawal transaction
  INSERT INTO transactions (user_id, type, amount, network, wallet_address, status, notes)
  VALUES (
    _user_id,
    'withdraw',
    _amount,
    CASE WHEN is_crypto_network THEN _network ELSE 'bank' END,
    _wallet_address,
    'pending',
    'Fee: ' || withdrawal_fee || ' USD (' || (fee_rate * 100)::TEXT || '%), Net: ' || net_amount || ' USD'
  )
  RETURNING id INTO transaction_id;
  
  -- Log the withdrawal request with balance info
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    _user_id,
    'withdrawal_request',
    'transaction',
    transaction_id,
    jsonb_build_object(
      'amount', _amount,
      'fee', withdrawal_fee,
      'fee_rate', fee_rate,
      'net_amount', net_amount,
      'total_deduction', total_deduction,
      'network', CASE WHEN is_crypto_network THEN _network ELSE 'bank' END,
      'wallet_address', _wallet_address,
      'balance_before', current_balance,
      'balance_after', new_balance
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', transaction_id,
    'amount', _amount,
    'fee', withdrawal_fee,
    'net_amount', net_amount,
    'new_balance', new_balance
  );
END;
$function$;