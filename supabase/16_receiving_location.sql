-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 16: Update Receiving Location
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_receiving_location_atomic(
  p_pool_id UUID,
  p_destination TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_member RECORD;
  v_pool RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- 1. Ensure member exists
  SELECT * INTO v_member FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = v_user_id AND commitment_status != 'withdrawn';
  IF v_member IS NULL THEN RAISE EXCEPTION 'Membership not found'; END IF;

  -- 2. Load the pool
  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id;
  IF v_pool IS NULL THEN RAISE EXCEPTION 'Pool not found'; END IF;

  -- 3. Verify accepted connection if not orderer
  IF v_user_id != v_pool.orderer_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.connections
      WHERE pool_id = p_pool_id
        AND status = 'accepted'
        AND (
          (requester_id = v_user_id AND receiver_id = v_pool.orderer_id) OR
          (requester_id = v_pool.orderer_id AND receiver_id = v_user_id)
        )
    ) THEN
      RAISE EXCEPTION 'Connect with the orderer before choosing a receiving location.';
    END IF;
  END IF;

  -- 4. Validate destination input
  IF p_destination IS NULL OR trim(p_destination) = '' THEN
    RAISE EXCEPTION 'Destination cannot be empty.';
  END IF;
  
  IF length(trim(p_destination)) > 300 THEN
    RAISE EXCEPTION 'Destination is too long.';
  END IF;

  -- 5. Update destination for all this user's active requirements in this pool
  UPDATE public.requirements
  SET destination = trim(p_destination)
  WHERE pool_id = p_pool_id 
    AND user_id = v_user_id 
    AND status != 'cancelled';
END;
$$;

REVOKE ALL ON FUNCTION public.update_receiving_location_atomic(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_receiving_location_atomic(UUID, TEXT) TO authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
