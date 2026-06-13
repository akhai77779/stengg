CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Bỏ qua check cho admin
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Bỏ qua khi đang chạy bên trong một SECURITY DEFINER function tin cậy
  -- (process_option_trade, settle, deposit/withdraw, ...). Khi đó current_user
  -- là owner của function (postgres/supabase_admin), khác với session_user.
  IF session_user IS DISTINCT FROM current_user THEN
    RETURN NEW;
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    RAISE EXCEPTION 'Not allowed to modify balance' USING ERRCODE = '42501';
  END IF;
  IF NEW.total_income IS DISTINCT FROM OLD.total_income THEN
    RAISE EXCEPTION 'Not allowed to modify total_income' USING ERRCODE = '42501';
  END IF;
  IF NEW.is_frozen IS DISTINCT FROM OLD.is_frozen THEN
    RAISE EXCEPTION 'Not allowed to modify is_frozen' USING ERRCODE = '42501';
  END IF;
  IF NEW.is_trade_frozen IS DISTINCT FROM OLD.is_trade_frozen THEN
    RAISE EXCEPTION 'Not allowed to modify is_trade_frozen' USING ERRCODE = '42501';
  END IF;
  IF NEW.withdrawal_password_hash IS DISTINCT FROM OLD.withdrawal_password_hash THEN
    RAISE EXCEPTION 'Not allowed to modify withdrawal_password_hash directly' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_code IS DISTINCT FROM OLD.user_code THEN
    RAISE EXCEPTION 'Not allowed to modify user_code' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify id' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;