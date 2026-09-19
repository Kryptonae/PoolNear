-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Pool Rejoin and Connection RPC Fix
-- 1. Modify leave_pool_atomic to DELETE the member row.
-- 2. Modify request_connection_verified to validate phone number from profiles.
-- RUN THIS IN SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════════════

-- 1. Fix leave_pool_atomic
CREATE OR REPLACE FUNCTION public.leave_pool_atomic(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Remove the membership entirely to allow rejoining
  DELETE FROM public.pool_members
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  -- Unlink requirement from the pool
  UPDATE public.requirements
  SET status = 'active', pool_id = null
  WHERE pool_id = p_pool_id AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_pool_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_pool_atomic(UUID) TO authenticated;

-- 2. Fix request_connection_verified (Remove OTP dependency)
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

  -- 3. Check phone validation in public.profiles (authoritative source now)
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
