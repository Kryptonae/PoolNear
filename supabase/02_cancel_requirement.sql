-- RUN THIS IN SUPABASE SQL EDITOR TO DEPLOY CANCEL REQUIREMENT RPC

CREATE OR REPLACE FUNCTION public.cancel_requirement_atomic(p_requirement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_req RECORD;
  v_pool RECORD;
  v_active_members INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM public.requirements WHERE id = p_requirement_id;
  IF v_req IS NULL THEN RAISE EXCEPTION 'Requirement not found'; END IF;
  IF v_req.user_id != v_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_req.status = 'cancelled' THEN RETURN; END IF;

  IF v_req.pool_id IS NOT NULL THEN
    SELECT * INTO v_pool FROM public.pools WHERE id = v_req.pool_id;
    IF v_pool.status NOT IN ('waiting', 'ready') THEN
      RAISE EXCEPTION 'Cannot cancel requirement after order process has started';
    END IF;

    -- Withdraw from pool
    UPDATE public.pool_members
    SET commitment_status = 'withdrawn'
    WHERE pool_id = v_pool.id AND user_id = v_user_id;

    -- Check if pool becomes empty
    SELECT COUNT(*) INTO v_active_members 
    FROM public.pool_members 
    WHERE pool_id = v_pool.id AND commitment_status != 'withdrawn';

    IF v_active_members = 0 AND v_pool.creator_id = v_user_id THEN
      UPDATE public.pools SET status = 'cancelled' WHERE id = v_pool.id;
    END IF;
  END IF;

  -- Cancel the requirement itself
  UPDATE public.requirements
  SET status = 'cancelled', pool_id = NULL
  WHERE id = p_requirement_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_requirement_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_requirement_atomic(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
