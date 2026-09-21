-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 20: Receiving Location & Distance Matching
-- Updates the geocoding structure and PostGIS matching radius
-- ═══════════════════════════════════════════════════════════════════

-- 1. Drop existing function signature before recreating it
DROP FUNCTION IF EXISTS public.update_receiving_location_atomic(uuid, text);

-- 2. Recreate update_receiving_location_atomic with latitude and longitude
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

  -- Update the member's requirements
  UPDATE public.requirements
  SET destination = p_destination,
      latitude = p_latitude,
      longitude = p_longitude
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  -- Also update pool_members.destination for backwards compatibility with the UI
  UPDATE public.pool_members
  SET destination = p_destination
  WHERE id = v_member_id;

END;
$$;


-- 3. Modify get_nearby_pools to use PostGIS distance (ST_DWithin) where practical
-- We keep the business rule that radius_meters is the *searching user's* radius.
-- We cast numeric coordinates to Geography for ST_DWithin.

DROP FUNCTION IF EXISTS public.get_nearby_pools(numeric, numeric, numeric, text, text);

CREATE OR REPLACE FUNCTION public.get_nearby_pools(
  p_latitude numeric,
  p_longitude numeric,
  p_radius_meters numeric DEFAULT 500,
  p_platform text DEFAULT NULL,
  p_status text DEFAULT 'waiting'
)
RETURNS TABLE (
  pool_id uuid,
  platform text,
  platform_other text,
  minimum_order_value numeric,
  current_total numeric,
  max_members integer,
  destination text,
  status text,
  required_by timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  creator_id uuid,
  orderer_id uuid,
  distance_meters numeric,
  member_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search_point extensions.geography;
BEGIN
  v_search_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude::float, p_latitude::float), 4326)::extensions.geography;

  RETURN QUERY
  SELECT 
    p.id as pool_id,
    p.platform,
    p.platform_other,
    p.minimum_order_value,
    p.current_total,
    p.max_members,
    p.destination,
    p.status,
    p.required_by,
    p.expires_at,
    p.created_at,
    p.creator_id,
    p.orderer_id,
    -- Calculate exact distance for sorting
    extensions.ST_Distance(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p.longitude::float, p.latitude::float), 4326)::extensions.geography,
      v_search_point
    )::numeric AS distance_meters,
    (SELECT COUNT(*) FROM public.pool_members pm WHERE pm.pool_id = p.id AND pm.commitment_status != 'withdrawn') as member_count
  FROM public.pools p
  WHERE 
    p.status = p_status
    AND (p_platform IS NULL OR p.platform = p_platform)
    AND p.expires_at > NOW()
    -- Use PostGIS spatial index for fast radius filtering
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p.longitude::float, p.latitude::float), 4326)::extensions.geography,
      v_search_point,
      p_radius_meters
    )
  ORDER BY distance_meters ASC, p.expires_at ASC;
END;
$$;

-- 4. Re-grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_receiving_location_atomic(uuid, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_pools(numeric, numeric, numeric, text, text) TO authenticated;
