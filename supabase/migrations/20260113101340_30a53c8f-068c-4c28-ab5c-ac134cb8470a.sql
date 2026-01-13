-- Enable realtime for transactions table to support admin notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;