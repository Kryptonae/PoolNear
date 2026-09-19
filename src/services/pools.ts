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

export interface PoolWithDistance {
  pool_id: string;
  platform: PlatformKey;
  platform_other: string | null;
  minimum_order_value: number;
  current_total: number;
  max_members: number;
  destination: string;
  status: PoolStatusKey;
  required_by: string;
  expires_at: string;
  created_at: string;
  creator_id: string;
  orderer_id: string | null;
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
    phone?: string;
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
  platformFilter?: PlatformKey,
  statusFilter?: PoolStatusKey
): Promise<PoolWithDistance[]> {
  const { data, error } = await supabase.rpc('get_nearby_pools', {
    user_lat: lat,
    user_lon: lng,
    radius_meters: radiusMeters,
    filter_platform: platformFilter || '',
    filter_status: statusFilter || '',
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
  const { data: members, error } = await supabase
    .from('pool_members')
    .select('*')
    .eq('pool_id', poolId)
    .neq('commitment_status', 'withdrawn')
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);
  
  if (!members || members.length === 0) return [];

  const membersWithProfiles = await Promise.all(members.map(async (member) => {
    const { data: profileData } = await supabase.rpc('get_public_profile', { p_user_id: member.user_id });
    const profile = profileData?.[0];
    return {
      ...member,
      profiles: profile ? {
        id: profile.id,
        name: profile.name,
        successful_pools: profile.successful_pools,
        cancelled_pools: profile.cancelled_pools
      } : undefined
    };
  }));

  return membersWithProfiles as PoolMember[];
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
export async function createPool(input: CreatePoolInput, _userId: string) {
  const { data, error } = await supabase.rpc('create_pool_atomic', {
    p_product_description: input.product_description,
    p_amount: input.amount,
    p_quantity: input.quantity,
    p_platform: input.platform,
    p_platform_other: input.platform_other || null,
    p_minimum_order_value: input.minimum_order_value,
    p_required_by: input.required_by,
    p_maximum_distance: input.maximum_distance,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_destination: input.destination,
    p_max_members: input.max_members,
    p_expires_at: input.expires_at,
  });

  if (error) throw new Error(error.message);

  return getPoolById(data as string);
}

/**
 * Join an existing pool.
 */
export async function joinPool(
  poolId: string,
  _userId: string,
  contribution: number,
  productDescription: string,
  requirementId?: string
) {
  const { error } = await supabase.rpc('join_pool_atomic', {
    p_pool_id: poolId,
    p_contribution: contribution,
    p_product_description: productDescription,
    p_requirement_id: requirementId || null,
  });

  if (error) throw new Error(error.message);
}

/**
 * Leave a pool (withdraw membership).
 */
export async function leavePool(poolId: string, _userId: string) {
  const { error } = await supabase.rpc('leave_pool_atomic', { p_pool_id: poolId });
  if (error) throw new Error(error.message);
}

/**
 * Cancel a requirement (atomically leaves attached pool if waiting/ready).
 */
export async function cancelRequirement(requirementId: string) {
  const { error } = await supabase.rpc('cancel_requirement_atomic', { p_requirement_id: requirementId });
  if (error) throw new Error(error.message);
}

/**
 * Volunteer as the orderer.
 */
export async function volunteerAsOrderer(poolId: string, _userId: string) {
  const { error } = await supabase.rpc('volunteer_as_orderer', { p_pool_id: poolId });
  if (error) throw new Error(error.message);
}

/**
 * Upload order proof and mark order as placed.
 */
export async function submitOrderProof(
  poolId: string,
  _userId: string,
  externalOrderId: string,
  orderValue: number,
  expectedDelivery: string,
  proofImageUrl?: string
) {
  const { error } = await supabase.rpc('submit_order_proof_atomic', {
    p_pool_id: poolId,
    p_external_order_id: externalOrderId,
    p_order_value: orderValue,
    p_expected_delivery: expectedDelivery,
    p_proof_url: proofImageUrl || null,
  });

  if (error) throw new Error(error.message);
}

/**
 * Mark payment as sent by a member.
 */
export async function markPaymentSent(poolId: string, _userId: string, proofUrl?: string) {
  const { error } = await supabase.rpc('mark_payment_sent_atomic', {
    p_pool_id: poolId,
    p_proof_url: proofUrl || null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Confirm payment received (by the orderer for a specific member).
 */
export async function confirmPaymentReceived(_poolId: string, memberId: string) {
  const { error } = await supabase.rpc('confirm_payment_received_atomic', { p_member_id: memberId });
  if (error) throw new Error(error.message);
}

/**
 * Mark delivery received by orderer.
 */
export async function markOrderDelivered(poolId: string) {
  const { error } = await supabase.rpc('mark_order_delivered_atomic', { p_pool_id: poolId });
  if (error) throw new Error(error.message);
}

/**
 * Confirm receipt of item by a member.
 */
export async function confirmReceipt(poolId: string, _userId: string) {
  const { error } = await supabase.rpc('confirm_receipt_atomic', { p_pool_id: poolId });
  if (error) throw new Error(error.message);
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

export async function requestConnection(_requesterId: string, receiverId: string, poolId: string) {
  const { error } = await supabase.rpc('request_connection_verified', {
    p_receiver_id: receiverId,
    p_pool_id: poolId,
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

export async function getPoolConnections(poolId: string, _userId: string) {
  const { data, error } = await supabase.rpc('get_pool_connections_with_phone', {
    p_pool_id: poolId,
  });
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
  _userId: string,
  _type: string,
  _title: string,
  _message: string,
  _data?: Record<string, unknown>
) {
  // Notifications are now created by server-side RPCs and triggers.
  // This client-side function is deprecated.
  console.warn('createNotification called from client, which is deprecated.');
}

// ─── ADMIN ──────────────────────────────────────────────────────

export async function getAdminStats() {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new Error(error.message);
  return data as {
    totalUsers: number;
    activePools: number;
    completedPools: number;
    failedPools: number;
    pendingReports: number;
  };
}

export async function getAllReports() {
  const { data, error } = await supabase.rpc('get_all_reports_admin');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateReportStatus(reportId: string, status: string, adminNotes?: string) {
  const { error } = await supabase.rpc('update_report_status_rpc', {
    p_report_id: reportId,
    p_status: status,
    p_admin_notes: adminNotes || null,
  });
  if (error) throw new Error(error.message);
}

export async function suspendUser(userId: string) {
  const { error } = await supabase.rpc('suspend_user_rpc', { p_user_id: userId });
  if (error) throw new Error(error.message);
}
