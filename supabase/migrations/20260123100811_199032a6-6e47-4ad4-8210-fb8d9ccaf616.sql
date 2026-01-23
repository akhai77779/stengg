-- Enable realtime for products table to receive instant price updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;