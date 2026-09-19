// ═══════════════════════════════════════════════════════════════════
// PoolNear — Pool Detail Page
// Complete pool lifecycle: view, join, orderer, payment, delivery
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getPoolById, getPoolMembers, getPoolOrder,
  joinPool, leavePool, volunteerAsOrderer,
  submitOrderProof, markPaymentSent, confirmPaymentReceived,
  markOrderDelivered, confirmReceipt, submitReport,
  requestConnection, respondToConnection, getPoolConnections,
  type Pool, type PoolMember, type PoolOrder,
} from '../services/pools';
import { uploadOrderProof, uploadPaymentProof, getSignedUrl } from '../services/uploads';
import { supabase } from '../lib/supabase';
import { PlatformBadge, StatusBadge, AmountProgress, Modal, LoadingState, ErrorState } from '../components/ui';
import { PhoneNumberModal } from '../components/PhoneNumberModal';
import { type PoolStatusKey } from '../lib/constants';
import { formatDistance, haversineDistance } from '../lib/geo';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowLeft, MapPin, Clock, Users, UserCheck, ShieldCheck,
  Upload, CheckCircle2, Flag, Image,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function PoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, hasValidPhone, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [pool, setPool] = useState<Pool | null>(null);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [order, setOrder] = useState<PoolOrder | null>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showOrderProofModal, setShowOrderProofModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [joinAmount, setJoinAmount] = useState('');
  const [joinProduct, setJoinProduct] = useState('');
  const [proofOrderId, setProofOrderId] = useState('');
  const [proofOrderValue, setProofOrderValue] = useState('');
  const [proofDeliveryTime, setProofDeliveryTime] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const proofFileRef = useRef<HTMLInputElement>(null);
  const paymentFileRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [poolData, membersData, orderData] = await Promise.all([
        getPoolById(id),
        getPoolMembers(id),
        getPoolOrder(id),
      ]);
      setPool(poolData);
      setMembers(membersData);
      setOrder(orderData);
      
      if (profile?.id) {
        const connectionsData = await getPoolConnections(id, profile.id);
        setConnections(connectionsData);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, profile?.id]);

  // Silent background refetch (no loading spinner)
  const refetchSilent = useCallback(async () => {
    if (!id) return;
    try {
      const [poolData, membersData, orderData] = await Promise.all([
        getPoolById(id),
        getPoolMembers(id),
        getPoolOrder(id),
      ]);
      setPool(poolData);
      setMembers(membersData);
      setOrder(orderData);
      
      if (profile?.id) {
        const connectionsData = await getPoolConnections(id, profile.id);
        setConnections(connectionsData);
      }
    } catch {
      // Silent fail for background refresh
    }
  }, [id, profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── REALTIME SUBSCRIPTIONS ───────────────────────────────────
  // Subscribe to pools, pool_members, and orders changes for this pool
  // so both users see live updates without manual refresh.
  useEffect(() => {
    if (!id) return;

    const channel = supabase.channel(`pool-detail:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pools', filter: `id=eq.${id}` },
        () => { refetchSilent(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pool_members', filter: `pool_id=eq.${id}` },
        () => { refetchSilent(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `pool_id=eq.${id}` },
        () => { refetchSilent(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections', filter: `pool_id=eq.${id}` },
        () => { refetchSilent(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refetchSilent]);

  if (loading) return <LoadingState message="Loading pool details..." />;
  if (error || !pool) return <ErrorState message={error || 'Pool not found'} onRetry={fetchAll} />;

  const isMember = members.some((m) => m.user_id === profile?.id);
  const isOrderer = pool.orderer_id === profile?.id;
  const myMembership = members.find((m) => m.user_id === profile?.id);
  const memberCount = members.length;
  const isFull = memberCount >= pool.max_members;
  const canJoin = !isMember && !isFull && (pool.status === 'waiting' || pool.status === 'ready');
  const distanceMeters = profile?.latitude && profile?.longitude
    ? haversineDistance(profile.latitude, profile.longitude, pool.latitude, pool.longitude)
    : null;
    
  const remainingRequired = Math.max(0, (pool.minimum_order_value || 0) - (pool.current_total || 0));

  const isConnectedToOrderer = connections.some(c => 
    c.status === 'accepted' && 
    (
      (c.requester_id === profile?.id && c.receiver_id === pool.orderer_id) ||
      (c.requester_id === pool.orderer_id && c.receiver_id === profile?.id)
    )
  );
  
  const pendingConnectionToOrderer = connections.some(c =>
    c.status === 'pending' && 
    (
      (c.requester_id === profile?.id && c.receiver_id === pool.orderer_id) ||
      (c.requester_id === pool.orderer_id && c.receiver_id === profile?.id)
    )
  );

  // ─── ACTIONS ────────────────────────────────────────────────────

  async function handleJoin() {
    const amount = parseFloat(joinAmount);
    if (!joinAmount || amount <= 0 || !joinProduct.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (remainingRequired > 0 && amount < remainingRequired) {
      toast.error(`Minimum contribution required: ₹${remainingRequired}`);
      return;
    }
    setActionLoading(true);
    try {
      await joinPool(pool!.id, profile!.id, parseFloat(joinAmount), joinProduct.trim());
      toast.success('You joined this pool!');
      setShowJoinModal(false);
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeave() {
    if (!confirm('Are you sure you want to leave this pool?')) return;
    setActionLoading(true);
    try {
      await leavePool(pool!.id, profile!.id);
      toast.success('You left the pool');
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVolunteer() {
    setActionLoading(true);
    try {
      await volunteerAsOrderer(pool!.id, profile!.id);
      toast.success('You are now the orderer!');
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitProof() {
    if (!proofOrderId.trim() || !proofOrderValue) {
      toast.error('Please fill in all required fields');
      return;
    }
    setActionLoading(true);
    try {
      let proofImageUrl: string | undefined;

      // Upload proof file if provided
      if (proofFile && profile) {
        const result = await uploadOrderProof(proofFile, profile.id, pool!.id, setUploadProgress);
        proofImageUrl = result.url;
      }

      await submitOrderProof(
        pool!.id, profile!.id, proofOrderId.trim(),
        parseFloat(proofOrderValue),
        proofDeliveryTime || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        proofImageUrl
      );
      toast.success('Order proof submitted!');
      setShowOrderProofModal(false);
      setProofFile(null);
      setUploadProgress(0);
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkPaid() {
    setActionLoading(true);
    try {
      let proofUrl: string | undefined;

      // Upload payment proof if provided
      if (paymentProofFile && profile) {
        const result = await uploadPaymentProof(paymentProofFile, profile.id, pool!.id, setUploadProgress);
        proofUrl = result.url;
      }

      await markPaymentSent(pool!.id, profile!.id, proofUrl);
      toast.success('Payment marked as sent');
      setPaymentProofFile(null);
      setUploadProgress(0);
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmPayment(memberId: string) {
    setActionLoading(true);
    try {
      await confirmPaymentReceived(pool!.id, memberId);
      toast.success('Payment confirmed');
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkDelivered() {
    setActionLoading(true);
    try {
      await markOrderDelivered(pool!.id);
      toast.success('Marked as delivered');
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmReceipt() {
    setActionLoading(true);
    try {
      await confirmReceipt(pool!.id, profile!.id);
      toast.success('Receipt confirmed! 🎉');
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReport() {
    if (!reportReason.trim()) {
      toast.error('Please select a reason');
      return;
    }
    setActionLoading(true);
    try {
      await submitReport(profile!.id, pool!.orderer_id || pool!.creator_id, pool!.id, reportReason, reportDescription);
      toast.success('Report submitted');
      setShowReportModal(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleViewProof(path: string) {
    try {
      const url = await getSignedUrl(path);
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.error('Could not load proof image');
      }
    } catch (err) {
      toast.error('Could not load proof image');
    }
  }

  async function handleRequestConnection(receiverId: string) {
    try {
      await requestConnection(profile!.id, receiverId, pool!.id);
      toast.success('Connection request sent');
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRespondConnection(connectionId: string, accept: boolean) {
    try {
      await respondToConnection(connectionId, accept);
      toast.success(accept ? 'Connection accepted' : 'Connection rejected');
      fetchAll();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const status = pool.status as PoolStatusKey;

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-surface-600 hover:bg-surface-200 transition-colors" aria-label="Go back">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-surface-900">Pool Details</h1>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Pool Info Card */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <PlatformBadge platform={pool.platform} platformOther={pool.platform_other} />
          <span className="text-xs text-surface-400 font-mono">#{pool.id.slice(0, 8)}</span>
        </div>

        <AmountProgress current={pool.current_total} target={pool.minimum_order_value} />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-surface-600">
            <Users size={16} className="text-surface-400" />
            <span><strong>{memberCount}</strong> / {pool.max_members} members</span>
          </div>
          {distanceMeters !== null && (
            <div className="flex items-center gap-2 text-sm text-surface-600">
              <MapPin size={16} className="text-surface-400" />
              <span>{formatDistance(distanceMeters)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-surface-600">
            <Clock size={16} className="text-surface-400" />
            <span>{formatDistanceToNow(new Date(pool.required_by), { addSuffix: true })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-surface-600">
            <MapPin size={16} className="text-brand-400" />
            <span className="font-medium truncate">{pool.destination}</span>
          </div>
          <div className="col-span-2 pt-2 mt-1 border-t border-surface-100 flex items-center justify-between text-xs text-surface-500">
            <span>Pool Created</span>
            <span className="font-medium text-surface-700">{format(new Date(pool.created_at), 'dd MMM yyyy, hh:mm a')}</span>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-2xl border border-surface-200 p-5 space-y-3">
        <h3 className="font-semibold text-surface-900 text-sm">Members</h3>
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm">
                {(member.profiles?.name || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 truncate">
                  {member.profiles?.name || 'User'}
                  {member.user_id === pool.orderer_id && (
                    <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Orderer</span>
                  )}
                  {member.user_id === profile?.id && (
                    <span className="ml-1.5 text-xs bg-surface-100 text-surface-500 px-1.5 py-0.5 rounded-full">You</span>
                  )}
                </p>
                <p className="text-xs text-surface-400">
                  {member.profiles?.successful_pools || 0} successful pools
                </p>
                {/* Connection UI */}
                {isMember && member.user_id !== profile?.id && (isOrderer || member.user_id === pool.orderer_id) && (
                  <div className="mt-2">
                    {(() => {
                      const connection = connections.find(c => 
                        (c.requester_id === member.user_id && c.receiver_id === profile?.id) ||
                        (c.requester_id === profile?.id && c.receiver_id === member.user_id)
                      );
                      
                      if (!connection) {
                        if (!hasValidPhone) {
                          return (
                            <button onClick={() => setShowPhoneModal(true)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium hover:bg-red-100 transition-colors">
                              Add Phone to Connect
                            </button>
                          );
                        }
                        return (
                          <button onClick={() => handleRequestConnection(member.user_id)} className="text-xs bg-brand-50 text-brand-600 px-2 py-1 rounded-full font-medium hover:bg-brand-100 transition-colors">
                            Connect for Payment
                          </button>
                        );
                      }
                      
                      if (connection.status === 'pending') {
                        if (connection.receiver_id === profile?.id) {
                          return (
                            <div className="flex gap-2">
                              <button onClick={() => handleRespondConnection(connection.id, true)} className="text-xs bg-brand-500 text-white px-2.5 py-1 rounded-full font-medium hover:bg-brand-600">Accept</button>
                              <button onClick={() => handleRespondConnection(connection.id, false)} className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-medium hover:bg-red-200">Reject</button>
                            </div>
                          );
                        } else {
                          return <span className="text-xs bg-surface-100 text-surface-500 px-2.5 py-1 rounded-full">Request Sent</span>;
                        }
                      }
                      
                      if (connection.status === 'accepted') {
                        return <span className="text-xs font-mono bg-green-50 text-green-700 px-2 py-1 rounded-md">{connection.contact_phone || 'No phone number'}</span>;
                      }
                      
                      return <span className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded-full">Connection Rejected</span>;
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="text-sm font-semibold text-surface-900">₹{member.contribution}</p>
              {/* Receipt status */}
              {(status === 'delivered' || status === 'completed') && (
                <div className="mt-1">
                  {member.receipt_status === 'received' ? (
                    <span className="text-xs text-green-600">✅ Received</span>
                  ) : (
                    <span className="text-xs text-amber-500">⏳ Pending</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Payment Dashboard (Orderer) */}
      {isOrderer && (status === 'ordering' || status === 'order_placed') && (
        <div className="bg-white rounded-2xl border border-brand-200 p-5 space-y-3 animate-fade-in shadow-sm">
          <h3 className="font-semibold text-brand-900 text-sm">Payment Dashboard</h3>
          <div className="space-y-3">
            {members.filter(m => m.user_id !== profile?.id).map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl border border-surface-100">
                <div>
                  <p className="text-sm font-medium text-surface-900">{member.profiles?.name || 'User'}</p>
                  <p className="text-xs font-semibold text-surface-900 mt-0.5">₹{member.contribution}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {member.payment_status === 'confirmed' ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1"><CheckCircle2 size={12}/> Confirmed</span>
                  ) : member.payment_status === 'sent' ? (
                    <>
                      <button onClick={() => handleConfirmPayment(member.id)} disabled={actionLoading} className="text-xs bg-brand-500 text-white px-3 py-1.5 rounded-full font-medium hover:bg-brand-600 active:scale-95 transition-all shadow-sm">
                        Confirm Payment
                      </button>
                      {member.payment_proof_url && (
                        <button onClick={() => handleViewProof(member.payment_proof_url!)} className="text-[10px] text-surface-500 hover:text-surface-700 underline flex items-center gap-1">
                          <Image size={10} /> View Proof
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs bg-surface-200 text-surface-600 px-2.5 py-1 rounded-full font-medium">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Card (Member) */}
      {isMember && !isOrderer && (status === 'ordering' || status === 'order_placed') && myMembership && (
        <div className="bg-white rounded-2xl border border-brand-200 p-5 space-y-4 animate-fade-in shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-surface-900 text-sm">Payment Required</h3>
              <p className="text-xs text-surface-500 mt-0.5">Pay to {members.find(m => m.user_id === pool.orderer_id)?.profiles?.name || 'the orderer'}</p>
            </div>
            <p className="text-lg font-bold text-surface-900">₹{myMembership.contribution}</p>
          </div>
          
          <div className="pt-3 border-t border-surface-100">
            {!isConnectedToOrderer ? (
              <div className="space-y-3">
                {pendingConnectionToOrderer ? (
                  <div className="bg-amber-50 text-amber-700 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium border border-amber-200 text-center">
                    <Clock size={16} /> Waiting for the orderer to accept your connection.
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-surface-700 text-center">Connect with the orderer before making payment.</p>
                    <button onClick={() => handleRequestConnection(pool.orderer_id!)} className="w-full py-3 bg-brand-100 text-brand-700 rounded-xl font-bold hover:bg-brand-200 transition-colors shadow-sm border border-brand-200">
                      Connect with Orderer
                    </button>
                  </>
                )}
              </div>
            ) : myMembership.payment_status === 'confirmed' ? (
              <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 size={18} /> Payment Confirmed
              </div>
            ) : myMembership.payment_status === 'sent' ? (
              <div className="bg-amber-50 text-amber-700 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
                <Clock size={18} /> Waiting for confirmation
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg border border-green-200 mb-2">
                  <span className="text-xs font-semibold text-green-700">Connected</span>
                  <span className="text-xs font-mono font-medium text-green-800">
                    {connections.find(c => c.status === 'accepted' && (c.requester_id === pool.orderer_id || c.receiver_id === pool.orderer_id))?.contact_phone || 'Phone hidden'}
                  </span>
                </div>
                <div className="bg-surface-50 rounded-xl p-3 flex items-center justify-between border border-surface-100">
                  <span className="text-xs text-surface-600 font-medium flex items-center gap-2">
                    <Image size={14} className="text-surface-400" />
                    {paymentProofFile ? paymentProofFile.name : 'Proof (optional)'}
                  </span>
                  <button onClick={() => paymentFileRef.current?.click()} className="text-xs text-brand-600 font-semibold hover:underline">
                    {paymentProofFile ? 'Change' : 'Attach'}
                  </button>
                  <input ref={paymentFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)} />
                </div>
                <button onClick={handleMarkPaid} disabled={actionLoading} className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98] shadow-sm flex items-center justify-center gap-2">
                  <ShieldCheck size={18} /> I've Paid
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <span className="text-xs opacity-70">({uploadProgress}%)</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Info (if placed) */}
      {order && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm border-b border-blue-100 pb-2">
            <CheckCircle2 size={16} />
            Order Information
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-blue-500 text-xs">Order ID</span>
              <p className="font-mono text-blue-900 font-medium">{order.external_order_id || '—'}</p>
            </div>
            <div>
              <span className="text-blue-500 text-xs">Total</span>
              <p className="font-semibold text-blue-900">₹{order.order_value || '—'}</p>
            </div>
            <div>
              <span className="text-blue-500 text-xs">Placed At</span>
              <p className="text-blue-900 font-medium whitespace-nowrap">{format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}</p>
            </div>
            {order.expected_delivery && (
              <div>
                <span className="text-blue-500 text-xs">Expected Delivery</span>
                <p className="text-blue-800 font-medium">{format(new Date(order.expected_delivery), 'dd MMM yyyy, hh:mm a')}</p>
              </div>
            )}
            {order.proof_image_url && (
              <div className="col-span-2">
                <span className="text-blue-400">Order Proof</span>
                <button
                  onClick={() => handleViewProof(order.proof_image_url!)}
                  className="text-blue-700 underline text-xs flex items-center gap-1 mt-1 hover:text-blue-800 transition-colors"
                >
                  <Image size={12} /> View proof image
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed Banner */}
      {status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center animate-scale-in">
          <div className="text-3xl mb-2">🎉</div>
          <h3 className="text-lg font-bold text-green-800">Pool Completed!</h3>
          <p className="text-sm text-green-600 mt-1">All members have received their items.</p>
        </div>
      )}

      {/* ─── ACTION BUTTONS ──────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Join */}
        {canJoin && (
          <button onClick={() => setShowJoinModal(true)} className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:from-brand-600 hover:to-brand-700 transition-all active:scale-[0.98] shadow-lg shadow-brand-500/20">
            Join Pool
          </button>
        )}

        {/* Leave */}
        {isMember && (status === 'waiting' || status === 'ready') && (
          <button onClick={handleLeave} disabled={actionLoading} className="w-full py-3 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors">
            Leave Pool
          </button>
        )}

        {/* Volunteer as Orderer */}
        {isMember && status === 'ready' && !pool.orderer_id && (
          <button onClick={handleVolunteer} disabled={actionLoading} className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors active:scale-[0.98] flex items-center justify-center gap-2">
            <UserCheck size={18} /> I Can Place the Order
          </button>
        )}

        {/* Submit Order Proof */}
        {isOrderer && status === 'ordering' && (
          <button onClick={() => setShowOrderProofModal(true)} className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors active:scale-[0.98] flex items-center justify-center gap-2">
            <Upload size={18} /> Submit Order Proof
          </button>
        )}

        {/* Old payment sent section removed */}

        {/* Mark Delivered (orderer only) */}
        {isOrderer && status === 'order_placed' && (
          <button onClick={handleMarkDelivered} disabled={actionLoading} className="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors active:scale-[0.98]">
            📦 Order Received — Mark Delivered
          </button>
        )}

        {/* Confirm Receipt (members) */}
        {isMember && status === 'delivered' && myMembership?.receipt_status !== 'received' && (
          <button onClick={handleConfirmReceipt} disabled={actionLoading} className="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors active:scale-[0.98]">
            ✅ I&apos;ve Received My Item
          </button>
        )}

        {/* Report */}
        {isMember && (status === 'failed' || status === 'order_placed' || status === 'delivered') && (
          <button onClick={() => setShowReportModal(true)} className="w-full py-2.5 text-surface-500 text-sm font-medium hover:text-red-500 transition-colors flex items-center justify-center gap-1.5">
            <Flag size={14} /> Report an Issue
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-surface-400 leading-relaxed px-4">
        PoolNear does not hold or transfer your money. All payments are coordinated externally between users via UPI or other methods.
      </p>

      {/* ─── MODALS ────────────────────────────────────────────────────── */}

      {/* Join Modal */}
      <Modal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} title="Join Pool">
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="join-product">What do you need?</label>
            <input id="join-product" type="text" value={joinProduct} onChange={(e) => setJoinProduct(e.target.value)} placeholder="e.g. Snacks" className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="join-amount">Your contribution amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">₹</span>
              <input id="join-amount" type="number" value={joinAmount} onChange={(e) => setJoinAmount(e.target.value)} placeholder="30" min="1" className="w-full pl-8 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
            {remainingRequired > 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 font-medium">
                <div className="flex justify-between items-center mb-1">
                  <span>Minimum Order</span>
                  <span className="font-semibold">₹{pool.minimum_order_value}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span>Current Total</span>
                  <span className="font-semibold">₹{pool.current_total || 0}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-blue-200 mt-1">
                  <span>Still Needed</span>
                  <span className="font-bold">₹{remainingRequired}</span>
                </div>
                {parseFloat(joinAmount || '0') > 0 && parseFloat(joinAmount || '0') < remainingRequired && (
                  <p className="mt-2 text-red-600 font-semibold bg-red-50 p-2 rounded text-center">
                    Add at least ₹{remainingRequired} to join this pool.
                  </p>
                )}
              </div>
            )}
          </div>
          <button onClick={handleJoin} disabled={actionLoading || (remainingRequired > 0 && parseFloat(joinAmount || '0') < remainingRequired)} className="w-full py-3.5 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
            {actionLoading ? 'Joining...' : 'Confirm & Join'}
          </button>
          <p className="text-xs text-surface-400 text-center">This is a commitment. You are not transferring money to PoolNear.</p>
        </div>
      </Modal>

      {/* Order Proof Modal */}
      <Modal isOpen={showOrderProofModal} onClose={() => setShowOrderProofModal(false)} title="Submit Order Proof">
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="proof-order-id">External Order ID</label>
            <input id="proof-order-id" type="text" value={proofOrderId} onChange={(e) => setProofOrderId(e.target.value)} placeholder="Order #12345" className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="proof-order-value">Total Order Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">₹</span>
              <input id="proof-order-value" type="number" value={proofOrderValue} onChange={(e) => setProofOrderValue(e.target.value)} placeholder="105" className="w-full pl-8 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="proof-delivery">Expected Delivery Time</label>
            <input id="proof-delivery" type="datetime-local" value={proofDeliveryTime} onChange={(e) => setProofDeliveryTime(e.target.value)} className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </div>
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Order Screenshot (optional)</label>
            <button
              onClick={() => proofFileRef.current?.click()}
              className="w-full py-3 border-2 border-dashed border-surface-300 rounded-xl text-sm text-surface-500 hover:border-brand-400 hover:text-brand-600 transition-colors flex items-center justify-center gap-2"
            >
              <Image size={16} />
              {proofFile ? proofFile.name : 'Choose file...'}
            </button>
            <input
              ref={proofFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            />
            {proofFile && (
              <p className="text-xs text-surface-400 mt-1">
                {(proofFile.size / 1024).toFixed(0)} KB · {proofFile.type}
              </p>
            )}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-2">
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
          <button onClick={handleSubmitProof} disabled={actionLoading} className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors active:scale-[0.98] disabled:opacity-60">
            {actionLoading ? 'Submitting...' : 'Submit Proof'}
          </button>
        </div>
      </Modal>

      {/* Report Modal */}
      <Modal isOpen={showReportModal} onClose={() => setShowReportModal(false)} title="Report an Issue">
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Reason</label>
            <div className="space-y-2">
              {['Order not placed', 'Payment not received', 'Item not received', 'Fraudulent behavior', 'Other'].map((r) => (
                <button key={r} onClick={() => setReportReason(r)} className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${reportReason === r ? 'border-red-400 bg-red-50 text-red-700' : 'border-surface-200 text-surface-600 hover:border-surface-300'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="report-description">Additional details (optional)</label>
            <textarea id="report-description" value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} placeholder="Describe what happened..." rows={3} className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none" />
          </div>
          <button onClick={handleReport} disabled={actionLoading} className="w-full py-3.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors active:scale-[0.98] disabled:opacity-60">
            {actionLoading ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </Modal>

      {/* Phone Number Modal for Connections */}
      <PhoneNumberModal
        isOpen={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onSaved={() => {
          refreshProfile();
          refetchSilent();
        }}
      />
    </div>
  );
}
