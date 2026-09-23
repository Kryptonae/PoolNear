-- ====================================================================
-- PoolNear — Migration 23: Fix update_receiving_location_atomic
-- Removes the UPDATE to pool_members.destination which no longer exists
-- (removed in migration 22)
-- ====================================================================

DROP FUNCTION IF EXISTS public.update_receiving_location_atomic(uuid, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.update_receiving_location_atomic(
  p_pool_id uuid,
  p_destination text,
  p_latitude numeric,
  p_longitude numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_member_id uuid;
  v_pool_status text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status INTO v_pool_status FROM public.pools WHERE id = p_pool_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pool not found';
  END IF;

  SELECT id INTO v_member_id FROM public.pool_members
  WHERE pool_id = p_pool_id AND user_id = v_user_id AND commitment_status != 'withdrawn';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not an active member of this pool';
  END IF;

  -- Only allow updating destination if the pool is not locked/completed
  IF v_pool_status IN ('order_placed', 'delivered', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Cannot update location, order is already in progress or completed';
  END IF;

  -- Update the member's requirements (destination lives in requirements, NOT pool_members)
  UPDATE public.requirements
  SET destination = p_destination,
      latitude = p_latitude,
      longitude = p_longitude
  WHERE pool_id = p_pool_id AND user_id = v_user_id AND status != 'cancelled';

END;
$$;

GRANT EXECUTE ON FUNCTION public.update_receiving_location_atomic(uuid, text, numeric, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
