-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Verified Phone Connection Request RPC
-- Enforces phone verification at the database level.
-- RUN THIS IN SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════════════

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.request_connection_verified(UUID, UUID);

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
  v_phone_confirmed TIMESTAMPTZ;
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

  -- 3. Check phone verification in auth.users (authoritative source)
  SELECT phone_confirmed_at INTO v_phone_confirmed
    FROM auth.users
    WHERE id = v_user_id;

  IF v_phone_confirmed IS NULL THEN
    RAISE EXCEPTION 'Phone verification required. Please verify your phone number before connecting.';
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

-- Revoke direct access, grant only to authenticated users
REVOKE ALL ON FUNCTION public.request_connection_verified(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_connection_verified(UUID, UUID) TO authenticated;
