-- Update create_withdrawal_request to deduct balance immediately when request is created
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
BEGIN
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
  
  -- Calculate 1% fee
  withdrawal_fee := _amount * 0.01;
  net_amount := _amount - withdrawal_fee;
  total_deduction := _amount + withdrawal_fee;
  
  -- Minimum withdrawal check
  IF _amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is $10');
  END IF;
  
  -- Check if sufficient balance (including fee)
  IF current_balance < total_deduction THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance (including 1% fee)');
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
    'Fee: ' || withdrawal_fee || ' USD, Net: ' || net_amount || ' USD'
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

-- Update admin_approve_withdrawal to NOT deduct balance again (already deducted)
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(_admin_id uuid, _transaction_id uuid, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tx RECORD;
  _current_balance NUMERIC;
BEGIN
  -- Verify admin role
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Lock and validate transaction
  SELECT * INTO _tx FROM transactions 
  WHERE id = _transaction_id AND status = 'pending' AND type = 'withdraw'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Giao dịch không tìm thấy, đã xử lý, hoặc không phải rút tiền');
  END IF;
  
  -- Get current balance (for logging only, balance already deducted at request time)
  SELECT balance INTO _current_balance FROM profiles
  WHERE id = _tx.user_id;
  
  -- Update transaction status to approved
  UPDATE transactions 
  SET status = 'approved', notes = COALESCE(_notes, notes), updated_at = now()
  WHERE id = _transaction_id;
  
  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_tx.user_id, 'withdrawal_approved', 'transaction', _transaction_id,
    jsonb_build_object(
      'admin_id', _admin_id, 
      'amount', _tx.amount, 
      'network', _tx.network,
      'wallet_address', _tx.wallet_address,
      'current_balance', _current_balance,
      'admin_notes', _notes,
      'note', 'Balance was deducted at request time'
    ));
  
  RETURN jsonb_build_object('success', true, 'current_balance', _current_balance);
END;
$function$;

-- Update admin_reject_transaction to REFUND balance when rejecting withdrawals
CREATE OR REPLACE FUNCTION public.admin_reject_transaction(_admin_id uuid, _transaction_id uuid, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tx RECORD;
  _current_balance NUMERIC;
  _new_balance NUMERIC;
  _refund_amount NUMERIC;
  _fee NUMERIC;
BEGIN
  -- Verify admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Lock transaction
  SELECT * INTO _tx FROM transactions 
  WHERE id = _transaction_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Giao dịch không tìm thấy hoặc đã xử lý');
  END IF;
  
  -- For withdrawals, refund the deducted amount (amount + fee)
  IF _tx.type = 'withdraw' THEN
    _fee := _tx.amount * 0.01;
    _refund_amount := _tx.amount + _fee;
    
    -- Get current balance with lock
    SELECT balance INTO _current_balance FROM profiles
    WHERE id = _tx.user_id
    FOR UPDATE;
    
    -- Refund the balance
    _new_balance := COALESCE(_current_balance, 0) + _refund_amount;
    
    UPDATE profiles
    SET balance = _new_balance, updated_at = now()
    WHERE id = _tx.user_id;
  END IF;
  
  -- Update status
  UPDATE transactions 
  SET status = 'rejected', notes = COALESCE(_notes, notes), updated_at = now()
  WHERE id = _transaction_id;
  
  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_tx.user_id, 
    CASE WHEN _tx.type = 'deposit' THEN 'deposit_rejected' ELSE 'withdrawal_rejected' END,
    'transaction', _transaction_id, 
    jsonb_build_object(
      'admin_id', _admin_id, 
      'amount', _tx.amount,
      'network', _tx.network,
      'wallet_address', _tx.wallet_address,
      'tx_hash', _tx.tx_hash,
      'admin_notes', _notes,
      'refunded', _tx.type = 'withdraw',
      'refund_amount', CASE WHEN _tx.type = 'withdraw' THEN _refund_amount ELSE NULL END,
      'balance_before', CASE WHEN _tx.type = 'withdraw' THEN _current_balance ELSE NULL END,
      'balance_after', CASE WHEN _tx.type = 'withdraw' THEN _new_balance ELSE NULL END
    ));
  
  RETURN jsonb_build_object(
    'success', true, 
    'refunded', _tx.type = 'withdraw',
    'new_balance', CASE WHEN _tx.type = 'withdraw' THEN _new_balance ELSE NULL END
  );
END;
$function$;