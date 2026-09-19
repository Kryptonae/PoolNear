-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 07: Connection Phone Visibility
-- Safely fetches connection details and includes the other user's phone
-- ONLY if the connection status is 'accepted'.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_pool_connections_with_phone(p_pool_id UUID)
RETURNS TABLE (
  id UUID,
  requester_id UUID,
  receiver_id UUID,
  pool_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  contact_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.id, c.requester_id, c.receiver_id, c.pool_id, c.status::TEXT, c.created_at, c.updated_at,
    CASE 
      WHEN c.status = 'accepted' THEN 
        (SELECT p.phone FROM public.profiles p WHERE p.id = CASE WHEN c.requester_id = v_user_id THEN c.receiver_id ELSE c.requester_id END)
      ELSE NULL
    END AS contact_phone
  FROM public.connections c
  WHERE c.pool_id = p_pool_id
    AND (c.requester_id = v_user_id OR c.receiver_id = v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_pool_connections_with_phone(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pool_connections_with_phone(UUID) TO authenticated;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
