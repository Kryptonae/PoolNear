// ═══════════════════════════════════════════════════════════════════
// PoolNear — Pool Detail Page
// Complete pool lifecycle: view, join, orderer, payment, delivery
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getPoolById, getPoolMembers, getPoolOrder,
  joinPool, leavePool, volunteerAsOrderer,
  submitOrderProof, markPaymentSent, confirmPaymentReceived,
  markOrderDelivered, confirmReceipt, submitReport,
  type Pool, type PoolMember, type PoolOrder,
} from '../services/pools';
import { PlatformBadge, StatusBadge, AmountProgress, Modal, LoadingState, ErrorState } from '../components/ui';
import { PLATFORMS, POOL_STATUS, type PoolStatusKey } from '../lib/constants';
import { formatDistance, haversineDistance } from '../lib/geo';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowLeft, MapPin, Clock, Users, UserCheck, ShieldCheck,
  Upload, CheckCircle2, Phone, MessageCircle, AlertTriangle, Flag,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function PoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [pool, setPool] = useState<Pool | null>(null);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [order, setOrder] = useState<PoolOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showOrderProofModal, setShowOrderProofModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [joinAmount, setJoinAmount] = useState('');
  const [joinProduct, setJoinProduct] = useState('');
  const [proofOrderId, setProofOrderId] = useState('');
  const [proofOrderValue, setProofOrderValue] = useState('');
  const [proofDeliveryTime, setProofDeliveryTime] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <LoadingState message="Loading pool details..." />;
  if (error || !pool) return <ErrorState message={error || 'Pool not found'} onRetry={fetchAll} />;

  const isMember = members.some((m) => m.user_id === profile?.id);
  const isCreator = pool.creator_id === profile?.id;
  const isOrderer = pool.orderer_id === profile?.id;
  const myMembership = members.find((m) => m.user_id === profile?.id);
  const remaining = Math.max(pool.minimum_order_value - pool.current_total, 0);
  const memberCount = members.length;
  const isFull = memberCount >= pool.max_members;
  const canJoin = !isMember && !isFull && (pool.status === 'waiting' || pool.status === 'ready');
  const distanceMeters = profile?.latitude && profile?.longitude
    ? haversineDistance(profile.latitude, profile.longitude, pool.latitude, pool.longitude)
    : null;

  // ─── ACTIONS ────────────────────────────────────────────────────

  async function handleJoin() {
    if (!joinAmount || parseFloat(joinAmount) <= 0 || !joinProduct.trim()) {
      toast.error('Please fill in all fields');
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
      await submitOrderProof(
        pool!.id, profile!.id, proofOrderId.trim(),
        parseFloat(proofOrderValue),
        proofDeliveryTime || new Date(Date.now() + 30 * 60 * 1000).toISOString()
      );
      toast.success('Order proof submitted!');
      setShowOrderProofModal(false);
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
      await markPaymentSent(pool!.id, profile!.id);
      toast.success('Payment marked as sent');
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
            <span className="font-medium">{pool.destination}</span>
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
              <div>
                <p className="text-sm font-medium text-surface-900">
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
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-surface-900">₹{member.contribution}</p>
              {/* Payment status for orderer view */}
              {isOrderer && member.user_id !== profile?.id && (
                <div className="mt-1">
                  {member.payment_status === 'confirmed' ? (
                    <span className="text-xs text-green-600 font-medium">✓ Paid</span>
                  ) : member.payment_status === 'sent' ? (
                    <button
                      onClick={() => handleConfirmPayment(member.id)}
                      className="text-xs text-brand-600 font-medium hover:underline"
                      disabled={actionLoading}
                    >
                      Confirm Payment
                    </button>
                  ) : (
                    <span className="text-xs text-surface-400">Pending</span>
                  )}
                </div>
              )}
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

      {/* Order Info (if placed) */}
      {order && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
            <CheckCircle2 size={16} />
            Order Placed
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-blue-400">Order ID</span>
              <p className="font-mono text-blue-800">{order.external_order_id || '—'}</p>
            </div>
            <div>
              <span className="text-blue-400">Total</span>
              <p className="font-semibold text-blue-800">₹{order.order_value || '—'}</p>
            </div>
            {order.expected_delivery && (
              <div className="col-span-2">
                <span className="text-blue-400">Expected Delivery</span>
                <p className="text-blue-800">{format(new Date(order.expected_delivery), 'PPp')}</p>
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

        {/* Mark Payment Sent (non-orderer members) */}
        {isMember && !isOrderer && myMembership?.payment_status === 'pending' && (status === 'ordering' || status === 'order_placed') && (
          <button onClick={handleMarkPaid} disabled={actionLoading} className="w-full py-3.5 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98] flex items-center justify-center gap-2">
            <ShieldCheck size={18} /> I&apos;ve Paid
          </button>
        )}

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
            <label className="block text-sm font-medium text-surface-700 mb-1.5">What do you need?</label>
            <input type="text" value={joinProduct} onChange={(e) => setJoinProduct(e.target.value)} placeholder="e.g. Snacks" className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Your contribution amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">₹</span>
              <input type="number" value={joinAmount} onChange={(e) => setJoinAmount(e.target.value)} placeholder="30" min="1" className="w-full pl-8 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
          </div>
          <button onClick={handleJoin} disabled={actionLoading} className="w-full py-3.5 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98] disabled:opacity-60">
            {actionLoading ? 'Joining...' : 'Confirm & Join'}
          </button>
          <p className="text-xs text-surface-400 text-center">This is a commitment. You are not transferring money to PoolNear.</p>
        </div>
      </Modal>

      {/* Order Proof Modal */}
      <Modal isOpen={showOrderProofModal} onClose={() => setShowOrderProofModal(false)} title="Submit Order Proof">
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">External Order ID</label>
            <input type="text" value={proofOrderId} onChange={(e) => setProofOrderId(e.target.value)} placeholder="Order #12345" className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Total Order Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">₹</span>
              <input type="number" value={proofOrderValue} onChange={(e) => setProofOrderValue(e.target.value)} placeholder="105" className="w-full pl-8 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Expected Delivery Time</label>
            <input type="datetime-local" value={proofDeliveryTime} onChange={(e) => setProofDeliveryTime(e.target.value)} className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
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
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Additional details (optional)</label>
            <textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} placeholder="Describe what happened..." rows={3} className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none" />
          </div>
          <button onClick={handleReport} disabled={actionLoading} className="w-full py-3.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors active:scale-[0.98] disabled:opacity-60">
            {actionLoading ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
