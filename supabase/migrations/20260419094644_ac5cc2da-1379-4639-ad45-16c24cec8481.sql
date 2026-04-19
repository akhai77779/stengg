-- ============================================================
-- 1. Bảng savings_packages (sự kiện gửi tiết kiệm)
-- ============================================================
CREATE TABLE public.savings_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cycle_months INTEGER NOT NULL CHECK (cycle_months IN (3, 6, 12)),
  interest_rate_percent NUMERIC(6,2) NOT NULL CHECK (interest_rate_percent >= 0 AND interest_rate_percent <= 1000),
  min_deposit_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (min_deposit_amount >= 0),
  max_total_pool NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (max_total_pool >= 0),
  current_pool NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (current_pool >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  event_start_at TIMESTAMPTZ,
  event_end_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_savings_packages_active ON public.savings_packages(is_active, event_start_at, event_end_at);

ALTER TABLE public.savings_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage savings packages"
ON public.savings_packages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view active savings packages"
ON public.savings_packages
FOR SELECT
TO authenticated
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_savings_packages_updated_at
BEFORE UPDATE ON public.savings_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Bảng user_savings_deposits (khoản gửi của user)
-- ============================================================
CREATE TABLE public.user_savings_deposits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_id UUID NOT NULL REFERENCES public.savings_packages(id) ON DELETE RESTRICT,
  principal_amount NUMERIC(18,2) NOT NULL CHECK (principal_amount > 0),
  interest_rate_percent NUMERIC(6,2) NOT NULL,
  cycle_months INTEGER NOT NULL,
  interest_amount NUMERIC(18,2) NOT NULL,
  total_payout NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'matured', 'paid', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matures_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_savings_user ON public.user_savings_deposits(user_id, status);
CREATE INDEX idx_user_savings_settle ON public.user_savings_deposits(status, matures_at) WHERE status = 'active';
CREATE INDEX idx_user_savings_package ON public.user_savings_deposits(package_id);

ALTER TABLE public.user_savings_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all savings deposits"
ON public.user_savings_deposits
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update all savings deposits"
ON public.user_savings_deposits
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own savings deposits"
ON public.user_savings_deposits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_savings_deposits_updated_at
BEFORE UPDATE ON public.user_savings_deposits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. RPC: create_savings_deposit
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_savings_deposit(
  _user_id UUID,
  _package_id UUID,
  _amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pkg RECORD;
  _balance NUMERIC;
  _new_balance NUMERIC;
  _interest NUMERIC;
  _payout NUMERIC;
  _matures_at TIMESTAMPTZ;
  _deposit_id UUID;
  _new_pool NUMERIC;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số tiền không hợp lệ');
  END IF;

  IF NOT check_rate_limit(_user_id, 'savings_deposit', 5, 60) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quá nhiều yêu cầu. Vui lòng chờ.');
  END IF;

  SELECT * INTO _pkg FROM savings_packages WHERE id = _package_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gói không tồn tại');
  END IF;

  IF NOT _pkg.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gói đã đóng');
  END IF;

  IF _pkg.event_start_at IS NOT NULL AND now() < _pkg.event_start_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sự kiện chưa bắt đầu');
  END IF;

  IF _pkg.event_end_at IS NOT NULL AND now() > _pkg.event_end_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sự kiện đã kết thúc');
  END IF;

  IF _amount < _pkg.min_deposit_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số tiền tối thiểu là ' || _pkg.min_deposit_amount || ' ' || _pkg.currency);
  END IF;

  IF _pkg.max_total_pool > 0 AND (_pkg.current_pool + _amount) > _pkg.max_total_pool THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quỹ đã đầy. Còn lại: ' || (_pkg.max_total_pool - _pkg.current_pool));
  END IF;

  SELECT balance INTO _balance FROM profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy người dùng');
  END IF;

  IF COALESCE(_balance, 0) < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số dư không đủ');
  END IF;

  _interest := ROUND(_amount * _pkg.interest_rate_percent / 100.0, 2);
  _payout := _amount + _interest;
  _matures_at := now() + (_pkg.cycle_months || ' months')::INTERVAL;
  _new_balance := _balance - _amount;
  _new_pool := _pkg.current_pool + _amount;

  UPDATE profiles SET balance = _new_balance, updated_at = now() WHERE id = _user_id;
  UPDATE savings_packages SET current_pool = _new_pool, updated_at = now() WHERE id = _package_id;

  INSERT INTO user_savings_deposits (
    user_id, package_id, principal_amount, interest_rate_percent, cycle_months,
    interest_amount, total_payout, currency, matures_at
  ) VALUES (
    _user_id, _package_id, _amount, _pkg.interest_rate_percent, _pkg.cycle_months,
    _interest, _payout, _pkg.currency, _matures_at
  ) RETURNING id INTO _deposit_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user_id, 'savings_deposit_created', 'savings_deposit', _deposit_id, jsonb_build_object(
    'package_id', _package_id,
    'package_title', _pkg.title,
    'principal', _amount,
    'interest_rate', _pkg.interest_rate_percent,
    'cycle_months', _pkg.cycle_months,
    'interest_amount', _interest,
    'total_payout', _payout,
    'matures_at', _matures_at,
    'balance_before', _balance,
    'balance_after', _new_balance
  ));

  INSERT INTO user_notifications (user_id, title, message, type, metadata)
  VALUES (_user_id, '💰 Gửi tiết kiệm thành công',
    'Đã gửi ' || _amount || ' ' || _pkg.currency || ' vào "' || _pkg.title || '". Đáo hạn nhận ' || _payout || ' ' || _pkg.currency,
    'success',
    jsonb_build_object('deposit_id', _deposit_id, 'matures_at', _matures_at));

  RETURN jsonb_build_object(
    'success', true,
    'deposit_id', _deposit_id,
    'interest_amount', _interest,
    'total_payout', _payout,
    'matures_at', _matures_at,
    'new_balance', _new_balance
  );
END;
$$;

-- ============================================================
-- 4. RPC: settle_matured_savings_deposits (cron-callable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.settle_matured_savings_deposits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dep RECORD;
  _new_balance NUMERIC;
  _settled_count INTEGER := 0;
  _total_paid NUMERIC := 0;
BEGIN
  FOR _dep IN
    SELECT * FROM user_savings_deposits
    WHERE status = 'active' AND matures_at <= now()
    ORDER BY matures_at ASC
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE profiles
    SET balance = COALESCE(balance, 0) + _dep.total_payout,
        total_income = COALESCE(total_income, 0) + _dep.interest_amount,
        updated_at = now()
    WHERE id = _dep.user_id
    RETURNING balance INTO _new_balance;

    UPDATE user_savings_deposits
    SET status = 'paid', paid_at = now(), updated_at = now()
    WHERE id = _dep.id;

    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (_dep.user_id, 'savings_deposit_paid', 'savings_deposit', _dep.id, jsonb_build_object(
      'principal', _dep.principal_amount,
      'interest', _dep.interest_amount,
      'payout', _dep.total_payout,
      'new_balance', _new_balance
    ));

    INSERT INTO user_notifications (user_id, title, message, type, metadata)
    VALUES (_dep.user_id, '🎉 Đáo hạn tiết kiệm',
      'Khoản gửi ' || _dep.principal_amount || ' ' || _dep.currency || ' đã đáo hạn. Nhận về ' || _dep.total_payout || ' ' || _dep.currency || ' (lãi ' || _dep.interest_amount || ')',
      'success',
      jsonb_build_object('deposit_id', _dep.id, 'payout', _dep.total_payout));

    _settled_count := _settled_count + 1;
    _total_paid := _total_paid + _dep.total_payout;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'settled_count', _settled_count, 'total_paid', _total_paid);
END;
$$;

-- ============================================================
-- 5. RPC: get_savings_package_stats
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_savings_package_stats(_package_id UUID)
RETURNS TABLE(
  unique_depositors BIGINT,
  total_deposits BIGINT,
  total_principal NUMERIC,
  active_principal NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT user_id)::BIGINT,
    COUNT(*)::BIGINT,
    COALESCE(SUM(principal_amount), 0),
    COALESCE(SUM(principal_amount) FILTER (WHERE status = 'active'), 0)
  FROM user_savings_deposits
  WHERE package_id = _package_id;
$$;

-- ============================================================
-- 6. RPC: get_user_active_savings_total
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_active_savings_total(_user_id UUID)
RETURNS TABLE(
  active_count BIGINT,
  total_principal NUMERIC,
  total_expected_payout NUMERIC,
  total_expected_interest NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(principal_amount), 0),
    COALESCE(SUM(total_payout), 0),
    COALESCE(SUM(interest_amount), 0)
  FROM user_savings_deposits
  WHERE user_id = _user_id AND status = 'active';
$$;