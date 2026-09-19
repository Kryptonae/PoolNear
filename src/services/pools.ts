// ═══════════════════════════════════════════════════════════════════
// PoolNear — Pool Service
// All Supabase queries for pools, requirements, and pool members
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';
import type { PlatformKey, PoolStatusKey } from '../lib/constants';

// ─── TYPES ──────────────────────────────────────────────────────

export interface Pool {
  id: string;
  creator_id: string;
  platform: PlatformKey;
  platform_other: string | null;
  minimum_order_value: number;
  current_total: number;
  max_members: number;
  destination: string;
  latitude: number;
  longitude: number;
  orderer_id: string | null;
  status: PoolStatusKey;
  required_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface PoolWithDistance extends Pool {
  distance_meters: number;
  member_count: number;
}

export interface Requirement {
  id: string;
  user_id: string;
  pool_id: string | null;
  product_description: string;
  amount: number;
  quantity: number;
  platform: PlatformKey;
  platform_other: string | null;
  minimum_order_value: number;
  required_by: string;
  maximum_distance: number;
  latitude: number | null;
  longitude: number | null;
  destination: string | null;
  status: string;
  created_at: string;
  expires_at: string;
}

export interface PoolMember {
  id: string;
  pool_id: string;
  user_id: string;
  requirement_id: string | null;
  contribution: number;
  commitment_status: string;
  payment_status: string;
  receipt_status: string;
  can_place_order: boolean;
  payment_proof_url: string | null;
  joined_at: string;
  profiles?: {
    id: string;
    name: string;
    successful_pools: number;
    cancelled_pools: number;
  };
}

export interface PoolOrder {
  id: string;
  pool_id: string;
  orderer_id: string;
  platform: PlatformKey;
  platform_other: string | null;
  external_order_id: string | null;
  order_value: number | null;
  proof_image_url: string | null;
  expected_delivery: string | null;
  actual_delivery: string | null;
  status: string;
  created_at: string;
}

export interface CreatePoolInput {
  product_description: string;
  amount: number;
  quantity: number;
  platform: PlatformKey;
  platform_other?: string;
  minimum_order_value: number;
  required_by: string;
  maximum_distance: number;
  latitude: number;
  longitude: number;
  destination: string;
  max_members: number;
  expires_at: string;
}

// ─── POOL QUERIES ───────────────────────────────────────────────

/**
 * Get nearby pools using the Supabase RPC function (Haversine).
 */
export async function getNearbyPools(
  lat: number,
  lng: number,
  radiusMeters: number = 500,
  platformFilter?: PlatformKey
): Promise<PoolWithDistance[]> {
  const { data, error } = await supabase.rpc('get_nearby_pools', {
    user_lat: lat,
    user_lon: lng,
    radius_meters: radiusMeters,
    filter_platform: platformFilter || null,
    filter_status: 'waiting',
  });

  if (error) throw new Error(error.message);
  return (data || []) as PoolWithDistance[];
}

/**
 * Get a single pool by ID with all related data.
 */
export async function getPoolById(poolId: string) {
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single();

  if (error) throw new Error(error.message);
  return data as Pool;
}

/**
 * Get pool members with profile info.
 */
export async function getPoolMembers(poolId: string): Promise<PoolMember[]> {
  const { data, error } = await supabase
    .from('pool_members')
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        successful_pools,
        cancelled_pools
      )
    `)
    .eq('pool_id', poolId)
    .neq('commitment_status', 'withdrawn')
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as PoolMember[];
}

/**
 * Get pool order details.
 */
export async function getPoolOrder(poolId: string): Promise<PoolOrder | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as PoolOrder | null;
}

/**
 * Create a new pool with the user's requirement as the first member.
 */
export async function createPool(input: CreatePoolInput, userId: string) {
  // 1. Create the pool
  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .insert({
      creator_id: userId,
      platform: input.platform,
      platform_other: input.platform_other || null,
      minimum_order_value: input.minimum_order_value,
      current_total: 0,
      max_members: input.max_members,
      destination: input.destination,
      latitude: input.latitude,
      longitude: input.longitude,
      status: 'waiting',
      required_by: input.required_by,
      expires_at: input.expires_at,
    })
    .select()
    .single();

  if (poolError) throw new Error(poolError.message);

  // 2. Create the requirement
  const { data: requirement, error: reqError } = await supabase
    .from('requirements')
    .insert({
      user_id: userId,
      pool_id: pool.id,
      product_description: input.product_description,
      amount: input.amount,
      quantity: input.quantity,
      platform: input.platform,
      platform_other: input.platform_other || null,
      minimum_order_value: input.minimum_order_value,
      required_by: input.required_by,
      maximum_distance: input.maximum_distance,
      latitude: input.latitude,
      longitude: input.longitude,
      destination: input.destination,
      status: 'matched',
      expires_at: input.expires_at,
    })
    .select()
    .single();

  if (reqError) throw new Error(reqError.message);

  // 3. Add creator as first pool member
  const { error: memberError } = await supabase
    .from('pool_members')
    .insert({
      pool_id: pool.id,
      user_id: userId,
      requirement_id: requirement.id,
      contribution: input.amount,
      commitment_status: 'committed',
      payment_status: 'pending',
      receipt_status: 'pending',
    });

  if (memberError) throw new Error(memberError.message);

  return pool as Pool;
}

/**
 * Join an existing pool.
 */
export async function joinPool(
  poolId: string,
  userId: string,
  contribution: number,
  productDescription: string,
  requirementId?: string
) {
  // Check pool capacity
  const members = await getPoolMembers(poolId);
  const pool = await getPoolById(poolId);

  if (members.length >= pool.max_members) {
    throw new Error('This pool is already full.');
  }

  if (members.some((m) => m.user_id === userId)) {
    throw new Error('You are already a member of this pool.');
  }

  if (pool.status !== 'waiting' && pool.status !== 'ready') {
    throw new Error('This pool is no longer accepting members.');
  }

  // Create requirement if not provided
  let reqId = requirementId;
  if (!reqId) {
    const { data: req, error: reqError } = await supabase
      .from('requirements')
      .insert({
        user_id: userId,
        pool_id: poolId,
        product_description: productDescription,
        amount: contribution,
        quantity: 1,
        platform: pool.platform,
        platform_other: pool.platform_other,
        minimum_order_value: pool.minimum_order_value,
        required_by: pool.required_by,
        maximum_distance: 500,
        latitude: pool.latitude,
        longitude: pool.longitude,
        destination: pool.destination,
        status: 'matched',
        expires_at: pool.expires_at,
      })
      .select()
      .single();

    if (reqError) throw new Error(reqError.message);
    reqId = req.id;
  }

  // Add member
  const { error: memberError } = await supabase
    .from('pool_members')
    .insert({
      pool_id: poolId,
      user_id: userId,
      requirement_id: reqId,
      contribution,
      commitment_status: 'committed',
      payment_status: 'pending',
      receipt_status: 'pending',
    });

  if (memberError) throw new Error(memberError.message);
}

/**
 * Leave a pool (withdraw membership).
 */
export async function leavePool(poolId: string, userId: string) {
  const { error } = await supabase
    .from('pool_members')
    .update({ commitment_status: 'withdrawn' })
    .eq('pool_id', poolId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  // Update requirement status back to active
  await supabase
    .from('requirements')
    .update({ status: 'active', pool_id: null })
    .eq('pool_id', poolId)
    .eq('user_id', userId);
}

/**
 * Volunteer as the orderer.
 */
export async function volunteerAsOrderer(poolId: string, userId: string) {
  const { error: memberError } = await supabase
    .from('pool_members')
    .update({ can_place_order: true })
    .eq('pool_id', poolId)
    .eq('user_id', userId);

  if (memberError) throw new Error(memberError.message);

  const { error: poolError } = await supabase
    .from('pools')
    .update({ orderer_id: userId, status: 'ordering' })
    .eq('id', poolId);

  if (poolError) throw new Error(poolError.message);
}

/**
 * Upload order proof and mark order as placed.
 */
export async function submitOrderProof(
  poolId: string,
  userId: string,
  externalOrderId: string,
  orderValue: number,
  expectedDelivery: string,
  proofImageUrl?: string
) {
  const pool = await getPoolById(poolId);

  const { error } = await supabase.from('orders').insert({
    pool_id: poolId,
    orderer_id: userId,
    platform: pool.platform,
    platform_other: pool.platform_other,
    external_order_id: externalOrderId,
    order_value: orderValue,
    proof_image_url: proofImageUrl || null,
    expected_delivery: expectedDelivery,
    status: 'placed',
  });

  if (error) throw new Error(error.message);

  await supabase
    .from('pools')
    .update({ status: 'order_placed' })
    .eq('id', poolId);
}

/**
 * Mark payment as sent by a member.
 */
export async function markPaymentSent(poolId: string, userId: string, proofUrl?: string) {
  const { error } = await supabase
    .from('pool_members')
    .update({
      payment_status: 'sent',
      payment_proof_url: proofUrl || null,
    })
    .eq('pool_id', poolId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

/**
 * Confirm payment received (by the orderer for a specific member).
 */
export async function confirmPaymentReceived(poolId: string, memberId: string) {
  const { error } = await supabase
    .from('pool_members')
    .update({ payment_status: 'confirmed' })
    .eq('id', memberId);

  if (error) throw new Error(error.message);
}

/**
 * Mark delivery received by orderer.
 */
export async function markOrderDelivered(poolId: string) {
  await supabase
    .from('pools')
    .update({ status: 'delivered' })
    .eq('id', poolId);

  await supabase
    .from('orders')
    .update({ status: 'delivered', actual_delivery: new Date().toISOString() })
    .eq('pool_id', poolId);
}

/**
 * Confirm receipt of item by a member.
 */
export async function confirmReceipt(poolId: string, userId: string) {
  const { error } = await supabase
    .from('pool_members')
    .update({ receipt_status: 'received' })
    .eq('pool_id', poolId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  // Check if all members have confirmed
  const members = await getPoolMembers(poolId);
  const allReceived = members.every((m) => m.receipt_status === 'received');

  if (allReceived) {
    await supabase
      .from('pools')
      .update({ status: 'completed' })
      .eq('id', poolId);

    // Update requirement statuses
    await supabase
      .from('requirements')
      .update({ status: 'fulfilled' })
      .eq('pool_id', poolId);

    // Update member profiles: increment successful_pools
    for (const member of members) {
      await supabase.rpc('increment_field', {
        row_id: member.user_id,
        field_name: 'successful_pools',
      }).catch(() => {
        // If RPC doesn't exist, do it manually
        supabase
          .from('profiles')
          .update({
            successful_pools: (member.profiles?.successful_pools ?? 0) + 1,
          })
          .eq('id', member.user_id);
      });
    }
  }
}

// ─── USER'S POOLS QUERIES ───────────────────────────────────────

/**
 * Get pools created by the user.
 */
export async function getMyCreatedPools(userId: string) {
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Pool[];
}

/**
 * Get pools the user has joined (as a member).
 */
export async function getMyJoinedPools(userId: string) {
  const { data, error } = await supabase
    .from('pool_members')
    .select(`
      *,
      pools:pool_id (*)
    `)
    .eq('user_id', userId)
    .neq('commitment_status', 'withdrawn')
    .order('joined_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map((m: Record<string, unknown>) => ({
    membership: m,
    pool: m.pools as Pool,
  }));
}

/**
 * Get user's active requirements.
 */
export async function getMyRequirements(userId: string) {
  const { data, error } = await supabase
    .from('requirements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Requirement[];
}

// ─── CONNECTIONS ────────────────────────────────────────────────

export async function requestConnection(requesterId: string, receiverId: string, poolId: string) {
  const { error } = await supabase.from('connections').insert({
    requester_id: requesterId,
    receiver_id: receiverId,
    pool_id: poolId,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function respondToConnection(connectionId: string, accept: boolean) {
  const { error } = await supabase
    .from('connections')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('id', connectionId);
  if (error) throw new Error(error.message);
}

export async function getPoolConnections(poolId: string, userId: string) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('pool_id', poolId)
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
  if (error) throw new Error(error.message);
  return data || [];
}

// ─── REPORTS ────────────────────────────────────────────────────

export async function submitReport(
  reporterId: string,
  reportedUserId: string,
  poolId: string | null,
  reason: string,
  description: string
) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    pool_id: poolId,
    reason,
    description,
  });
  if (error) throw new Error(error.message);
}

// ─── NOTIFICATIONS ──────────────────────────────────────────────

export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function markNotificationRead(notificationId: string) {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string) {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    data: data || {},
  });
}

// ─── ADMIN ──────────────────────────────────────────────────────

export async function getAdminStats() {
  const [
    { count: totalUsers },
    { count: activePools },
    { count: completedPools },
    { count: failedPools },
    { count: pendingReports },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('pools').select('*', { count: 'exact', head: true }).in('status', ['waiting', 'ready', 'ordering', 'order_placed']),
    supabase.from('pools').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('pools').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return {
    totalUsers: totalUsers || 0,
    activePools: activePools || 0,
    completedPools: completedPools || 0,
    failedPools: failedPools || 0,
    pendingReports: pendingReports || 0,
  };
}

export async function getAllReports() {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      reporter:reporter_id (name),
      reported:reported_user_id (name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateReportStatus(reportId: string, status: string, adminNotes?: string) {
  const { error } = await supabase
    .from('reports')
    .update({
      status,
      admin_notes: adminNotes || null,
      resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null,
    })
    .eq('id', reportId);

  if (error) throw new Error(error.message);
}

export async function suspendUser(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ account_status: 'suspended' })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}
