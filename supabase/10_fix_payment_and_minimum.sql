-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 10: Fix Payment Connection & Minimum Order Validation
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Fix join_pool_atomic ───────────────────────────────────────
-- Add atomic check for remaining minimum order requirement

CREATE OR REPLACE FUNCTION public.join_pool_atomic(
  p_pool_id UUID,
  p_contribution NUMERIC,
  p_product_description TEXT,
  p_requirement_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pool RECORD;
  v_member_count INTEGER;
  v_existing_member RECORD;
  v_req_record RECORD;
  v_req_id UUID;
  v_user_id UUID;
  v_remaining_required NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_contribution <= 0 THEN
    RAISE EXCEPTION 'Contribution must be greater than zero';
  END IF;

  -- Lock the pool row to prevent race conditions and get LATEST current_total
  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pool not found';
  END IF;

  IF v_pool.status NOT IN ('waiting', 'ready') THEN
    RAISE EXCEPTION 'This pool is no longer accepting members';
  END IF;

  IF v_pool.expires_at <= NOW() THEN
    RAISE EXCEPTION 'This pool has expired';
  END IF;

  -- ─── MINIMUM ORDER VALIDATION ───
  -- Calculate exactly how much is still needed to hit the minimum
  v_remaining_required := GREATEST(0, v_pool.minimum_order_value - COALESCE(v_pool.current_total, 0));
  
  -- If there's a gap, the new contribution MUST be at least that gap
  IF v_remaining_required > 0 AND p_contribution < v_remaining_required THEN
    RAISE EXCEPTION 'Minimum contribution required: %', v_remaining_required;
  END IF;
  -- ────────────────────────────────

  -- Check for existing membership
  SELECT * INTO v_existing_member
  FROM public.pool_members
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  IF FOUND THEN
    IF v_existing_member.commitment_status != 'withdrawn' THEN
      RAISE EXCEPTION 'You are already a member of this pool';
    ELSE
      -- Clean up stale withdrawn row to allow fresh rejoin
      DELETE FROM public.pool_members WHERE id = v_existing_member.id;
    END IF;
  END IF;

  -- Check capacity (count only active members)
  SELECT COUNT(*) INTO v_member_count
  FROM public.pool_members
  WHERE pool_id = p_pool_id AND commitment_status != 'withdrawn';

  IF v_member_count >= v_pool.max_members THEN
    RAISE EXCEPTION 'This pool is already full';
  END IF;

  -- Validate or Create Requirement
  v_req_id := p_requirement_id;
  IF v_req_id IS NOT NULL THEN
    -- Security check: Ensure the requirement belongs to this user and pool
    SELECT * INTO v_req_record FROM public.requirements WHERE id = v_req_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Provided requirement not found';
    END IF;
    IF v_req_record.user_id != v_user_id THEN
      RAISE EXCEPTION 'Requirement does not belong to you';
    END IF;
    IF v_req_record.pool_id != p_pool_id THEN
      RAISE EXCEPTION 'Requirement does not belong to this pool';
    END IF;
  ELSE
    -- Create requirement if not provided
    INSERT INTO public.requirements (
      user_id, pool_id, product_description, amount, quantity,
      platform, platform_other, minimum_order_value,
      required_by, maximum_distance, latitude, longitude,
      destination, status, expires_at
    ) VALUES (
      v_user_id, p_pool_id, p_product_description, p_contribution, 1,
      v_pool.platform, v_pool.platform_other, v_pool.minimum_order_value,
      v_pool.required_by, 500, v_pool.latitude, v_pool.longitude,
      v_pool.destination, 'matched', v_pool.expires_at
    ) RETURNING id INTO v_req_id;
  END IF;

  -- Add member with fresh state
  -- NOTE: The update_pool_total trigger handles pools.current_total updating
  INSERT INTO public.pool_members (
    pool_id, user_id, requirement_id, contribution,
    commitment_status, payment_status, receipt_status,
    can_place_order, payment_proof_url
  ) VALUES (
    p_pool_id, v_user_id, v_req_id, p_contribution,
    'committed', 'pending', 'pending',
    false, NULL
  );

  -- Notify pool creator about new member
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_pool.creator_id,
    'member_joined',
    'New member joined!',
    'Someone joined your pool on ' || v_pool.platform::TEXT || '.',
    jsonb_build_object('pool_id', p_pool_id)
  );

  RETURN v_req_id;
END;
$$;


-- ─── 2. Fix mark_payment_sent_atomic ───────────────────────────────
-- Add check to enforce connect-before-payment

CREATE OR REPLACE FUNCTION public.mark_payment_sent_atomic(
  p_pool_id UUID, 
  p_proof_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_pool RECORD;
  v_member RECORD;
  v_is_connected BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id;
  IF v_pool.status NOT IN ('ordering', 'order_placed', 'delivering', 'delivered') THEN
    RAISE EXCEPTION 'Pool not in correct status for payment';
  END IF;
  
  -- Payment requires an orderer to have been selected
  IF v_pool.orderer_id IS NULL THEN
    RAISE EXCEPTION 'No orderer has been selected for this pool';
  END IF;

  SELECT * INTO v_member FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = v_user_id;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF v_member.payment_status = 'confirmed' THEN RAISE EXCEPTION 'Payment already confirmed'; END IF;

  -- ─── CONNECT-BEFORE-PAYMENT VALIDATION ───
  IF v_user_id != v_pool.orderer_id THEN
    SELECT EXISTS(
      SELECT 1 FROM public.connections
      WHERE pool_id = p_pool_id
        AND status = 'accepted'
        AND (
          (requester_id = v_user_id AND receiver_id = v_pool.orderer_id)
          OR
          (requester_id = v_pool.orderer_id AND receiver_id = v_user_id)
        )
    ) INTO v_is_connected;

    IF NOT v_is_connected THEN
      RAISE EXCEPTION 'Connect with the orderer before making payment.';
    END IF;
  END IF;
  -- ─────────────────────────────────────────

  UPDATE public.pool_members
  SET payment_status = 'sent', payment_proof_url = p_proof_url
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (v_pool.orderer_id, 'payment_sent', 'Payment Sent', 'A member has sent their payment.', jsonb_build_object('pool_id', p_pool_id));
END;
$$;

-- 3. Security Grants
REVOKE ALL ON FUNCTION public.join_pool_atomic(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_pool_atomic(UUID, NUMERIC, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_payment_sent_atomic(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_payment_sent_atomic(UUID, TEXT) TO authenticated;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
