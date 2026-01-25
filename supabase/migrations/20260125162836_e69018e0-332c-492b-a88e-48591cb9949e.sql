-- Create SECURITY DEFINER functions for atomic admin balance operations
-- These prevent race conditions by using atomic UPDATE operations

-- Admin Add Balance function with row locking
CREATE OR REPLACE FUNCTION public.admin_add_balance(
  _admin_id UUID,
  _user_id UUID,
  _amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Verify admin role
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin role required');
  END IF;

  -- Validate amount
  IF _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock the row and get current balance
  SELECT balance INTO v_old_balance
  FROM profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_old_balance := COALESCE(v_old_balance, 0);
  v_new_balance := v_old_balance + _amount;

  -- Atomic balance update
  UPDATE profiles
  SET balance = v_new_balance, updated_at = now()
  WHERE id = _user_id;

  -- Log audit trail
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    _admin_id,
    'admin_balance_add',
    'profile',
    _user_id,
    jsonb_build_object(
      'old_balance', v_old_balance,
      'amount', _amount,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_balance', v_old_balance,
    'new_balance', v_new_balance
  );
END;
$$;

-- Admin Subtract Balance function with row locking
CREATE OR REPLACE FUNCTION public.admin_subtract_balance(
  _admin_id UUID,
  _user_id UUID,
  _amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Verify admin role
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin role required');
  END IF;

  -- Validate amount
  IF _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock the row and get current balance
  SELECT balance INTO v_old_balance
  FROM profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_old_balance := COALESCE(v_old_balance, 0);

  -- Check sufficient balance
  IF v_old_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  v_new_balance := v_old_balance - _amount;

  -- Atomic balance update
  UPDATE profiles
  SET balance = v_new_balance, updated_at = now()
  WHERE id = _user_id;

  -- Log audit trail
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    _admin_id,
    'admin_balance_subtract',
    'profile',
    _user_id,
    jsonb_build_object(
      'old_balance', v_old_balance,
      'amount', _amount,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_balance', v_old_balance,
    'new_balance', v_new_balance
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_add_balance(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_subtract_balance(UUID, UUID, NUMERIC) TO authenticated;