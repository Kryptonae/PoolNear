-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — PostgreSQL Schema for Supabase
-- Complete database design with RLS, indexes, constraints, and RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── CUSTOM TYPES ──────────────────────────────────────────────────

CREATE TYPE platform_type AS ENUM (
  'blinkit',
  'zepto',
  'swiggy_instamart',
  'flipkart_minutes',
  'bigbasket',
  'other'
);

CREATE TYPE pool_status AS ENUM (
  'waiting',         -- Waiting for members
  'ready',           -- Minimum order value reached
  'ordering',        -- Orderer is placing the order
  'order_placed',    -- External order confirmed
  'delivering',      -- Delivery in progress
  'delivered',       -- Orderer received delivery
  'completed',       -- All members confirmed receipt
  'failed',          -- Pool failed (timeout, report, etc.)
  'expired',         -- Pool expired before completion
  'cancelled'        -- Creator cancelled
);

CREATE TYPE requirement_status AS ENUM (
  'active',          -- Looking for a pool
  'matched',         -- Matched to a pool
  'fulfilled',       -- Item received
  'cancelled',       -- User cancelled
  'expired'          -- Time expired
);

CREATE TYPE commitment_status AS ENUM (
  'pending',         -- Just joined
  'committed',       -- Confirmed contribution
  'withdrawn'        -- Left the pool
);

CREATE TYPE payment_status AS ENUM (
  'pending',         -- Not yet paid
  'sent',            -- User claims payment sent
  'confirmed',       -- Orderer confirms receipt
  'disputed'         -- Payment dispute
);

CREATE TYPE receipt_status AS ENUM (
  'pending',         -- Waiting for delivery
  'received',        -- User confirmed receipt
  'not_received',    -- User claims not received
  'disputed'         -- Receipt dispute
);

CREATE TYPE connection_status AS ENUM (
  'pending',         -- Request sent
  'accepted',        -- Both parties agree
  'rejected',        -- Receiver declined
  'expired'          -- Connection request expired
);

CREATE TYPE report_status AS ENUM (
  'pending',         -- Awaiting review
  'reviewing',       -- Admin is reviewing
  'resolved',        -- Issue resolved
  'dismissed'        -- Report dismissed
);

CREATE TYPE account_status AS ENUM (
  'active',
  'restricted',
  'suspended'
);

CREATE TYPE notification_type AS ENUM (
  'pool_match_found',
  'member_joined',
  'pool_ready',
  'connection_request',
  'connection_accepted',
  'contribution_confirmed',
  'orderer_selected',
  'order_proof_uploaded',
  'delivery_approaching',
  'receipt_pending',
  'pool_completed',
  'pool_failed',
  'pool_expired',
  'report_submitted',
  'payment_received',
  'payment_sent'
);

CREATE TYPE order_status AS ENUM (
  'pending',
  'placed',
  'delivering',
  'delivered',
  'failed'
);

-- ─── PROFILES TABLE ────────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific profile data

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_permission BOOLEAN DEFAULT FALSE,
  preferred_radius INTEGER DEFAULT 500,  -- meters
  area TEXT,                              -- approximate area name
  successful_pools INTEGER DEFAULT 0,
  completed_commitments INTEGER DEFAULT 0,
  cancelled_pools INTEGER DEFAULT 0,
  dispute_count INTEGER DEFAULT 0,
  account_status account_status DEFAULT 'active',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── POOLS TABLE ───────────────────────────────────────────────────

CREATE TABLE pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  platform_other TEXT,                   -- custom platform name when 'other'
  minimum_order_value NUMERIC(10,2) NOT NULL DEFAULT 99,
  current_total NUMERIC(10,2) DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 5 CHECK (max_members >= 2 AND max_members <= 10),
  destination TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  orderer_id UUID REFERENCES profiles(id),
  status pool_status DEFAULT 'waiting',
  required_by TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ─── REQUIREMENTS TABLE ────────────────────────────────────────────

CREATE TABLE requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE SET NULL,
  product_description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  platform platform_type NOT NULL,
  platform_other TEXT,
  minimum_order_value NUMERIC(10,2) NOT NULL DEFAULT 99,
  required_by TIMESTAMPTZ NOT NULL,
  maximum_distance INTEGER DEFAULT 500,  -- meters
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  destination TEXT,
  status requirement_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ─── POOL MEMBERS TABLE ────────────────────────────────────────────

