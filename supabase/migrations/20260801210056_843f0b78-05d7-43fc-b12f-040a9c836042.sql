DO $$
DECLARE
  r record;
  admin_guard text := $g$
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin role required');
  END IF;
  _admin_id := auth.uid();
$g$;
  user_guard text := $g$
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
$g$;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('admin_add_balance','admin_subtract_balance','admin_approve_deposit',
                        'admin_approve_withdrawal','admin_reject_transaction','admin_revert_action',
                        'admin_update_bank_account','admin_delete_bank_account')
  LOOP
    EXECUTE regexp_replace(pg_get_functiondef(r.oid), 'BEGIN', 'BEGIN' || admin_guard);
  END LOOP;

  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('process_trade','process_option_trade','create_withdrawal_request','create_savings_deposit')
  LOOP
    EXECUTE regexp_replace(pg_get_functiondef(r.oid), 'BEGIN', 'BEGIN' || user_guard);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Anon can view agent presence" ON public.agent_presence;