// ═══════════════════════════════════════════════════════════════════
// PoolNear — Discover Page (Pools Near You)
// Full pool discovery with filters
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getNearbyPools, type PoolWithDistance } from '../services/pools';
import { PoolCard, EmptyState, SkeletonCard, ErrorState } from '../components/ui';
import { PLATFORM_LIST, RADIUS_OPTIONS, type PlatformKey, type PoolStatusKey } from '../lib/constants';
import { Search, SlidersHorizontal, X } from 'lucide-react';

export function DiscoverPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [pools, setPools] = useState<PoolWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [platformFilter, setPlatformFilter] = useState<PlatformKey | ''>('');
  const [statusFilter, setStatusFilter] = useState<PoolStatusKey | ''>('');
  const [radiusFilter, setRadiusFilter] = useState(profile?.preferred_radius || 500);
  const [searchQuery, setSearchQuery] = useState('');

  const lat = profile?.latitude || 0;
  const lng = profile?.longitude || 0;
  const hasLocation = lat !== 0 || lng !== 0;

  const fetchPools = useCallback(async () => {
    if (!hasLocation) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getNearbyPools(
        lat,
        lng,
        radiusFilter,
        platformFilter || undefined,
        statusFilter || undefined
      );
      setPools(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radiusFilter, platformFilter, statusFilter, hasLocation]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const filteredPools = searchQuery
    ? pools.filter((p) =>
        p.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.platform.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pools;

  const activeFilterCount = (platformFilter ? 1 : 0) + (radiusFilter !== 500 ? 1 : 0) + (statusFilter ? 1 : 0);

  return (
    <div className="px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-surface-900">Pools Near You</h1>

      {/* Search & Filter Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search pools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative px-3.5 py-2.5 rounded-xl border transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-brand-50 border-brand-300 text-brand-600'
              : 'bg-white border-surface-200 text-surface-500 hover:border-surface-300'
          }`}
          aria-label="Toggle filters"
        >
          <SlidersHorizontal size={18} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-surface-200 p-4 space-y-4 animate-slide-down">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-surface-900 text-sm">Filters</h3>
            <button
              onClick={() => {
                setPlatformFilter('');
                setStatusFilter('');
                setRadiusFilter(500);
              }}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Reset All
            </button>
          </div>

          {/* Platform Filter */}
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-2">Platform</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPlatformFilter('')}
                className={`chip ${!platformFilter ? 'active' : ''}`}
              >
                All
              </button>
              {PLATFORM_LIST.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPlatformFilter(p.key)}
                  className={`chip ${platformFilter === p.key ? 'active' : ''}`}
                >
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('')}
                className={`chip ${!statusFilter ? 'active' : ''}`}
              >
                Accepting
              </button>
              <button
                onClick={() => setStatusFilter('ordering')}
                className={`chip ${statusFilter === 'ordering' ? 'active' : ''}`}
              >
                Ordering
              </button>
              <button
                onClick={() => setStatusFilter('delivered')}
                className={`chip ${statusFilter === 'delivered' ? 'active' : ''}`}
              >
                Delivered
              </button>
            </div>
          </div>

          {/* Radius Filter */}
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-2">Distance</label>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRadiusFilter(opt.value)}
                  className={`chip ${radiusFilter === opt.value ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2">
          {platformFilter && (
            <span className="chip active text-xs">
              {PLATFORM_LIST.find((p) => p.key === platformFilter)?.icon}{' '}
              {PLATFORM_LIST.find((p) => p.key === platformFilter)?.label}
              <button onClick={() => setPlatformFilter('')} className="ml-1 hover:text-red-500">
                <X size={12} />
              </button>
            </span>
          )}
          {radiusFilter !== 500 && (
            <span className="chip active text-xs">
              📍 {RADIUS_OPTIONS.find((r) => r.value === radiusFilter)?.label}
              <button onClick={() => setRadiusFilter(500)} className="ml-1 hover:text-red-500">
                <X size={12} />
              </button>
            </span>
          )}
          {statusFilter && (
            <span className="chip active text-xs">
              {statusFilter === 'ordering' ? '🛒 Ordering' : statusFilter === 'delivered' ? '📦 Delivered' : statusFilter}
              <button onClick={() => setStatusFilter('')} className="ml-1 hover:text-red-500">
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Results Count */}
      {!loading && !error && (
        <p className="text-sm text-surface-500">
          {filteredPools.length} pool{filteredPools.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <ErrorState message={error} onRetry={fetchPools} />
      )}

      {/* Empty */}
      {!loading && !error && filteredPools.length === 0 && (
        <EmptyState
          title="No pools found"
          description={searchQuery ? 'Try different search terms or adjust your filters.' : 'No active pools in this area. Create one!'}
          action={
            <button
              onClick={() => navigate('/create')}
              className="px-6 py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98]"
            >
              + Create New Pool
            </button>
          }
        />
      )}

      {/* Pool Cards */}
      {!loading && !error && filteredPools.length > 0 && (
        <div className="space-y-3">
          {filteredPools.map((pool) => (
            <PoolCard
              key={pool.pool_id}
              pool={{
                id: pool.pool_id,
                platform: pool.platform,
                platform_other: pool.platform_other,
                minimum_order_value: pool.minimum_order_value,
                current_total: pool.current_total,
                max_members: pool.max_members,
                destination: pool.destination,
                status: pool.status,
                required_by: pool.required_by,
                expires_at: pool.expires_at,
              }}
              distanceMeters={pool.distance_meters}
              memberCount={Number(pool.member_count)}
              onClick={() => navigate(`/pool/${pool.pool_id}`)}
            />
          ))}
        </div>
      )}

      {!hasLocation && (
        <EmptyState
          title="Location required"
          description="Enable location access to discover pools near you."
        />
      )}
    </div>
  );
}
