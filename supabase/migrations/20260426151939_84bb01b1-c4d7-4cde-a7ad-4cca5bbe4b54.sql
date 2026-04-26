DROP TRIGGER IF EXISTS on_option_trade_settled ON public.option_trades;
DROP TRIGGER IF EXISTS trigger_notify_option_trade_settled ON public.option_trades;

DROP FUNCTION IF EXISTS public.notify_option_trade_settled();