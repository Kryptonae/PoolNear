// ═══════════════════════════════════════════════════════════════════
// PoolNear — Dashboard Page
// User's requirements, active pools, joined pools, completed pools
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getMyCreatedPools, getMyJoinedPools, getMyRequirements,
  type Pool, type Requirement,
} from '../services/pools';
import { PoolCard, EmptyState, SkeletonCard, ErrorState } from '../components/ui';
import { LayoutDashboard, Package, Users, CheckCircle2, Clock, Plus, ChevronRight } from 'lucide-react';

type TabKey = 'requirements' | 'active' | 'completed';

interface JoinedPoolData {
  membership: Record<string, unknown>;
  pool: Pool;
}

export function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [createdPools, setCreatedPools] = useState<Pool[]>([]);
  const [joinedPools, setJoinedPools] = useState<JoinedPoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [reqs, created, joined] = await Promise.all([
        getMyRequirements(profile.id),
        getMyCreatedPools(profile.id),
        getMyJoinedPools(profile.id),
      ]);
      setRequirements(reqs);
      setCreatedPools(created);
      setJoinedPools(joined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive pool lists
  const activeStatuses = new Set(['waiting', 'ready', 'ordering', 'order_placed', 'delivering', 'delivered']);
  const completedStatuses = new Set(['completed']);

  const allPools = [
    ...createdPools.map((p) => ({ pool: p, role: 'creator' as const })),
    ...joinedPools
      .filter((jp) => !createdPools.some((cp) => cp.id === jp.pool?.id))
      .map((jp) => ({ pool: jp.pool, role: 'member' as const })),
  ].filter((item) => item.pool);

  const activePools = allPools.filter((item) => activeStatuses.has(item.pool.status));
  const completedPools = allPools.filter((item) => completedStatuses.has(item.pool.status));
  const activeRequirements = requirements.filter((r) => r.status === 'active');

  const tabs: { key: TabKey; label: string; count: number; icon: typeof Package }[] = [
    { key: 'active', label: 'Active', count: activePools.length, icon: Users },
    { key: 'requirements', label: 'Requirements', count: activeRequirements.length, icon: Package },
    { key: 'completed', label: 'Completed', count: completedPools.length, icon: CheckCircle2 },
  ];

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <LayoutDashboard size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900">My Pools</h1>
            <p className="text-sm text-surface-500">
              {activePools.length} active · {completedPools.length} completed
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/create')}
          className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors active:scale-95"
          aria-label="Create new pool"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-surface-200 p-3 text-center">
          <p className="text-2xl font-bold text-brand-600">{activePools.length}</p>
          <p className="text-xs text-surface-500 font-medium mt-0.5">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-3 text-center">
          <p className="text-2xl font-bold text-surface-900">{allPools.length}</p>
          <p className="text-xs text-surface-500 font-medium mt-0.5">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{completedPools.length}</p>
          <p className="text-xs text-surface-500 font-medium mt-0.5">Completed</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-surface-200 text-surface-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <ErrorState message={error} onRetry={fetchData} />
      )}

      {/* Active Pools Tab */}
      {!loading && !error && activeTab === 'active' && (
        <>
          {activePools.length === 0 ? (
            <EmptyState
              icon={<Users size={28} />}
              title="No active pools"
              description="Create a requirement or discover nearby pools to get started."
              action={
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/create')}
                    className="px-5 py-2.5 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-95"
                  >
                    Create Pool
                  </button>
                  <button
                    onClick={() => navigate('/discover')}
                    className="px-5 py-2.5 bg-surface-100 text-surface-700 rounded-xl font-medium hover:bg-surface-200 transition-colors"
                  >
                    Discover
                  </button>
                </div>
              }
            />
          ) : (
            <div className="space-y-3">
              {activePools.map((item) => (
                <PoolCard
                  key={item.pool.id}
                  pool={item.pool}
                  onClick={() => navigate(`/pool/${item.pool.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Requirements Tab */}
      {!loading && !error && activeTab === 'requirements' && (
        <>
          {requirements.length === 0 ? (
            <EmptyState
              icon={<Package size={28} />}
              title="No requirements yet"
              description="Create a requirement to find people nearby who want to pool orders."
              action={
                <button
                  onClick={() => navigate('/create')}
                  className="px-6 py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-95"
                >
                  + Create Requirement
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {requirements.map((req) => (
                <button
                  key={req.id}
                  onClick={() => req.pool_id ? navigate(`/pool/${req.pool_id}`) : undefined}
                  className="w-full text-left bg-white rounded-2xl border border-surface-200 p-4 hover:border-brand-300 hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-surface-900">{req.product_description}</p>
                      <p className="text-sm text-surface-500 mt-0.5">₹{req.amount} · Qty {req.quantity}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      req.status === 'active' ? 'bg-amber-100 text-amber-700' :
                      req.status === 'matched' ? 'bg-green-100 text-green-700' :
                      req.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-surface-100 text-surface-500'
                    }`}>
                      {req.status === 'active' ? '🔍 Searching' :
                       req.status === 'matched' ? '✅ Matched' :
                       req.status === 'fulfilled' ? '🎉 Fulfilled' :
                       req.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-surface-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Required by {new Date(req.required_by).toLocaleDateString()}
                    </span>
                    {req.pool_id && (
                      <span className="flex items-center gap-0.5 text-brand-600 font-medium">
                        View Pool <ChevronRight size={12} />
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Completed Pools Tab */}
      {!loading && !error && activeTab === 'completed' && (
        <>
          {completedPools.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={28} />}
              title="No completed pools yet"
              description="Complete your first pool to see it here. Your trust score will grow!"
            />
          ) : (
            <div className="space-y-3">
              {completedPools.map((item) => (
                <PoolCard
                  key={item.pool.id}
                  pool={item.pool}
                  onClick={() => navigate(`/pool/${item.pool.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
