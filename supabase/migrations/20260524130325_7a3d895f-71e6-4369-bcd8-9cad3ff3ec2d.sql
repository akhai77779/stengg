
-- ============================================================
-- 1. PROFILES: Prevent users from updating sensitive fields
-- ============================================================

-- Trigger function to block non-admin updates to sensitive columns
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip checks for admins / service role
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Only the row owner reaches here; protect sensitive columns
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    RAISE EXCEPTION 'Not allowed to modify balance' USING ERRCODE = '42501';
  END IF;
  IF NEW.total_income IS DISTINCT FROM OLD.total_income THEN
    RAISE EXCEPTION 'Not allowed to modify total_income' USING ERRCODE = '42501';
  END IF;
  IF NEW.is_frozen IS DISTINCT FROM OLD.is_frozen THEN
    RAISE EXCEPTION 'Not allowed to modify is_frozen' USING ERRCODE = '42501';
  END IF;
  IF NEW.is_trade_frozen IS DISTINCT FROM OLD.is_trade_frozen THEN
    RAISE EXCEPTION 'Not allowed to modify is_trade_frozen' USING ERRCODE = '42501';
  END IF;
  IF NEW.withdrawal_password_hash IS DISTINCT FROM OLD.withdrawal_password_hash THEN
    RAISE EXCEPTION 'Not allowed to modify withdrawal_password_hash directly' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_code IS DISTINCT FROM OLD.user_code THEN
    RAISE EXCEPTION 'Not allowed to modify user_code' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify id' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_sensitive_update ON public.profiles;
CREATE TRIGGER trg_prevent_profile_sensitive_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_sensitive_update();

-- Add WITH CHECK so user cannot change row ownership either
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. STORAGE: uploads bucket - enforce per-user folder ownership
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;

CREATE POLICY "Authenticated users upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (
    -- per-user folder
    (storage.foldername(name))[1] = (auth.uid())::text
    -- allow shared subfolders that have their own policy (live-chat is anon)
    OR (storage.foldername(name))[1] = 'live-chat'
  )
);

CREATE POLICY "Authenticated users update own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Authenticated users delete own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- ============================================================
-- 3. REALTIME: enable RLS on realtime.messages to scope channels
-- ============================================================

ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read public realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can read public realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Public channels (postgres_changes on public.* tables broadcast as schema names)
  realtime.topic() IN ('public', 'realtime', 'broadcast')
  OR realtime.topic() LIKE 'public:%'
  OR realtime.topic() LIKE 'broadcast:%'
  OR realtime.topic() LIKE 'presence:%'
  -- Per-user private channels: 'user:<uid>' or 'private:<uid>'
  OR realtime.topic() = ('user:' || (auth.uid())::text)
  OR realtime.topic() = ('private:' || (auth.uid())::text)
  -- Admin can read all
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Authenticated can write public realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can write public realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'broadcast:%'
  OR realtime.topic() LIKE 'presence:%'
  OR realtime.topic() = ('user:' || (auth.uid())::text)
  OR realtime.topic() = ('private:' || (auth.uid())::text)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
