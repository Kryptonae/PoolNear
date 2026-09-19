-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 09: Hide Terminal Pools from Active Discovery
-- Fixes issue where completed pools remain visible until expires_at
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create or replace the function to strictly filter terminal statuses
CREATE OR REPLACE FUNCTION public.get_nearby_pools(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 500,
  filter_platform TEXT DEFAULT '',
  filter_status TEXT DEFAULT ''
) RETURNS TABLE (
  pool_id UUID,
  platform public.platform_type,
  platform_other TEXT,
  minimum_order_value NUMERIC,
  current_total NUMERIC,
  max_members INTEGER,
  destination TEXT,
  status public.pool_status,
  required_by TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  creator_id UUID,
  orderer_id UUID,
  distance_meters DOUBLE PRECISION,
  member_count BIGINT
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    p.id AS pool_id,
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
    public.haversine_distance(user_lat, user_lon, p.latitude, p.longitude) AS distance_meters,
    (SELECT COUNT(*) FROM public.pool_members pm WHERE pm.pool_id = p.id AND pm.commitment_status != 'withdrawn') AS member_count
  FROM public.pools p
  WHERE (filter_status IS NULL OR filter_status = '' OR p.status::TEXT = filter_status)
    -- HIDE TERMINAL POOLS IMMEDIATELY regardless of expires_at
    AND p.status NOT IN ('completed', 'failed', 'expired', 'cancelled', 'delivered')
    -- HIDE EXPIRED POOLS
    AND p.expires_at > NOW()
    AND public.haversine_distance(user_lat, user_lon, p.latitude, p.longitude) <= radius_meters
    AND (filter_platform IS NULL OR filter_platform = '' OR p.platform::TEXT = filter_platform)
  ORDER BY
    public.haversine_distance(user_lat, user_lon, p.latitude, p.longitude) ASC,
    (p.minimum_order_value - p.current_total) ASC;
$$;

-- 2. Force PostgREST to reload its cache so the API recognizes the fix immediately
NOTIFY pgrst, 'reload schema';
