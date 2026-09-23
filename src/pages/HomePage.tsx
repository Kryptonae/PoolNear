// ═══════════════════════════════════════════════════════════════════
// PoolNear — Home Page
// Location permission and main Create/Discover CTA
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { getNotifications } from '../services/pools';
import { LocationPermissionCard } from '../components/ui';
import { RADIUS_OPTIONS } from '../lib/constants';
import { MapPin, Bell, ChevronDown, ShoppingBag, Map, Search, PackagePlus, Users, CheckCircle2, Check, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export function HomePage() {
  const { profile, updateProfile } = useAuth();
  const { coordinates, loading: geoLoading, error: geoError, permissionState, requestLocation } = useGeolocation();
  const navigate = useNavigate();

  const [showRadiusMenu, setShowRadiusMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const radius = profile?.preferred_radius || 500;
  const hasLocation = coordinates !== null || (profile?.latitude && profile?.longitude);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const notifs = await getNotifications(profile.id);
      setUnreadCount(notifs.filter((n: Record<string, unknown>) => !n.read).length);
    } catch {
      // Silent fail for notifications count
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-8 animate-fade-in">
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
        <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-sm animate-slide-up">
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
            <div className="flex items-center gap-2">
              {/* Notification Bell */}
              <button
                onClick={() => navigate('/dashboard')}
                className="relative w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-surface-500 hover:bg-surface-200 transition-colors"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {/* Radius Menu */}
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
        </div>
      )}

      {/* Hero Section */}
      <section className="text-center py-6 md:py-10 space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold text-surface-900 tracking-tight">
          Group your order.<br className="hidden md:block" /> Save more. Order together.
        </h1>
        <p className="text-surface-600 text-base md:text-lg max-w-xl mx-auto">
          Create a group order or find people nearby who are already ordering.
        </p>
      </section>

      {/* Two Primary Actions */}
      {hasLocation && (
        <section className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/create')}
            className="group relative overflow-hidden bg-white rounded-3xl border border-surface-200 p-6 md:p-8 text-left hover:border-brand-300 hover:shadow-xl hover:shadow-brand-500/10 transition-all duration-300 active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-x-4 group-hover:translate-x-0 text-brand-500">
              <ArrowRight size={24} />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <ShoppingBag size={28} className="text-brand-600" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-surface-900 mb-2">Create Your Order</h2>
            <p className="text-surface-500 text-sm md:text-base leading-relaxed">
              Start a group order and invite people nearby.
            </p>
          </button>

          <button
            onClick={() => navigate('/discover')}
            className="group relative overflow-hidden bg-surface-900 rounded-3xl border border-surface-800 p-6 md:p-8 text-left hover:border-surface-700 hover:shadow-xl hover:shadow-surface-900/20 transition-all duration-300 active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-x-4 group-hover:translate-x-0 text-surface-400">
              <ArrowRight size={24} />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-surface-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Map size={28} className="text-white" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Find Nearby Orders</h2>
            <p className="text-surface-400 text-sm md:text-base leading-relaxed">
              Discover active group orders near your location.
            </p>
          </button>
        </section>
      )}

      {/* How PoolNear Works - Poster Section */}
      <section className="bg-surface-50 rounded-3xl p-6 md:p-8 mt-4 border border-surface-100">
        <h3 className="text-lg font-bold text-surface-900 mb-8 text-center">How PoolNear Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative">
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-0.5 bg-surface-200 -z-0" />
          
          <div className="relative z-10 flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-surface-200 flex items-center justify-center mb-3 shadow-sm group-hover:border-brand-300 group-hover:text-brand-600 transition-colors">
              <Search size={20} />
            </div>
            <h4 className="font-semibold text-surface-900 mb-1">Create / Find</h4>
            <p className="text-xs text-surface-500">Start or join an order</p>
          </div>
          
          <div className="relative z-10 flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-surface-200 flex items-center justify-center mb-3 shadow-sm group-hover:border-brand-300 group-hover:text-brand-600 transition-colors">
              <PackagePlus size={20} />
            </div>
            <h4 className="font-semibold text-surface-900 mb-1">Add products</h4>
            <p className="text-xs text-surface-500">List what you need</p>
          </div>
          
          <div className="relative z-10 flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-surface-200 flex items-center justify-center mb-3 shadow-sm group-hover:border-brand-300 group-hover:text-brand-600 transition-colors">
              <Users size={20} />
            </div>
            <h4 className="font-semibold text-surface-900 mb-1">Join together</h4>
            <p className="text-xs text-surface-500">Meet minimums together</p>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-surface-200 flex items-center justify-center mb-3 shadow-sm group-hover:border-brand-300 group-hover:text-brand-600 transition-colors">
              <CheckCircle2 size={20} />
            </div>
            <h4 className="font-semibold text-surface-900 mb-1">Complete order</h4>
            <p className="text-xs text-surface-500">Place order & receive</p>
          </div>
        </div>
      </section>

      {/* Why PoolNear - Trust Section */}
      <section className="pt-2 pb-6">
        <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center mb-6">
          Why PoolNear?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 md:px-0">
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-surface-100 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Check size={16} className="text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-surface-700">Clear order details</span>
          </div>
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-surface-100 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Check size={16} className="text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-surface-700">Location-aware discovery</span>
          </div>
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-surface-100 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Check size={16} className="text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-surface-700">Simple group ordering</span>
          </div>
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-surface-100 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Check size={16} className="text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-surface-700">Transparent participation</span>
          </div>
        </div>
      </section>

      {/* Geo Error Toast */}
      {geoError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 animate-slide-up">
          <p className="font-medium mb-1">Location Error</p>
          <p className="text-amber-600">{geoError}</p>
        </div>
      )}
    </div>
  );
}
