
REVOKE ALL ON FUNCTION public.sync_price_history_tick(INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_live_price_sync_db_loop() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_price_history_tick(INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_live_price_sync_db_loop() TO service_role;
