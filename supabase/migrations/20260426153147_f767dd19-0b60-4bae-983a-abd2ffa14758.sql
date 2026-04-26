CREATE OR REPLACE FUNCTION public.cleanup_option_trade_user_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.user_notifications
  WHERE type = 'option_trade'
     OR COALESCE(metadata, '{}'::jsonb) ? 'trade_id'
     OR COALESCE(metadata, '{}'::jsonb)->>'event' IN ('option_trade_created', 'option_trade_settled');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_option_trade_user_notifications()
IS 'Removes user-facing notifications related to option trades by type or metadata markers.';

DO $$
BEGIN
  PERFORM public.cleanup_option_trade_user_notifications();
  PERFORM public.assert_no_option_trade_user_notifications();
END;
$$;