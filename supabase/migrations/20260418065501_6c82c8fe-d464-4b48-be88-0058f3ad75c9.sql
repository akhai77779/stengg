
CREATE OR REPLACE FUNCTION public.get_charity_donations(_program_id uuid, _limit integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  amount numeric,
  donor_email text,
  donor_name text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    al.id,
    al.user_id,
    (al.details->>'amount')::numeric AS amount,
    p.email AS donor_email,
    p.full_name AS donor_name,
    al.created_at
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.user_id
  WHERE al.action = 'charity_donation'
    AND al.entity_id = _program_id
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

CREATE OR REPLACE FUNCTION public.get_charity_top_donors(_program_id uuid, _limit integer DEFAULT 5)
RETURNS TABLE(
  user_id uuid,
  donor_email text,
  donor_name text,
  total_amount numeric,
  donation_count bigint,
  last_donation_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.user_id,
    p.email AS donor_email,
    p.full_name AS donor_name,
    SUM((al.details->>'amount')::numeric) AS total_amount,
    COUNT(*)::bigint AS donation_count,
    MAX(al.created_at) AS last_donation_at
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.user_id
  WHERE al.action = 'charity_donation'
    AND al.entity_id = _program_id
  GROUP BY al.user_id, p.email, p.full_name
  ORDER BY total_amount DESC
  LIMIT GREATEST(1, LEAST(_limit, 50));
$$;

GRANT EXECUTE ON FUNCTION public.get_charity_donations(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_charity_top_donors(uuid, integer) TO authenticated;
