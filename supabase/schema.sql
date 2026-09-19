-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — PostgreSQL Schema for Supabase
-- Complete database design with RLS, indexes, and constraints
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
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

-- Anyone can view public profile info
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile
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

-- Pool creator or admin can update pool
CREATE POLICY "Creator or admin can update pool"
  ON pools FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = creator_id
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

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update pool current_total when members change
CREATE OR REPLACE FUNCTION update_pool_total()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE pools
    SET current_total = (
      SELECT COALESCE(SUM(contribution), 0)
      FROM pool_members
      WHERE pool_id = NEW.pool_id AND commitment_status != 'withdrawn'
    ),
    updated_at = NOW()
    WHERE id = NEW.pool_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE pools
    SET current_total = (
      SELECT COALESCE(SUM(contribution), 0)
      FROM pool_members
      WHERE pool_id = NEW.pool_id AND commitment_status != 'withdrawn'
    ),
    updated_at = NOW()
    WHERE id = NEW.pool_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE pools
    SET current_total = (
      SELECT COALESCE(SUM(contribution), 0)
      FROM pool_members
      WHERE pool_id = OLD.pool_id AND commitment_status != 'withdrawn'
    ),
    updated_at = NOW()
    WHERE id = OLD.pool_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_pool_member_change
  AFTER INSERT OR UPDATE OR DELETE ON pool_members
  FOR EACH ROW EXECUTE FUNCTION update_pool_total();

-- Auto-update pool status to 'ready' when current_total >= minimum_order_value
CREATE OR REPLACE FUNCTION check_pool_ready()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_total >= NEW.minimum_order_value AND NEW.status = 'waiting' THEN
    NEW.status := 'ready';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_pool_total_update
  BEFORE UPDATE ON pools
  FOR EACH ROW EXECUTE FUNCTION check_pool_ready();

-- Update profile timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Haversine distance function (returns meters)
CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Find nearby pools using Haversine
CREATE OR REPLACE FUNCTION get_nearby_pools(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 500,
  filter_platform platform_type DEFAULT NULL,
  filter_status pool_status DEFAULT 'waiting'
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
) AS $$
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
    haversine_distance(user_lat, user_lon, p.latitude, p.longitude) AS distance_meters,
    (SELECT COUNT(*) FROM pool_members pm WHERE pm.pool_id = p.id AND pm.commitment_status != 'withdrawn') AS member_count
  FROM pools p
  WHERE p.status IN ('waiting', 'ready')
    AND p.expires_at > NOW()
    AND haversine_distance(user_lat, user_lon, p.latitude, p.longitude) <= radius_meters
    AND (filter_platform IS NULL OR p.platform = filter_platform)
  ORDER BY
    haversine_distance(user_lat, user_lon, p.latitude, p.longitude) ASC,
    (p.minimum_order_value - p.current_total) ASC;
END;
$$ LANGUAGE plpgsql STABLE;
