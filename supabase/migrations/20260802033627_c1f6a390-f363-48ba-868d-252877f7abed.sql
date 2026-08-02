DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = 'email_queue_wake') THEN
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS email_queue_wake_auth ON pgmq.q_auth_emails';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS email_queue_wake_transactional ON pgmq.q_transactional_emails';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE 'DROP FUNCTION IF EXISTS public.email_queue_wake() CASCADE';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;