-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 06: Rejoin Fix + OTP Removal
-- 1. Fix leave_pool_atomic: DELETE row instead of setting 'withdrawn'
-- 2. Fix join_pool_atomic: Handle edge case of stale withdrawn rows
-- 3. Fix request_connection_verified: Use profile phone validation, not auth.users.phone_confirmed_at
-- RUN THIS IN SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Fix leave_pool_atomic ──────────────────────────────────────
-- DELETE the pool_members row entirely so the UNIQUE(pool_id, user_id) 
-- constraint doesn't block rejoining. The update_pool_total trigger 
-- handles DELETE events and will recalculate current_total correctly.
CREATE OR REPLACE FUNCTION public.leave_pool_atomic(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_pool RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Verify pool exists and is in a leavable state
  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pool not found'; END IF;

  IF v_pool.status NOT IN ('waiting', 'ready') THEN
    RAISE EXCEPTION 'Cannot leave pool after ordering has started';
  END IF;

  -- Remove the membership entirely to allow rejoining
  DELETE FROM public.pool_members
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  -- Unlink requirement from the pool and reset to active
  UPDATE public.requirements
  SET status = 'active', pool_id = NULL
  WHERE pool_id = p_pool_id AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_pool_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_pool_atomic(UUID) TO authenticated;

-- ─── 2. Fix join_pool_atomic ───────────────────────────────────────
-- Add safety: delete any stale withdrawn rows before inserting.
-- This handles edge cases where a withdrawn row wasn't properly cleaned up.
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
  v_req_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the pool row to prevent race conditions
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

  -- Create requirement if not provided
  v_req_id := p_requirement_id;
  IF v_req_id IS NULL THEN
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

REVOKE ALL ON FUNCTION public.join_pool_atomic(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_pool_atomic(UUID, NUMERIC, TEXT, UUID) TO authenticated;

-- ─── 3. Fix request_connection_verified (Remove OTP dependency) ────
-- Validate phone number from profiles table instead of auth.users.phone_confirmed_at
CREATE OR REPLACE FUNCTION public.request_connection_verified(
  p_receiver_id UUID,
  p_pool_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_phone TEXT;
  v_connection_id UUID;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Cannot connect to self
  IF v_user_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot connect to yourself';
  END IF;

  -- 3. Check phone validation in public.profiles (authoritative source — no OTP/SMS)
  SELECT phone INTO v_phone
    FROM public.profiles
    WHERE id = v_user_id;

  IF v_phone IS NULL OR v_phone !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'A valid 10-digit Indian mobile number is required. Please add your phone number to your profile before connecting.';
  END IF;

  -- 4. Check receiver exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_receiver_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- 5. Check pool exists
  IF NOT EXISTS (SELECT 1 FROM public.pools WHERE id = p_pool_id) THEN
    RAISE EXCEPTION 'Pool not found';
  END IF;

  -- 6. Check for duplicate connection
  IF EXISTS (
    SELECT 1 FROM public.connections
    WHERE requester_id = v_user_id
      AND receiver_id = p_receiver_id
      AND pool_id = p_pool_id
  ) THEN
    RAISE EXCEPTION 'Connection request already sent';
  END IF;

  -- 7. Create connection
  INSERT INTO public.connections (requester_id, receiver_id, pool_id, status)
  VALUES (v_user_id, p_receiver_id, p_pool_id, 'pending')
  RETURNING id INTO v_connection_id;

  RETURN v_connection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_connection_verified(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_connection_verified(UUID, UUID) TO authenticated;

-- ─── 4. Force PostgREST schema reload ──────────────────────────────
NOTIFY pgrst, 'reload schema';