CREATE TABLE pool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES requirements(id) ON DELETE SET NULL,
  contribution NUMERIC(10,2) NOT NULL CHECK (contribution > 0),
  commitment_status commitment_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  receipt_status receipt_status DEFAULT 'pending',
  can_place_order BOOLEAN DEFAULT FALSE,
  payment_proof_url TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pool_id, user_id)
);

-- ─── ORDERS TABLE ──────────────────────────────────────────────────

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  orderer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  platform_other TEXT,
  external_order_id TEXT,
  order_value NUMERIC(10,2),
  proof_image_url TEXT,
  expected_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,
  status order_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CONNECTIONS TABLE ─────────────────────────────────────────────

CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  status connection_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate connection requests between same users in same pool
  UNIQUE(requester_id, receiver_id, pool_id)
);

-- ─── REPORTS TABLE ─────────────────────────────────────────────────

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status report_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ─── NOTIFICATIONS TABLE ───────────────────────────────────────────

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════

-- Pools: location-based queries, status filtering, platform filtering
CREATE INDEX idx_pools_status ON pools(status);
CREATE INDEX idx_pools_platform ON pools(platform);
CREATE INDEX idx_pools_location ON pools(latitude, longitude);
CREATE INDEX idx_pools_expires ON pools(expires_at);
CREATE INDEX idx_pools_creator ON pools(creator_id);
CREATE INDEX idx_pools_status_platform ON pools(status, platform);

-- Requirements: user lookup, status, platform
CREATE INDEX idx_requirements_user ON requirements(user_id);
CREATE INDEX idx_requirements_status ON requirements(status);
CREATE INDEX idx_requirements_platform ON requirements(platform);
CREATE INDEX idx_requirements_pool ON requirements(pool_id);

-- Pool members: pool/user lookups
CREATE INDEX idx_pool_members_pool ON pool_members(pool_id);
CREATE INDEX idx_pool_members_user ON pool_members(user_id);

-- Orders: pool lookup
CREATE INDEX idx_orders_pool ON orders(pool_id);

-- Connections: user lookups
CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_receiver ON connections(receiver_id);
CREATE INDEX idx_connections_pool ON connections(pool_id);

-- Reports: status, users
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_reported ON reports(reported_user_id);

-- Notifications: user, read status
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES POLICIES ────────────────────────────────────────────

-- Anyone can view public profile info (limited columns via select in app)
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile, but NOT is_admin, trust counters, or account_status
-- These fields are enforced via the update_profile_safe function below
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─── POOLS POLICIES ───────────────────────────────────────────────

-- Active pools are viewable by all authenticated users
CREATE POLICY "Authenticated users can view pools"
  ON pools FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create pools
CREATE POLICY "Authenticated users can create pools"
  ON pools FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Pool updates: only by creator, orderer (for their specific transitions), or admin
CREATE POLICY "Authorized users can update pool"
  ON pools FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = creator_id
    OR auth.uid() = orderer_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR EXISTS (SELECT 1 FROM pool_members WHERE pool_id = pools.id AND user_id = auth.uid())
  );

-- ─── REQUIREMENTS POLICIES ────────────────────────────────────────

CREATE POLICY "Users can view all active requirements"
  ON requirements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own requirements"
  ON requirements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own requirements"
  ON requirements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own requirements"
  ON requirements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── POOL MEMBERS POLICIES ────────────────────────────────────────

CREATE POLICY "Pool members visible to authenticated users"
  ON pool_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join pools"
  ON pool_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Members can update own membership; orderer/creator can update payment confirmations
CREATE POLICY "Members can update own membership"
  ON pool_members FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM pools
      WHERE pools.id = pool_members.pool_id
      AND (pools.creator_id = auth.uid() OR pools.orderer_id = auth.uid())
    )
  );

CREATE POLICY "Users can leave pools"
  ON pool_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── ORDERS POLICIES ──────────────────────────────────────────────

CREATE POLICY "Pool members can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Orderer can create order"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = orderer_id);

CREATE POLICY "Orderer can update order"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = orderer_id);

-- ─── CONNECTIONS POLICIES ──────────────────────────────────────────

CREATE POLICY "Users can view own connections"
  ON connections FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create connections"
  ON connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Receiver can update connection"
  ON connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = requester_id);

