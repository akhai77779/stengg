-- Secure audit_logs table: Make it append-only and immutable
-- 1. Block all user INSERT - logs should only be created by SECURITY DEFINER functions
-- 2. Block all UPDATE - logs should never be modified
-- 3. Block all DELETE - logs should never be deleted

-- Policy: No direct user inserts (system uses SECURITY DEFINER functions which bypass RLS)
CREATE POLICY "No direct user inserts"
ON public.audit_logs
FOR INSERT
WITH CHECK (false);

-- Policy: No updates allowed - audit logs are immutable
CREATE POLICY "No updates allowed"
ON public.audit_logs
FOR UPDATE
USING (false);

-- Policy: No deletes allowed - audit logs must be preserved
CREATE POLICY "No deletes allowed"
ON public.audit_logs
FOR DELETE
USING (false);