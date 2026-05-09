CREATE OR REPLACE FUNCTION public.admin_revert_action(_admin_id uuid, _audit_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _log RECORD;
  _tx RECORD;
  _current_balance NUMERIC;
  _new_balance NUMERIC;
  _delta NUMERIC := 0;
  _refund_amount NUMERIC;
BEGIN
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO _log FROM audit_logs WHERE id = _audit_log_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy nhật ký');
  END IF;

  IF (_log.details ? 'reverted_at') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hành động này đã được hoàn lại');
  END IF;

  IF _log.action NOT IN ('deposit_approved','deposit_rejected','withdrawal_approved','withdrawal_rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hành động này không thể hoàn lại tự động');
  END IF;

  IF _log.entity_type <> 'transaction' OR _log.entity_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Thiếu tham chiếu giao dịch');
  END IF;

  SELECT * INTO _tx FROM transactions WHERE id = _log.entity_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy giao dịch');
  END IF;

  SELECT balance INTO _current_balance FROM profiles WHERE id = _tx.user_id FOR UPDATE;

  IF _log.action = 'deposit_approved' THEN
    IF _tx.status <> 'approved' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Trạng thái giao dịch không khớp');
    END IF;
    _delta := -1 * _tx.amount;
  ELSIF _log.action = 'withdrawal_rejected' THEN
    IF _tx.status <> 'rejected' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Trạng thái giao dịch không khớp');
    END IF;
    _refund_amount := COALESCE((_log.details->>'refund_amount')::NUMERIC, _tx.amount);
    _delta := -1 * _refund_amount;
  ELSIF _log.action = 'withdrawal_approved' THEN
    IF _tx.status <> 'approved' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Trạng thái giao dịch không khớp');
    END IF;
  ELSIF _log.action = 'deposit_rejected' THEN
    IF _tx.status <> 'rejected' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Trạng thái giao dịch không khớp');
    END IF;
  END IF;

  IF _delta <> 0 THEN
    _new_balance := COALESCE(_current_balance, 0) + _delta;
    IF _new_balance < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Số dư không đủ để hoàn tác');
    END IF;
    UPDATE profiles SET balance = _new_balance, updated_at = now() WHERE id = _tx.user_id;
  ELSE
    _new_balance := _current_balance;
  END IF;

  UPDATE transactions
  SET status = 'pending',
      notes = COALESCE(notes,'') || E'\n[Reverted by admin ' || _admin_id::text || ' at ' || now()::text || ']',
      updated_at = now()
  WHERE id = _tx.id;

  UPDATE audit_logs
  SET details = COALESCE(details,'{}'::jsonb) || jsonb_build_object(
    'reverted_at', now(),
    'reverted_by', _admin_id
  )
  WHERE id = _log.id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_tx.user_id, 'action_reverted', 'transaction', _tx.id,
    jsonb_build_object(
      'admin_id', _admin_id,
      'original_audit_id', _log.id,
      'original_action', _log.action,
      'balance_before', _current_balance,
      'balance_after', _new_balance,
      'delta', _delta
    ));

  RETURN jsonb_build_object('success', true, 'new_balance', _new_balance, 'delta', _delta);
END;
$function$;