-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 15: Allow Resending Connections
-- ═══════════════════════════════════════════════════════════════════

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
  v_existing_conn RECORD;
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

  -- 6. Handle existing connection
  SELECT * INTO v_existing_conn FROM public.connections
  WHERE requester_id = v_user_id
    AND receiver_id = p_receiver_id
    AND pool_id = p_pool_id;

  IF FOUND THEN
    IF v_existing_conn.status = 'pending' THEN
      RAISE EXCEPTION 'Connection request already sent';
    ELSIF v_existing_conn.status = 'accepted' THEN
      -- Treat as already connected, just return the existing ID without notifying
      RETURN v_existing_conn.id;
    ELSIF v_existing_conn.status IN ('rejected', 'expired') THEN
      UPDATE public.connections
      SET status = 'pending',
          updated_at = NOW()
      WHERE id = v_existing_conn.id
      RETURNING id INTO v_connection_id;
    END IF;
  ELSE
    -- 7. Create connection
    INSERT INTO public.connections (requester_id, receiver_id, pool_id, status)
    VALUES (v_user_id, p_receiver_id, p_pool_id, 'pending')
    RETURNING id INTO v_connection_id;
  END IF;

  -- 8. Send notification for new or resent requests
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    p_receiver_id,
    'connection_request',
    'Connection request',
    'A user wants to connect with you to coordinate a group order.',
    jsonb_build_object(
      'pool_id', p_pool_id,
      'requester_id', v_user_id,
      'connection_id', v_connection_id
    )
  );

  RETURN v_connection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_connection_verified(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_connection_verified(UUID, UUID) TO authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
