-- ====================================================================
-- PoolNear — Migration 22: Remove destination from pool_members
-- Fixes "column 'destination' of relation 'pool_members' does not exist"
-- ====================================================================

DROP FUNCTION IF EXISTS public.join_pool_atomic(UUID, JSONB, NUMERIC, TEXT, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.join_pool_atomic(
  p_pool_id UUID,
  p_items JSONB,
  p_contribution NUMERIC,
  p_destination TEXT DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pool_record RECORD;
  v_existing_member RECORD;
  v_member_count INTEGER;
  v_user_id UUID;
  v_item JSONB;
  v_server_total NUMERIC := 0;
  v_item_count INTEGER;
  v_remaining_required NUMERIC;
  v_membership_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF jsonb_typeof(p_items) != 'array' THEN RAISE EXCEPTION 'Items must be a valid JSON array'; END IF;
  
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN RAISE EXCEPTION 'Must provide between 1 and 20 items'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) != 'object' THEN RAISE EXCEPTION 'Each item must be a JSON object'; END IF;
    IF NOT (v_item ? 'name' AND v_item ? 'unit_price' AND v_item ? 'quantity') THEN RAISE EXCEPTION 'Each item must have name, unit_price, and quantity'; END IF;
    
    IF jsonb_typeof(v_item->'name') != 'string' OR length(trim(v_item->>'name')) = 0 OR length(v_item->>'name') > 100 THEN
      RAISE EXCEPTION 'Item name must be a non-empty string up to 100 characters';
    END IF;
    
    IF jsonb_typeof(v_item->'unit_price') != 'number' OR (v_item->>'unit_price')::NUMERIC <= 0 OR (v_item->>'unit_price')::NUMERIC > 1000000 THEN
      RAISE EXCEPTION 'Unit price must be a number greater than 0 and up to 1000000';
    END IF;
    
    IF round((v_item->>'unit_price')::NUMERIC, 2) != (v_item->>'unit_price')::NUMERIC THEN RAISE EXCEPTION 'Unit price cannot have more than 2 decimal places'; END IF;
    
    IF jsonb_typeof(v_item->'quantity') != 'number' OR (v_item->>'quantity')::NUMERIC % 1 != 0 OR (v_item->>'quantity')::NUMERIC < 1 OR (v_item->>'quantity')::NUMERIC > 1000 THEN
      RAISE EXCEPTION 'Quantity must be an integer between 1 and 1000';
    END IF;

    v_server_total := v_server_total + ((v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::NUMERIC);
  END LOOP;

  IF v_server_total <= 0 THEN RAISE EXCEPTION 'Total contribution must be greater than 0'; END IF;
  IF v_server_total > 99999999.99 THEN RAISE EXCEPTION 'Total order value is too large'; END IF;
  IF p_contribution IS NOT NULL AND p_contribution != v_server_total THEN RAISE EXCEPTION 'Server total does not match requested contribution'; END IF;

  SELECT * INTO v_pool_record FROM public.pools WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pool not found'; END IF;
  IF v_pool_record.status NOT IN ('waiting', 'ready') THEN RAISE EXCEPTION 'This pool is no longer accepting members'; END IF;
  IF v_pool_record.expires_at IS NOT NULL AND v_pool_record.expires_at <= NOW() THEN RAISE EXCEPTION 'This pool has expired'; END IF;

  SELECT * INTO v_existing_member FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = v_user_id;
  IF FOUND THEN
    IF v_existing_member.commitment_status != 'withdrawn' THEN
      RAISE EXCEPTION 'You are already in this pool';
    ELSE
      DELETE FROM public.pool_members WHERE id = v_existing_member.id;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_member_count FROM public.pool_members WHERE pool_id = p_pool_id AND commitment_status != 'withdrawn';
  IF v_member_count >= v_pool_record.max_members THEN RAISE EXCEPTION 'This pool is already full'; END IF;

  v_remaining_required := GREATEST(0, v_pool_record.minimum_order_value - COALESCE(v_pool_record.current_total, 0));
  IF (v_member_count + 1) >= v_pool_record.max_members THEN
    IF v_remaining_required > 0 AND v_server_total < v_remaining_required THEN
      RAISE EXCEPTION 'Final available spot — minimum % needed to reach % minimum order.', v_remaining_required, v_pool_record.minimum_order_value;
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.requirements (
      user_id, pool_id, product_description, amount, quantity,
      platform, platform_other, minimum_order_value,
      required_by, maximum_distance, latitude, longitude,
      destination, status, expires_at,
      brand, variant_size, notes, product_url
    ) VALUES (
      v_user_id, p_pool_id, trim(v_item->>'name'), 
      ((v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::INTEGER),
      (v_item->>'quantity')::INTEGER,
      v_pool_record.platform, v_pool_record.platform_other, v_pool_record.minimum_order_value,
      v_pool_record.required_by, 500, COALESCE(p_latitude, v_pool_record.latitude), COALESCE(p_longitude, v_pool_record.longitude),
      COALESCE(p_destination, v_pool_record.destination), 'matched', v_pool_record.expires_at,
      NULLIF(trim(v_item->>'brand'), ''),
      NULLIF(trim(v_item->>'variant_size'), ''),
      NULLIF(trim(v_item->>'notes'), ''),
      NULLIF(trim(v_item->>'product_url'), '')
    );
  END LOOP;

  -- FIXED: Removed destination column insertion from pool_members
  INSERT INTO public.pool_members (
    pool_id, user_id, requirement_id, contribution,
    commitment_status, payment_status, receipt_status
  ) VALUES (
    p_pool_id, v_user_id, NULL, v_server_total,
    'committed', 'pending', 'pending'
  ) RETURNING id INTO v_membership_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_pool_record.creator_id,
    'member_joined',
    'New Pool Member',
    'Someone joined your pool',
    jsonb_build_object('pool_id', p_pool_id, 'member_id', v_user_id)
  );

  RETURN v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_pool_atomic(UUID, JSONB, NUMERIC, TEXT, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_pool_atomic(UUID, JSONB, NUMERIC, TEXT, NUMERIC, NUMERIC) TO authenticated;

NOTIFY pgrst, 'reload schema';
