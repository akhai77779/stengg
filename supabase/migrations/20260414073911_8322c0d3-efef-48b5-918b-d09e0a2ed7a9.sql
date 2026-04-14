CREATE OR REPLACE FUNCTION public.notify_telegram_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_email TEXT;
BEGIN
  SELECT email INTO _user_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  PERFORM net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGlkZGNlbHl4ZmJ5dnNsb3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDI5NjQsImV4cCI6MjA4OTUxODk2NH0._A6_ykyYi7FqoAMO46ntG2q-oyRSWmtBKB7ANqcBlxc'
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
$function$;