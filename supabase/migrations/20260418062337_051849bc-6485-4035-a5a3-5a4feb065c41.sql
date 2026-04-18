CREATE OR REPLACE FUNCTION public.donate_to_charity(_user_id uuid, _program_id uuid, _amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance NUMERIC;
  _new_balance NUMERIC;
  _program RECORD;
  _new_current NUMERIC;
BEGIN
  -- Validate amount
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số tiền không hợp lệ');
  END IF;

  -- Rate limit: max 5 donations per minute
  IF NOT check_rate_limit(_user_id, 'charity_donate', 5, 60) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quá nhiều yêu cầu. Vui lòng chờ.');
  END IF;

  -- Lock and get program
  SELECT * INTO _program
  FROM charity_programs
  WHERE id = _program_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quỹ không tồn tại hoặc đã đóng');
  END IF;

  -- Lock user balance
  SELECT balance INTO _current_balance
  FROM profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng');
  END IF;

  IF COALESCE(_current_balance, 0) < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số dư không đủ');
  END IF;

  -- Deduct user balance
  _new_balance := _current_balance - _amount;
  UPDATE profiles
  SET balance = _new_balance, updated_at = now()
  WHERE id = _user_id;

  -- Add to charity current_amount
  _new_current := COALESCE(_program.current_amount, 0) + _amount;
  UPDATE charity_programs
  SET current_amount = _new_current, updated_at = now()
  WHERE id = _program_id;

  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, 'charity_donation', 'charity_program', _program_id, jsonb_build_object(
    'program_title', _program.title,
    'amount', _amount,
    'currency', _program.currency,
    'balance_before', _current_balance,
    'balance_after', _new_balance,
    'program_current_after', _new_current
  ));

  -- User notification
  INSERT INTO user_notifications (user_id, title, message, type, metadata)
  VALUES (_user_id, '❤️ Quyên góp thành công',
    'Bạn đã quyên góp ' || _amount || ' USDT cho "' || _program.title || '"',
    'success',
    jsonb_build_object('program_id', _program_id, 'amount', _amount));

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', _new_balance,
    'new_current_amount', _new_current
  );
END;
$$;