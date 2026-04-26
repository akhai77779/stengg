CREATE OR REPLACE FUNCTION public.assert_no_option_trade_user_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  legacy_trade_notification_trigger_count integer;
  trade_notification_row_count integer;
  blocker_trigger_count integer;
BEGIN
  SELECT COUNT(*)
  INTO legacy_trade_notification_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE n.nspname = 'public'
    AND c.relname = 'option_trades'
    AND NOT t.tgisinternal
    AND t.tgenabled IN ('O', 'R', 'A')
    AND (
      t.tgname ILIKE '%notif%'
      OR t.tgname ILIKE '%telegram%'
      OR p.proname ILIKE '%notif%'
      OR p.proname ILIKE '%telegram%'
    );

  IF legacy_trade_notification_trigger_count > 0 THEN
    RAISE EXCEPTION 'Post-deploy check failed: % option trade notification trigger(s) are still active on public.option_trades', legacy_trade_notification_trigger_count;
  END IF;

  SELECT COUNT(*)
  INTO trade_notification_row_count
  FROM public.user_notifications
  WHERE type = 'option_trade'
     OR COALESCE(metadata, '{}'::jsonb) ? 'trade_id'
     OR COALESCE(metadata, '{}'::jsonb)->>'event' IN ('option_trade_created', 'option_trade_settled');

  IF trade_notification_row_count > 0 THEN
    RAISE EXCEPTION 'Post-deploy check failed: % option trade notification row(s) still exist in public.user_notifications', trade_notification_row_count;
  END IF;

  SELECT COUNT(*)
  INTO blocker_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE n.nspname = 'public'
    AND c.relname = 'user_notifications'
    AND NOT t.tgisinternal
    AND t.tgenabled IN ('O', 'R', 'A')
    AND t.tgname = 'prevent_trade_user_notification_before_insert'
    AND p.proname = 'prevent_trade_user_notification';

  IF blocker_trigger_count = 0 THEN
    RAISE EXCEPTION 'Post-deploy check failed: option trade notification blocker trigger is not active on public.user_notifications';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_no_option_trade_user_notifications()
IS 'Post-deploy assertion that option trade notification triggers are absent and user_notifications contains no option trade notification rows.';

DO $$
BEGIN
  PERFORM public.assert_no_option_trade_user_notifications();
END;
$$;