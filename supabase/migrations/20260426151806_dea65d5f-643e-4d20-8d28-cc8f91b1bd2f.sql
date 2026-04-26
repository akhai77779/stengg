CREATE OR REPLACE FUNCTION public.prevent_trade_user_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'option_trade'
     OR COALESCE(NEW.metadata, '{}'::jsonb) ? 'trade_id'
     OR COALESCE(NEW.metadata, '{}'::jsonb)->>'event' IN ('option_trade_created', 'option_trade_settled') THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_trade_user_notification_before_insert ON public.user_notifications;

CREATE TRIGGER prevent_trade_user_notification_before_insert
BEFORE INSERT ON public.user_notifications
FOR EACH ROW
EXECUTE FUNCTION public.prevent_trade_user_notification();