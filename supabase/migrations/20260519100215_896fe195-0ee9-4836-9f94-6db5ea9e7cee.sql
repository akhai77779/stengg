
CREATE OR REPLACE FUNCTION public.admin_update_bank_account(
  _admin_id uuid,
  _account_id uuid,
  _bank_name text,
  _account_number text,
  _account_holder text,
  _branch text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_target_user uuid;
BEGIN
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT to_jsonb(b.*), b.user_id INTO v_before, v_target_user
  FROM bank_accounts b WHERE id = _account_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bank account not found');
  END IF;

  UPDATE bank_accounts
  SET bank_name = _bank_name,
      account_number = _account_number,
      account_holder = _account_holder,
      branch = NULLIF(_branch, ''),
      updated_at = now()
  WHERE id = _account_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    _admin_id,
    'bank_account_updated',
    'bank_account',
    _account_id,
    jsonb_build_object(
      'target_user_id', v_target_user,
      'before', v_before,
      'after', jsonb_build_object(
        'bank_name', _bank_name,
        'account_number', _account_number,
        'account_holder', _account_holder,
        'branch', NULLIF(_branch, '')
      )
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_bank_account(
  _admin_id uuid,
  _account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_target_user uuid;
BEGIN
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT to_jsonb(b.*), b.user_id INTO v_before, v_target_user
  FROM bank_accounts b WHERE id = _account_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bank account not found');
  END IF;

  DELETE FROM bank_accounts WHERE id = _account_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    _admin_id,
    'bank_account_deleted',
    'bank_account',
    _account_id,
    jsonb_build_object(
      'target_user_id', v_target_user,
      'snapshot', v_before
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
