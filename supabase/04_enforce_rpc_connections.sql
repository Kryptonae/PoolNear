-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Enforce RPC for Connections
-- Drop the direct INSERT policy on connections so that connections
-- can ONLY be created via the secure request_connection_verified RPC.
-- RUN THIS IN SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════════════

-- Drop the old direct INSERT policy
DROP POLICY IF EXISTS "Users can create connections" ON public.connections;
