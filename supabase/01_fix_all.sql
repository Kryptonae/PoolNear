-- ==========================================
-- PoolNear Comprehensive Backend Fix
-- ==========================================
-- INSTRUCTIONS: Copy this entire file and run it 
-- in your Supabase SQL Editor.
-- ==========================================

-- 1. FIX MISSING PROFILES
-- Safely creates profiles for any existing users in auth.users
-- that somehow bypassed the signup trigger, preventing "Profile not found".
INSERT INTO public.profiles (id, name, email)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'name', 'User'), 
  email
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. RESOLVE RPC OVERLOADING CONFLICT
-- PostgREST panics if it sees multiple versions of the same function 
-- when the frontend passes empty filters. We must drop all old signatures.
DROP FUNCTION IF EXISTS public.get_nearby_pools(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, public.platform_type, public.pool_status);
DROP FUNCTION IF EXISTS public.get_nearby_pools(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_nearby_pools(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);

-- 3. CREATE DEFINITIVE GET_NEARBY_POOLS
-- This exact signature matches the updated frontend payload.
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
    AND p.expires_at > NOW()
    AND public.haversine_distance(user_lat, user_lon, p.latitude, p.longitude) <= radius_meters
    AND (filter_platform IS NULL OR filter_platform = '' OR p.platform::TEXT = filter_platform)
  ORDER BY
    public.haversine_distance(user_lat, user_lon, p.latitude, p.longitude) ASC,
    (p.minimum_order_value - p.current_total) ASC;
$$;

-- 4. SET EXACT PERMISSIONS
REVOKE EXECUTE ON FUNCTION public.get_nearby_pools(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_pools(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT) TO authenticated;

-- 5. FORCE POSTGREST SCHEMA CACHE RELOAD
-- This is critical. Without this, Supabase API will continue returning the cached error.
NOTIFY pgrst, 'reload schema';
