
CREATE OR REPLACE FUNCTION public.notify_new_user_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_full_name TEXT;
  v_user_code INTEGER;
BEGIN
  -- Get info from the newly created profile
  v_full_name := COALESCE(NEW.full_name, 'N/A');
  v_user_email := COALESCE(NEW.email, 'N/A');

  -- Get user_code (may be set by assign_user_code trigger)
  v_user_code := NEW.user_code;

  -- Insert notification to trigger Telegram via existing trigger
  INSERT INTO public.user_notifications (user_id, title, message, type, metadata)
  VALUES (
    NEW.id,
    '👤 Người dùng mới đăng ký',
    '📧 Email: ' || v_user_email || E'\n' ||
    '👤 Tên: ' || v_full_name || E'\n' ||
    '🆔 Mã: ' || COALESCE(v_user_code::TEXT, 'Chưa có'),
    'info',
    jsonb_build_object('event', 'new_registration', 'user_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- Trigger on profiles table AFTER INSERT
CREATE TRIGGER trigger_notify_new_registration
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_user_registration();
