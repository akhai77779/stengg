-- Stats per program (no cap)
CREATE OR REPLACE FUNCTION public.get_charity_program_stats(_program_id uuid)
RETURNS TABLE(unique_donors bigint, total_donations bigint, total_amount numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COUNT(DISTINCT al.user_id)::bigint AS unique_donors,
    COUNT(*)::bigint AS total_donations,
    COALESCE(SUM((al.details->>'amount')::numeric), 0) AS total_amount
  FROM audit_logs al
  WHERE al.action = 'charity_donation'
    AND al.entity_id = _program_id;
$$;

-- Admin: get all donations with optional program filter
CREATE OR REPLACE FUNCTION public.get_all_charity_donations(
  _program_id uuid DEFAULT NULL,
  _limit integer DEFAULT 500,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  program_id uuid,
  program_title text,
  amount numeric,
  currency text,
  donor_email text,
  donor_name text,
  user_code integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.user_id,
    al.entity_id AS program_id,
    cp.title AS program_title,
    (al.details->>'amount')::numeric AS amount,
    COALESCE(al.details->>'currency', 'USD') AS currency,
    p.email AS donor_email,
    p.full_name AS donor_name,
    p.user_code,
    al.created_at
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.user_id
  LEFT JOIN charity_programs cp ON cp.id = al.entity_id
  WHERE al.action = 'charity_donation'
    AND (_program_id IS NULL OR al.entity_id = _program_id)
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 5000))
  OFFSET GREATEST(0, _offset);
END;
$$;