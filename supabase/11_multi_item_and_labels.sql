-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 11: Multi-Item Orders & Lifecycle Fixes
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. DROP OLD RPC SIGNATURES ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.join_pool_atomic(UUID, NUMERIC, TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_pool_atomic(TEXT, NUMERIC, INTEGER, platform_type, TEXT, NUMERIC, TIMESTAMPTZ, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, TIMESTAMPTZ);

-- ─── 2. NEW CREATE POOL ATOMIC ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_pool_atomic(
  p_items JSONB,
  p_contribution NUMERIC,
  p_platform platform_type,
  p_platform_other TEXT DEFAULT NULL,
  p_minimum_order_value NUMERIC DEFAULT 99,
  p_required_by TIMESTAMPTZ DEFAULT NULL,
  p_maximum_distance INTEGER DEFAULT 500,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_destination TEXT DEFAULT NULL,
  p_max_members INTEGER DEFAULT 5,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pool_id UUID;
  v_user_id UUID;
  v_item JSONB;
  v_server_total NUMERIC := 0;
  v_item_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate Items Array
  IF jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'Items must be a valid JSON array';
  END IF;
  
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Must provide between 1 and 20 items';
  END IF;

  -- Validate Each Item & Compute Total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) != 'object' THEN
      RAISE EXCEPTION 'Each item must be a JSON object';
    END IF;
    
    IF NOT (v_item ? 'name' AND v_item ? 'unit_price' AND v_item ? 'quantity') THEN
      RAISE EXCEPTION 'Each item must have name, unit_price, and quantity';
    END IF;
    
    IF jsonb_typeof(v_item->'name') != 'string' OR length(trim(v_item->>'name')) = 0 OR length(v_item->>'name') > 100 THEN
      RAISE EXCEPTION 'Item name must be a non-empty string up to 100 characters';
    END IF;
    
    IF jsonb_typeof(v_item->'unit_price') != 'number' OR (v_item->>'unit_price')::NUMERIC <= 0 OR (v_item->>'unit_price')::NUMERIC > 1000000 THEN
      RAISE EXCEPTION 'Unit price must be a number greater than 0 and up to 1000000';
    END IF;
    
    IF round((v_item->>'unit_price')::NUMERIC, 2) != (v_item->>'unit_price')::NUMERIC THEN
      RAISE EXCEPTION 'Unit price cannot have more than 2 decimal places';
    END IF;
    
    IF jsonb_typeof(v_item->'quantity') != 'number' OR (v_item->>'quantity')::NUMERIC % 1 != 0 OR (v_item->>'quantity')::NUMERIC < 1 OR (v_item->>'quantity')::NUMERIC > 1000 THEN
      RAISE EXCEPTION 'Quantity must be an integer between 1 and 1000';
    END IF;

    v_server_total := v_server_total + ((v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::NUMERIC);
  END LOOP;

  IF v_server_total <= 0 THEN
    RAISE EXCEPTION 'Total contribution must be greater than 0';
  END IF;

  IF v_server_total > 99999999.99 THEN
    RAISE EXCEPTION 'Total order value is too large';
  END IF;

  IF p_contribution IS NOT NULL AND p_contribution != v_server_total THEN
    RAISE EXCEPTION 'Server total does not match requested contribution';
  END IF;

  -- Create pool
  INSERT INTO public.pools (
    creator_id, platform, platform_other, minimum_order_value,
    current_total, max_members, destination, latitude, longitude,
    status, required_by, expires_at
  ) VALUES (
    v_user_id, p_platform, p_platform_other, p_minimum_order_value,
    0, p_max_members, p_destination, p_latitude, p_longitude,
    'waiting', p_required_by, p_expires_at
  ) RETURNING id INTO v_pool_id;

  -- Create requirements
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.requirements (
      user_id, pool_id, product_description, amount, quantity,
      platform, platform_other, minimum_order_value,
      required_by, maximum_distance, latitude, longitude,
      destination, status, expires_at
    ) VALUES (
      v_user_id, v_pool_id, trim(v_item->>'name'), 
      ((v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::INTEGER), -- AMOUNT IS ALWAYS LINE TOTAL
      (v_item->>'quantity')::INTEGER,
      p_platform, p_platform_other, p_minimum_order_value,
      p_required_by, p_maximum_distance, p_latitude, p_longitude,
      p_destination, 'matched', p_expires_at
    );
  END LOOP;

  -- Add creator as first member (requirement_id = NULL for multi-item)
  INSERT INTO public.pool_members (
    pool_id, user_id, requirement_id, contribution,
    commitment_status, payment_status, receipt_status
  ) VALUES (
    v_pool_id, v_user_id, NULL, v_server_total,
    'committed', 'pending', 'pending'
  );

  RETURN v_pool_id;
END;
$$;

-- ─── 3. NEW JOIN POOL ATOMIC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_pool_atomic(
  p_pool_id UUID,
  p_items JSONB,
  p_contribution NUMERIC
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

  -- Validate Items Array
  IF jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'Items must be a valid JSON array';
  END IF;
  
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Must provide between 1 and 20 items';
  END IF;

  -- Validate Each Item & Compute Total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) != 'object' THEN
      RAISE EXCEPTION 'Each item must be a JSON object';
    END IF;
    
    IF NOT (v_item ? 'name' AND v_item ? 'unit_price' AND v_item ? 'quantity') THEN
      RAISE EXCEPTION 'Each item must have name, unit_price, and quantity';
    END IF;
    
    IF jsonb_typeof(v_item->'name') != 'string' OR length(trim(v_item->>'name')) = 0 OR length(v_item->>'name') > 100 THEN
      RAISE EXCEPTION 'Item name must be a non-empty string up to 100 characters';
    END IF;
    
    IF jsonb_typeof(v_item->'unit_price') != 'number' OR (v_item->>'unit_price')::NUMERIC <= 0 OR (v_item->>'unit_price')::NUMERIC > 1000000 THEN
      RAISE EXCEPTION 'Unit price must be a number greater than 0 and up to 1000000';
    END IF;
    
    IF round((v_item->>'unit_price')::NUMERIC, 2) != (v_item->>'unit_price')::NUMERIC THEN
      RAISE EXCEPTION 'Unit price cannot have more than 2 decimal places';
    END IF;
    
    IF jsonb_typeof(v_item->'quantity') != 'number' OR (v_item->>'quantity')::NUMERIC % 1 != 0 OR (v_item->>'quantity')::NUMERIC < 1 OR (v_item->>'quantity')::NUMERIC > 1000 THEN
      RAISE EXCEPTION 'Quantity must be an integer between 1 and 1000';
    END IF;

    v_server_total := v_server_total + ((v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::NUMERIC);
  END LOOP;

  IF v_server_total <= 0 THEN
    RAISE EXCEPTION 'Total contribution must be greater than 0';
  END IF;

  IF v_server_total > 99999999.99 THEN
    RAISE EXCEPTION 'Total order value is too large';
  END IF;

  IF p_contribution IS NOT NULL AND p_contribution != v_server_total THEN
    RAISE EXCEPTION 'Server total does not match requested contribution';
  END IF;

  -- Lock pool row FOR UPDATE
  SELECT * INTO v_pool_record
  FROM public.pools
  WHERE id = p_pool_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pool not found'; END IF;

  IF v_pool_record.status NOT IN ('waiting', 'ready') THEN
    RAISE EXCEPTION 'This pool is no longer accepting members';
  END IF;

  IF v_pool_record.expires_at IS NOT NULL AND v_pool_record.expires_at <= NOW() THEN
    RAISE EXCEPTION 'This pool has expired';
  END IF;

  -- Check existing membership
  SELECT * INTO v_existing_member
  FROM public.pool_members
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  IF FOUND THEN
    IF v_existing_member.commitment_status != 'withdrawn' THEN
      RAISE EXCEPTION 'You are already in this pool';
    ELSE
      -- Clean up stale withdrawn row to allow fresh rejoin
      DELETE FROM public.pool_members WHERE id = v_existing_member.id;
    END IF;
  END IF;

  -- Check capacity (count only active members)
  SELECT COUNT(*) INTO v_member_count
  FROM public.pool_members
  WHERE pool_id = p_pool_id AND commitment_status != 'withdrawn';

  IF v_member_count >= v_pool_record.max_members THEN
    RAISE EXCEPTION 'This pool is already full';
  END IF;

  -- Check minimum order gap
  v_remaining_required := GREATEST(0, v_pool_record.minimum_order_value - COALESCE(v_pool_record.current_total, 0));
  
  -- If there's a gap, the new contribution MUST be at least that gap
  IF v_remaining_required > 0 AND v_server_total < v_remaining_required THEN
    RAISE EXCEPTION 'Your contribution of % is not enough. % is still required to reach the minimum order of %.',
      v_server_total, v_remaining_required, v_pool_record.minimum_order_value;
  END IF;

  -- Insert Requirements
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.requirements (
      user_id, pool_id, product_description, amount, quantity,
      platform, platform_other, minimum_order_value,
      required_by, maximum_distance, latitude, longitude,
      destination, status, expires_at
    ) VALUES (
      v_user_id, p_pool_id, trim(v_item->>'name'), 
      ((v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::INTEGER), -- AMOUNT IS ALWAYS LINE TOTAL
      (v_item->>'quantity')::INTEGER,
      v_pool_record.platform, v_pool_record.platform_other, v_pool_record.minimum_order_value,
      v_pool_record.required_by, 500, v_pool_record.latitude, v_pool_record.longitude,
      v_pool_record.destination, 'matched', v_pool_record.expires_at
    );
  END LOOP;

  -- Insert Membership (requirement_id = NULL)
  INSERT INTO public.pool_members (
    pool_id, user_id, requirement_id, contribution,
    commitment_status, payment_status, receipt_status
  ) VALUES (
    p_pool_id, v_user_id, NULL, v_server_total,
    'committed', 'pending', 'pending'
  ) RETURNING id INTO v_membership_id;

  -- Notify pool creator about new member
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_pool_record.creator_id,
    'member_joined',
    'New member joined!',
    'Someone joined your pool on ' || v_pool_record.platform::TEXT || '.',
    jsonb_build_object('pool_id', p_pool_id)
  );

  RETURN v_membership_id;
END;
$$;

-- ─── 4. UPDATE LEAVE POOL ATOMIC ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_pool_atomic(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.pool_members
  SET commitment_status = 'withdrawn'
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  -- Cancel requirements instead of returning to active. Keep pool_id for history.
  UPDATE public.requirements
  SET status = 'cancelled'
  WHERE pool_id = p_pool_id AND user_id = v_user_id;
END;
$$;

-- ─── 5. UPDATE CANCEL REQUIREMENT ATOMIC ─────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_requirement_atomic(p_requirement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_req RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM public.requirements WHERE id = p_requirement_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requirement not found';
  END IF;

  IF v_req.user_id != v_user_id THEN
    RAISE EXCEPTION 'Not authorized to cancel this requirement';
  END IF;

  -- Only allow cancelling standalone requirements
  IF v_req.pool_id IS NOT NULL THEN
    RAISE EXCEPTION 'This requirement is linked to a group order. Please leave the group order instead.';
  END IF;

  UPDATE public.requirements
  SET status = 'cancelled'
  WHERE id = p_requirement_id;
END;
$$;

-- ─── 6. SECURITY & GRANTS ────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_pool_atomic(JSONB, NUMERIC, platform_type, TEXT, NUMERIC, TIMESTAMPTZ, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pool_atomic(JSONB, NUMERIC, platform_type, TEXT, NUMERIC, TIMESTAMPTZ, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.join_pool_atomic(UUID, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_pool_atomic(UUID, JSONB, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.leave_pool_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_pool_atomic(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_requirement_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_requirement_atomic(UUID) TO authenticated;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
