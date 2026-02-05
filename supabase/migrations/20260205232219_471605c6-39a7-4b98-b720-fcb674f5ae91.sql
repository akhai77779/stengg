-- Update admin_reject_transaction to read fee_rate from app_settings
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
  _fee_rate NUMERIC;
  _settings_value JSONB;
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
    -- Get fee_rate from app_settings
    SELECT value INTO _settings_value
    FROM app_settings
    WHERE key = 'withdraw_settings';
    
    -- Default to 0.01 (1%) if not found
    _fee_rate := COALESCE((_settings_value->>'fee_rate')::NUMERIC, 0.01);
    _fee := _tx.amount * _fee_rate;
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
      'fee_rate', CASE WHEN _tx.type = 'withdraw' THEN _fee_rate ELSE NULL END,
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