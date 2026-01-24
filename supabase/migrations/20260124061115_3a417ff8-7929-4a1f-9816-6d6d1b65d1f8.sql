-- Fix transaction type constraint to allow all types used in the application
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('deposit', 'withdraw', 'buy', 'sell'));

-- Admin approve deposit with atomic operations
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(
  _admin_id UUID,
  _transaction_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx RECORD;
  _new_balance NUMERIC;
  _current_balance NUMERIC;
BEGIN
  -- Verify admin role
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Lock and validate transaction (prevents double-approval)
  SELECT * INTO _tx FROM transactions 
  WHERE id = _transaction_id AND status = 'pending' AND type = 'deposit'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Giao dịch không tìm thấy, đã xử lý, hoặc không phải nạp tiền');
  END IF;
  
  -- Get current balance with lock
  SELECT balance INTO _current_balance FROM profiles
  WHERE id = _tx.user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng');
  END IF;
  
  -- Calculate new balance
  _new_balance := COALESCE(_current_balance, 0) + _tx.amount;
  
  -- Atomic balance update
  UPDATE profiles 
  SET balance = _new_balance, updated_at = now()
  WHERE id = _tx.user_id;
  
  -- Update transaction status
  UPDATE transactions 
  SET status = 'approved', notes = COALESCE(_notes, notes), updated_at = now()
  WHERE id = _transaction_id;
  
  -- Audit log (in same transaction)
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_tx.user_id, 'deposit_approved', 'transaction', _transaction_id, 
    jsonb_build_object(
      'admin_id', _admin_id, 
      'amount', _tx.amount, 
      'network', _tx.network,
      'tx_hash', _tx.tx_hash,
      'balance_before', _current_balance,
      'balance_after', _new_balance,
      'admin_notes', _notes
    ));
  
  RETURN jsonb_build_object('success', true, 'new_balance', _new_balance);
END;
$$;

-- Admin approve withdrawal with atomic operations  
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(
  _admin_id UUID,
  _transaction_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx RECORD;
  _fee NUMERIC;
  _fee_percent NUMERIC;
  _total_deduction NUMERIC;
  _new_balance NUMERIC;
  _current_balance NUMERIC;
BEGIN
  -- Verify admin role
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Get withdrawal fee from settings (NOT hardcoded)
  SELECT (value->>'percent')::NUMERIC INTO _fee_percent
  FROM app_settings WHERE key = 'withdrawal_fee';
  
  IF _fee_percent IS NULL THEN
    _fee_percent := 1; -- Default 1% if not configured
  END IF;
  
  -- Lock and validate transaction
  SELECT * INTO _tx FROM transactions 
  WHERE id = _transaction_id AND status = 'pending' AND type = 'withdraw'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Giao dịch không tìm thấy, đã xử lý, hoặc không phải rút tiền');
  END IF;
  
  -- Calculate fee with correct percentage
  _fee := _tx.amount * (_fee_percent / 100);
  _total_deduction := _tx.amount + _fee;
  
  -- Get current balance with lock
  SELECT balance INTO _current_balance FROM profiles
  WHERE id = _tx.user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng');
  END IF;
  
  -- Validate sufficient balance
  IF COALESCE(_current_balance, 0) < _total_deduction THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số dư không đủ để rút tiền và phí');
  END IF;
  
  -- Calculate and update balance
  _new_balance := COALESCE(_current_balance, 0) - _total_deduction;
  
  UPDATE profiles 
  SET balance = _new_balance, updated_at = now()
  WHERE id = _tx.user_id;
  
  -- Update transaction status
  UPDATE transactions 
  SET status = 'approved', notes = COALESCE(_notes, notes), updated_at = now()
  WHERE id = _transaction_id;
  
  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_tx.user_id, 'withdrawal_approved', 'transaction', _transaction_id,
    jsonb_build_object(
      'admin_id', _admin_id, 
      'amount', _tx.amount, 
      'fee', _fee, 
      'fee_percent', _fee_percent,
      'total_deduction', _total_deduction,
      'network', _tx.network,
      'wallet_address', _tx.wallet_address,
      'balance_before', _current_balance,
      'balance_after', _new_balance,
      'admin_notes', _notes
    ));
  
  RETURN jsonb_build_object('success', true, 'new_balance', _new_balance, 'fee', _fee);
END;
$$;

-- Admin reject transaction
CREATE OR REPLACE FUNCTION public.admin_reject_transaction(
  _admin_id UUID,
  _transaction_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx RECORD;
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
      'admin_notes', _notes
    ));
  
  RETURN jsonb_build_object('success', true);
END;
$$;