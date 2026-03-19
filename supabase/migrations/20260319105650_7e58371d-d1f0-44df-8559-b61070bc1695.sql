
-- Create function to send notification to Telegram via edge function
CREATE OR REPLACE FUNCTION public.notify_telegram_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_email TEXT;
  _supabase_url TEXT;
  _anon_key TEXT;
BEGIN
  -- Get user email for context
  SELECT email INTO _user_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Call telegram-notify edge function via pg_net
  PERFORM net.http_post(
    url := 'https://avqutkamqeblqirtckir.supabase.co/functions/v1/telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cXV0a2FtcWVibHFpcnRja2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzk1MjQsImV4cCI6MjA4MzgxNTUyNH0.ewqEUo7vB_sjWdlY9o4Lw_A3uXWOECDfBj99Tq8pUi0'
    ),
    body := jsonb_build_object(
      'type', 'notification',
      'title', NEW.title,
      'message', NEW.message,
      'notification_type', NEW.type,
      'user_email', COALESCE(_user_email, 'N/A')
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on user_notifications INSERT
CREATE TRIGGER trigger_telegram_on_notification
AFTER INSERT ON public.user_notifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_telegram_on_notification();
