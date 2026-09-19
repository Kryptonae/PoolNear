// ═══════════════════════════════════════════════════════════════════
// PoolNear — Home Page
// Location permission, nearby pools preview, and main CTA
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { getNearbyPools, type PoolWithDistance } from '../services/pools';
import { PoolCard, LocationPermissionCard, EmptyState, SkeletonCard, ErrorState } from '../components/ui';
import { APP_NAME, RADIUS_OPTIONS } from '../lib/constants';
import { MapPin, Plus, ArrowRight, Sparkles, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

export function HomePage() {
  const { profile, updateProfile } = useAuth();
  const { coordinates, loading: geoLoading, error: geoError, permissionState, requestLocation } = useGeolocation();
  const navigate = useNavigate();

  const [pools, setPools] = useState<PoolWithDistance[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [poolsError, setPoolsError] = useState<string | null>(null);
  const [showRadiusMenu, setShowRadiusMenu] = useState(false);

  const radius = profile?.preferred_radius || 500;
  const hasLocation = coordinates !== null || (profile?.latitude && profile?.longitude);
  const lat = coordinates?.latitude || profile?.latitude || 0;
  const lng = coordinates?.longitude || profile?.longitude || 0;

  const fetchPools = useCallback(async () => {
    if (!hasLocation) return;
    setPoolsLoading(true);
    setPoolsError(null);
    try {
      const data = await getNearbyPools(lat, lng, radius);
      setPools(data);
    } catch (err) {
      setPoolsError((err as Error).message);
    } finally {
      setPoolsLoading(false);
    }
  }, [lat, lng, radius, hasLocation]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Try to get location on mount if previously granted
  useEffect(() => {
    if (profile?.location_permission && !coordinates) {
      requestLocation();
    }
  }, [profile?.location_permission]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRadiusChange(newRadius: number) {
    setShowRadiusMenu(false);
    await updateProfile({ preferred_radius: newRadius });
    toast.success(`Radius updated to ${newRadius >= 1000 ? `${newRadius / 1000} km` : `${newRadius} m`}`);
  }

  const radiusLabel = radius >= 1000 ? `${radius / 1000} km` : `${radius} m`;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Location Permission */}
      {!hasLocation && (
        <LocationPermissionCard
          onAllow={requestLocation}
          onSkip={() => {}}
          loading={geoLoading}
          denied={permissionState === 'denied'}
        />
      )}

      {/* Location & Radius Header */}
      {hasLocation && (
        <div className="bg-white rounded-2xl border border-surface-200 p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                <MapPin size={20} className="text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-900">
                  📍 {profile?.area || 'Your Location'}
                </p>
                <p className="text-xs text-surface-500">
                  Matching radius: <span className="font-semibold text-brand-600">{radiusLabel}</span>
                </p>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowRadiusMenu(!showRadiusMenu)}
                className="px-3 py-1.5 text-sm font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors flex items-center gap-1"
              >
                Change <ChevronDown size={14} />
              </button>
              {showRadiusMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRadiusMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-white border border-surface-200 rounded-xl shadow-lg z-50 py-1 w-36 animate-scale-in">
                    {RADIUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleRadiusChange(opt.value)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-50 transition-colors ${
                          opt.value === radius ? 'text-brand-600 font-semibold bg-brand-50/50' : 'text-surface-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Smart Match Banner (shown if there's a perfect match pool) */}
      {hasLocation && pools.length > 0 && pools[0].minimum_order_value - pools[0].current_total <= 30 && (
        <button
          onClick={() => navigate(`/pool/${pools[0].pool_id}`)}
          className="w-full bg-gradient-to-r from-brand-500 to-emerald-500 rounded-2xl p-4 text-white text-left hover:shadow-lg hover:shadow-brand-500/20 transition-all active:scale-[0.98] animate-slide-up"
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} />
            <span className="text-sm font-semibold opacity-90">Perfect Match Found 🎯</span>
          </div>
          <p className="text-sm opacity-80">
            A pool near you needs only ₹{Math.max(pools[0].minimum_order_value - pools[0].current_total, 0).toFixed(0)} more
          </p>
          <div className="flex items-center gap-1 mt-2 text-sm font-semibold">
            View Pool <ArrowRight size={14} />
          </div>
        </button>
      )}

      {/* Create CTA */}
      {hasLocation && (
        <button
          onClick={() => navigate('/create')}
          className="w-full bg-white rounded-2xl border-2 border-dashed border-surface-300 p-5 flex items-center justify-center gap-3 text-surface-600 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/30 transition-all active:scale-[0.98] group"
        >
          <div className="w-10 h-10 rounded-xl bg-surface-100 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
            <Plus size={22} className="group-hover:text-brand-600 transition-colors" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">Create Requirement</p>
            <p className="text-xs text-surface-400">Need something? Find people nearby to pool with</p>
          </div>
        </button>
      )}

      {/* Nearby Pools Section */}
      {hasLocation && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-surface-900">Pools Near You</h2>
            {pools.length > 0 && (
              <button
                onClick={() => navigate('/discover')}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-0.5"
              >
                See All <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Loading */}
          {poolsLoading && (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Error */}
          {poolsError && !poolsLoading && (
            <ErrorState message={poolsError} onRetry={fetchPools} />
          )}

          {/* Empty */}
          {!poolsLoading && !poolsError && pools.length === 0 && (
            <EmptyState
              title="No pools nearby right now"
              description="Be the first! Create a requirement and others nearby will find you."
              action={
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <button
                    onClick={() => navigate('/create')}
                    className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98]"
                  >
                    + Create New Pool
                  </button>
                  <button
                    onClick={() => handleRadiusChange(Math.min(radius * 2, 2000))}
                    className="w-full py-3 text-surface-600 bg-surface-100 rounded-xl font-medium hover:bg-surface-200 transition-colors"
                  >
                    Expand Radius to {Math.min(radius * 2, 2000) >= 1000 ? `${Math.min(radius * 2, 2000) / 1000} km` : `${Math.min(radius * 2, 2000)} m`}
                  </button>
                </div>
              }
            />
          )}

          {/* Pool Cards */}
          {!poolsLoading && !poolsError && pools.length > 0 && (
            <div className="space-y-3">
              {pools.slice(0, 5).map((pool) => (
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
        </section>
      )}

      {/* Geo Error Toast */}
      {geoError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">Location Error</p>
          <p className="text-amber-600">{geoError}</p>
        </div>
      )}
    </div>
  );
}