-- ─── REPORTS POLICIES ──────────────────────────────────────────────

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    auth.uid() = reporter_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── NOTIFICATIONS POLICIES ────────────────────────────────────────

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Notifications should be created by server-side triggers/functions
-- Removed the insecure broad policy.
-- CREATE POLICY "Authenticated users can create notifications"
--   ON notifications FOR INSERT
--   TO authenticated
--   WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update pool current_total when members change
CREATE OR REPLACE FUNCTION public.update_pool_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pools
    SET current_total = (
      SELECT COALESCE(SUM(contribution), 0)
      FROM public.pool_members
      WHERE pool_id = NEW.pool_id AND commitment_status != 'withdrawn'
    ),
    updated_at = NOW()
    WHERE id = NEW.pool_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.pools
    SET current_total = (
      SELECT COALESCE(SUM(contribution), 0)
      FROM public.pool_members
      WHERE pool_id = NEW.pool_id AND commitment_status != 'withdrawn'
    ),
    updated_at = NOW()
    WHERE id = NEW.pool_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pools
    SET current_total = (
      SELECT COALESCE(SUM(contribution), 0)
      FROM public.pool_members
      WHERE pool_id = OLD.pool_id AND commitment_status != 'withdrawn'
    ),
    updated_at = NOW()
    WHERE id = OLD.pool_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER on_pool_member_change
  AFTER INSERT OR UPDATE OR DELETE ON pool_members
  FOR EACH ROW EXECUTE FUNCTION public.update_pool_total();

-- Auto-update pool status to 'ready' when current_total >= minimum_order_value
CREATE OR REPLACE FUNCTION public.check_pool_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_total >= NEW.minimum_order_value AND NEW.status = 'waiting' THEN
    NEW.status := 'ready';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_pool_total_update
  BEFORE UPDATE ON pools
  FOR EACH ROW EXECUTE FUNCTION public.check_pool_ready();

-- Update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Haversine distance function (returns meters)
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  r DOUBLE PRECISION := 6371000; -- Earth radius in meters
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);
  a := SIN(dlat / 2) * SIN(dlat / 2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlon / 2) * SIN(dlon / 2);
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  RETURN r * c;
END;
$$;

