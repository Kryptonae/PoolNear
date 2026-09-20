-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 14: Payment Rejection Flow (Functions)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create reject_payment_atomic
CREATE OR REPLACE FUNCTION public.reject_payment_atomic(p_member_id UUID)
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

  SELECT * INTO v_member FROM public.pool_members WHERE id = p_member_id;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;

  SELECT * INTO v_pool FROM public.pools WHERE id = v_member.pool_id;
  IF v_pool IS NULL THEN RAISE EXCEPTION 'Pool not found'; END IF;

  IF v_pool.orderer_id != v_user_id THEN
    RAISE EXCEPTION 'Only the orderer can reject payment';
  END IF;

  IF v_member.payment_status != 'sent' THEN
    RAISE EXCEPTION 'Payment is not in sent status';
  END IF;

  UPDATE public.pool_members
  SET payment_status = 'pending',
      payment_proof_url = NULL
  WHERE id = p_member_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_member.user_id, 
    'payment_rejected', 
    'Payment Rejected', 
    'Your payment has been rejected. Please make the payment again and click I''ve Paid.', 
    jsonb_build_object('pool_id', v_member.pool_id)
  );
END;
$$;

-- 2. Update confirm_payment_received_atomic to enforce authorization first
CREATE OR REPLACE FUNCTION public.confirm_payment_received_atomic(p_member_id UUID)
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

  SELECT * INTO v_member FROM public.pool_members WHERE id = p_member_id;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;

  SELECT * INTO v_pool FROM public.pools WHERE id = v_member.pool_id;
  IF v_pool IS NULL THEN RAISE EXCEPTION 'Pool not found'; END IF;

  IF v_pool.orderer_id != v_user_id THEN
    RAISE EXCEPTION 'Only the orderer can confirm payment';
  END IF;

  IF v_member.payment_status = 'confirmed' THEN RETURN; END IF;

  IF v_member.payment_status != 'sent' THEN
    RAISE EXCEPTION 'Payment is not in sent status';
  END IF;

  UPDATE public.pool_members
  SET payment_status = 'confirmed'
  WHERE id = p_member_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_member.user_id, 
    'payment_received', 
    'Payment Confirmed', 
    'The orderer confirmed your payment.', 
    jsonb_build_object('pool_id', v_member.pool_id)
  );
END;
$$;

-- 3. Grants and Security
GRANT EXECUTE ON FUNCTION public.reject_payment_atomic(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_payment_atomic(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.confirm_payment_received_atomic(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_payment_received_atomic(uuid) FROM PUBLIC;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
