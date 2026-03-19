
-- Attach the existing notify_transaction_status_change function to transactions table
CREATE TRIGGER trigger_transaction_status_change
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_transaction_status_change();
