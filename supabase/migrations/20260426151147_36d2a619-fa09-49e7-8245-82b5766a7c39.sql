CREATE OR REPLACE FUNCTION public.notify_option_trade_settled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Không tạo thông báo user cho giao dịch quyền chọn.
  -- Lịch sử giao dịch vẫn được lưu trong option_trades và audit_logs.
  RETURN NEW;
END;
$function$;

DELETE FROM public.user_notifications
WHERE metadata ? 'trade_id'
   OR metadata->>'event' = 'option_trade_created'
   OR type = 'option_trade'
   OR title ILIKE '%giao dịch quyền chọn%'
   OR title ILIKE '%lệnh giao dịch%';