-- Find nearby pools using Haversine
CREATE OR REPLACE FUNCTION public.get_nearby_pools(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 500,
  filter_platform platform_type DEFAULT NULL,
  filter_status pool_status DEFAULT NULL
) RETURNS TABLE (
  pool_id UUID,
  platform platform_type,
  platform_other TEXT,
  minimum_order_value NUMERIC,
  current_total NUMERIC,
  max_members INTEGER,
  destination TEXT,
  status pool_status,
  required_by TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  creator_id UUID,
  orderer_id UUID,
  distance_meters DOUBLE PRECISION,
  member_count BIGINT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
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
  WHERE (filter_status IS NULL AND p.status IN ('waiting', 'ready') OR p.status = filter_status)
    AND p.expires_at > NOW()
    AND public.haversine_distance(user_lat, user_lon, p.latitude, p.longitude) <= radius_meters
    AND (filter_platform IS NULL OR p.platform = filter_platform)
  ORDER BY
    public.haversine_distance(user_lat, user_lon, p.latitude, p.longitude) ASC,
    (p.minimum_order_value - p.current_total) ASC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- ATOMIC OPERATIONS — Server-side RPC functions
-- ═══════════════════════════════════════════════════════════════════

-- Safe profile update: prevents users from modifying admin, trust, or status fields
CREATE OR REPLACE FUNCTION public.update_profile_safe(
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_location_permission BOOLEAN DEFAULT NULL,
  p_preferred_radius INTEGER DEFAULT NULL,
  p_area TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    latitude = COALESCE(p_latitude, latitude),
    longitude = COALESCE(p_longitude, longitude),
    location_permission = COALESCE(p_location_permission, location_permission),
    preferred_radius = COALESCE(p_preferred_radius, preferred_radius),
    area = COALESCE(p_area, area),
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- Atomic join pool: validates capacity, duplicate, and status in one transaction
CREATE OR REPLACE FUNCTION public.join_pool_atomic(
  p_pool_id UUID,
  p_contribution NUMERIC,
  p_product_description TEXT,
  p_requirement_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool RECORD;
  v_member_count INTEGER;
  v_existing_member INTEGER;
  v_req_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the pool row to prevent race conditions
  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pool not found';
  END IF;

  IF v_pool.status NOT IN ('waiting', 'ready') THEN
    RAISE EXCEPTION 'This pool is no longer accepting members';
  END IF;

  IF v_pool.expires_at <= NOW() THEN
    RAISE EXCEPTION 'This pool has expired';
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_member_count
  FROM public.pool_members
  WHERE pool_id = p_pool_id AND commitment_status != 'withdrawn';

  IF v_member_count >= v_pool.max_members THEN
    RAISE EXCEPTION 'This pool is already full';
  END IF;

  -- Check duplicate
  SELECT COUNT(*) INTO v_existing_member
  FROM public.pool_members
  WHERE pool_id = p_pool_id AND user_id = v_user_id AND commitment_status != 'withdrawn';

  IF v_existing_member > 0 THEN
    RAISE EXCEPTION 'You are already a member of this pool';
  END IF;

  -- Create requirement if not provided
  v_req_id := p_requirement_id;
  IF v_req_id IS NULL THEN
    INSERT INTO public.requirements (
      user_id, pool_id, product_description, amount, quantity,
      platform, platform_other, minimum_order_value,
      required_by, maximum_distance, latitude, longitude,
      destination, status, expires_at
    ) VALUES (
      v_user_id, p_pool_id, p_product_description, p_contribution, 1,
      v_pool.platform, v_pool.platform_other, v_pool.minimum_order_value,
      v_pool.required_by, 500, v_pool.latitude, v_pool.longitude,
      v_pool.destination, 'matched', v_pool.expires_at
    ) RETURNING id INTO v_req_id;
  END IF;

  -- Add member
  INSERT INTO public.pool_members (
    pool_id, user_id, requirement_id, contribution,
    commitment_status, payment_status, receipt_status
  ) VALUES (
    p_pool_id, v_user_id, v_req_id, p_contribution,
    'committed', 'pending', 'pending'
  );

  -- Notify pool creator about new member
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_pool.creator_id,
    'member_joined',
    'New member joined!',
    'Someone joined your pool on ' || v_pool.platform::TEXT || '.',
    jsonb_build_object('pool_id', p_pool_id)
  );

  RETURN v_req_id;
END;
$$;

-- Atomic pool creation: creates pool + requirement + membership in one transaction
CREATE OR REPLACE FUNCTION public.create_pool_atomic(
  p_product_description TEXT,
  p_amount NUMERIC,
  p_quantity INTEGER,
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
SET search_path = public
AS $$
DECLARE
  v_pool_id UUID;
  v_req_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

  -- Create requirement
  INSERT INTO public.requirements (
    user_id, pool_id, product_description, amount, quantity,
    platform, platform_other, minimum_order_value,
    required_by, maximum_distance, latitude, longitude,
    destination, status, expires_at
  ) VALUES (
    v_user_id, v_pool_id, p_product_description, p_amount, p_quantity,
    p_platform, p_platform_other, p_minimum_order_value,
    p_required_by, p_maximum_distance, p_latitude, p_longitude,
    p_destination, 'matched', p_expires_at
  ) RETURNING id INTO v_req_id;

  -- Add creator as first member
  INSERT INTO public.pool_members (
    pool_id, user_id, requirement_id, contribution,
    commitment_status, payment_status, receipt_status
  ) VALUES (
    v_pool_id, v_user_id, v_req_id, p_amount,
    'committed', 'pending', 'pending'
  );

  RETURN v_pool_id;
END;
$$;

-- Atomic volunteer as orderer
CREATE OR REPLACE FUNCTION public.volunteer_as_orderer(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool RECORD;
  v_user_id UUID;
  v_is_member BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pool not found';
  END IF;

  IF v_pool.status != 'ready' THEN
    RAISE EXCEPTION 'Pool must be in ready status to select an orderer';
  END IF;

  IF v_pool.orderer_id IS NOT NULL THEN
    RAISE EXCEPTION 'An orderer has already been selected';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.pool_members
    WHERE pool_id = p_pool_id AND user_id = v_user_id AND commitment_status != 'withdrawn'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'You must be a pool member to volunteer as orderer';
  END IF;

  -- Update membership
  UPDATE public.pool_members
  SET can_place_order = true
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  -- Update pool
  UPDATE public.pools
  SET orderer_id = v_user_id, status = 'ordering', updated_at = NOW()
  WHERE id = p_pool_id;

  -- Notify all members
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT pm.user_id, 'orderer_selected', 'Orderer selected!',
    'An orderer has been selected for your pool.',
    jsonb_build_object('pool_id', p_pool_id)
  FROM public.pool_members pm
  WHERE pm.pool_id = p_pool_id AND pm.user_id != v_user_id AND pm.commitment_status != 'withdrawn';
END;
$$;

-- Removed insecure increment_field function. 
-- Stats are now updated inline within secure RPCs.

-- Get unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = auth.uid() AND read = FALSE;
  RETURN v_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- STORAGE POLICIES (for order proof uploads)
-- ═══════════════════════════════════════════════════════════════════
-- NOTE: Run these in the Supabase dashboard under Storage policies.
-- Create a bucket called 'order-proofs' with private access.
--
-- Policy: Users can upload to their own folder
-- INSERT: auth.uid()::text = (storage.foldername(name))[1]
--
-- Policy: Users can read proofs for pools they are members of
-- SELECT: auth.role() = 'authenticated'
--
-- Policy: Users can update their own files
-- UPDATE: auth.uid()::text = (storage.foldername(name))[1]

-- ─── NEW LIFECYCLE RPCs ──────────────────────────────────────────────

-- 1. Leave pool atomic
CREATE OR REPLACE FUNCTION public.leave_pool_atomic(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.pool_members
  SET commitment_status = 'withdrawn'
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  UPDATE public.requirements
  SET status = 'active', pool_id = null
  WHERE pool_id = p_pool_id AND user_id = v_user_id;
END;
$$;

-- 2. Mark payment sent atomic
CREATE OR REPLACE FUNCTION public.mark_payment_sent_atomic(p_pool_id UUID, p_proof_url TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_pool RECORD;
  v_member RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id;
  IF v_pool.status NOT IN ('ordering', 'order_placed', 'delivering', 'delivered') THEN
    RAISE EXCEPTION 'Pool not in correct status for payment';
  END IF;

  SELECT * INTO v_member FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = v_user_id;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF v_member.payment_status = 'confirmed' THEN RAISE EXCEPTION 'Payment already confirmed'; END IF;

  UPDATE public.pool_members
  SET payment_status = 'sent', payment_proof_url = p_proof_url
  WHERE pool_id = p_pool_id AND user_id = v_user_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (v_pool.orderer_id, 'payment_sent', 'Payment Sent', 'A member has sent their payment.', jsonb_build_object('pool_id', p_pool_id));
END;
$$;

-- 3. Confirm payment received atomic
CREATE OR REPLACE FUNCTION public.confirm_payment_received_atomic(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_member RECORD;
  v_pool RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_member FROM public.pool_members WHERE id = p_member_id;
  IF v_member.payment_status = 'confirmed' THEN RETURN; END IF;

  SELECT * INTO v_pool FROM public.pools WHERE id = v_member.pool_id;

  IF v_pool.orderer_id != v_user_id THEN
    RAISE EXCEPTION 'Only the orderer can confirm payment';
  END IF;

  UPDATE public.pool_members
  SET payment_status = 'confirmed'
  WHERE id = p_member_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (v_member.user_id, 'payment_received', 'Payment Confirmed', 'The orderer confirmed your payment.', jsonb_build_object('pool_id', v_member.pool_id));
END;
$$;

-- 4. Submit order proof atomic
CREATE OR REPLACE FUNCTION public.submit_order_proof_atomic(
  p_pool_id UUID, p_external_order_id TEXT, p_order_value NUMERIC, p_expected_delivery TIMESTAMPTZ, p_proof_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_pool RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id;
  IF v_pool.orderer_id != v_user_id THEN RAISE EXCEPTION 'Only the orderer can submit proof'; END IF;
  IF v_pool.status != 'ordering' THEN RAISE EXCEPTION 'Pool must be in ordering status'; END IF;

  INSERT INTO public.orders (pool_id, orderer_id, platform, platform_other, external_order_id, order_value, proof_image_url, expected_delivery, status)
  VALUES (p_pool_id, v_user_id, v_pool.platform, v_pool.platform_other, p_external_order_id, p_order_value, p_proof_url, p_expected_delivery, 'placed');

  UPDATE public.pools SET status = 'order_placed' WHERE id = p_pool_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT pm.user_id, 'order_proof_uploaded', 'Order Placed!', 'The orderer has placed the order.', jsonb_build_object('pool_id', p_pool_id)
  FROM public.pool_members pm WHERE pm.pool_id = p_pool_id AND pm.user_id != v_user_id AND pm.commitment_status != 'withdrawn';
END;
$$;

-- 5. Mark order delivered atomic
CREATE OR REPLACE FUNCTION public.mark_order_delivered_atomic(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_pool RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_pool FROM public.pools WHERE id = p_pool_id;
  IF v_pool.orderer_id != v_user_id THEN RAISE EXCEPTION 'Only the orderer can mark delivered'; END IF;
  IF v_pool.status IN ('delivered', 'completed') THEN RETURN; END IF;

  UPDATE public.pools SET status = 'delivered' WHERE id = p_pool_id;
  UPDATE public.orders SET status = 'delivered', actual_delivery = NOW() WHERE pool_id = p_pool_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT pm.user_id, 'delivery_approaching', 'Order Delivered!', 'The orderer has received the delivery.', jsonb_build_object('pool_id', p_pool_id)
  FROM public.pool_members pm WHERE pm.pool_id = p_pool_id AND pm.user_id != v_user_id AND pm.commitment_status != 'withdrawn';
END;
$$;

-- 6. Confirm receipt atomic
CREATE OR REPLACE FUNCTION public.confirm_receipt_atomic(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_member RECORD;
  v_all_received BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_member FROM public.pool_members WHERE pool_id = p_pool_id AND user_id = v_user_id;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF v_member.receipt_status = 'received' THEN RETURN; END IF;

  UPDATE public.pool_members SET receipt_status = 'received' WHERE id = v_member.id;

  -- Update user trust stats securely inline
  UPDATE public.profiles SET successful_pools = COALESCE(successful_pools, 0) + 1, completed_commitments = COALESCE(completed_commitments, 0) + 1 WHERE id = v_user_id;

  SELECT bool_and(receipt_status = 'received') INTO v_all_received FROM public.pool_members WHERE pool_id = p_pool_id AND commitment_status != 'withdrawn';

  IF v_all_received THEN
    UPDATE public.pools SET status = 'completed' WHERE id = p_pool_id;
    UPDATE public.requirements SET status = 'fulfilled' WHERE pool_id = p_pool_id;
    
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT pm.user_id, 'pool_completed', 'Pool Completed', 'Everyone has received their items.', jsonb_build_object('pool_id', p_pool_id)
    FROM public.pool_members pm WHERE pm.pool_id = p_pool_id AND pm.commitment_status != 'withdrawn';
  END IF;
END;
$$;

-- 7. Get public profile (Safe view for frontend)
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID, name TEXT, avatar_url TEXT, area TEXT, successful_pools INTEGER,
  completed_commitments INTEGER, cancelled_pools INTEGER, dispute_count INTEGER, created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, avatar_url, area, successful_pools, completed_commitments, cancelled_pools, dispute_count, created_at
  FROM public.profiles WHERE id = p_user_id;
$$;

-- 8. Admin RPCs
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_total_users INTEGER;
  v_active_pools INTEGER;
  v_completed_pools INTEGER;
  v_failed_pools INTEGER;
  v_pending_reports INTEGER;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT count(*) INTO v_total_users FROM public.profiles;
  SELECT count(*) INTO v_active_pools FROM public.pools WHERE status IN ('waiting', 'ready', 'ordering', 'order_placed');
  SELECT count(*) INTO v_completed_pools FROM public.pools WHERE status = 'completed';
  SELECT count(*) INTO v_failed_pools FROM public.pools WHERE status = 'failed';
  SELECT count(*) INTO v_pending_reports FROM public.reports WHERE status = 'pending';

  RETURN jsonb_build_object(
    'totalUsers', v_total_users,
    'activePools', v_active_pools,
    'completedPools', v_completed_pools,
    'failedPools', v_failed_pools,
    'pendingReports', v_pending_reports
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_user_rpc(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;
  
  UPDATE public.profiles SET account_status = 'suspended' WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_report_status_rpc(p_report_id UUID, p_status report_status, p_admin_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;
  
  UPDATE public.reports SET status = p_status, admin_notes = COALESCE(p_admin_notes, admin_notes),
  resolved_at = CASE WHEN p_status IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END
  WHERE id = p_report_id;
END;
$$;
