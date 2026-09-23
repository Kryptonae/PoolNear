// PoolNear — Home Page

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { LocationPermissionCard } from '../components/ui';
import { ShoppingBag, Map, Search, PackagePlus, Users, CheckCircle2, ArrowRight, ShieldCheck, Check } from 'lucide-react';

export function HomePage() {
  const { profile } = useAuth();
  const { coordinates, loading: geoLoading, permissionState, requestLocation } = useGeolocation();
  const navigate = useNavigate();

  const hasLocation = coordinates !== null || (profile?.latitude && profile?.longitude);

  // Try to get location on mount if previously granted
  useEffect(() => {
    if (profile?.location_permission && !coordinates) {
      requestLocation();
    }
  }, [profile?.location_permission, coordinates, requestLocation]);

  return (
    <div className="animate-fade-in pb-12 space-y-8 max-w-3xl mx-auto pt-2 lg:pt-6">
      
      {/* Location Permission - Only show if not granted */}
      {!hasLocation && (
        <LocationPermissionCard
          onAllow={requestLocation}
          onSkip={() => {}}
          loading={geoLoading}
          denied={permissionState === 'denied'}
        />
      )}

      {/* Hero Section */}
      <section className="text-center px-4 pt-4 pb-2">
        <h1 className="text-title-1 mb-3 text-surface-900 tracking-tight">
          Order together.<br className="md:hidden" /> Save together.
        </h1>
        <p className="text-body text-surface-500 max-w-lg mx-auto leading-relaxed">
          Create a group order or find nearby people ordering the same way to save on delivery fees and meet store minimums.
        </p>
      </section>

      {/* Primary Actions */}
      <section className="px-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Create Order - Primary Action */}
        <button
          onClick={() => navigate('/create')}
          className="group relative overflow-hidden bg-brand-500 rounded-2xl border border-brand-400 p-6 text-left hover:bg-brand-600 transition-all duration-300 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shadow-xl shadow-brand-500/10 flex flex-col h-full"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingBag size={24} className="text-white" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">Create Your Order</h2>
          <p className="text-sm text-brand-50 font-medium opacity-90 flex-1">
            Start a new group order and invite people nearby.
          </p>
          <div className="mt-6 flex items-center justify-between text-white font-bold text-sm group-hover:translate-x-1 transition-transform">
            <span>Start</span>
            <ArrowRight size={18} />
          </div>
        </button>

        {/* View Nearby Orders - Secondary Action */}
        <button
          onClick={() => navigate('/discover')}
          className="group relative overflow-hidden bg-surface-0 rounded-2xl border-2 border-surface-200 p-6 text-left hover:border-surface-300 hover:bg-surface-50 transition-all duration-300 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shadow-sm flex flex-col h-full"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Map size={24} className="text-surface-700" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-surface-900 mb-1.5">View Nearby Orders</h2>
          <p className="text-sm text-surface-500 font-medium flex-1">
            See active orders near you and join one easily.
          </p>
          <div className="mt-6 flex items-center justify-between text-surface-900 font-bold text-sm group-hover:translate-x-1 transition-transform">
            <span>View</span>
            <ArrowRight size={18} />
          </div>
        </button>
      </section>

      {/* How PoolNear Works */}
      <section className="px-4 pt-6">
        <h3 className="text-sm font-bold text-surface-900 uppercase tracking-wider mb-4 px-2">How It Works</h3>
        <div className="card divide-y divide-surface-100">
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center shrink-0">
              <Search size={18} className="text-surface-700" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-surface-900">1. Find or Create</h4>
              <p className="text-xs text-surface-500 mt-0.5">Discover a nearby pool or start your own.</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center shrink-0">
              <PackagePlus size={18} className="text-surface-700" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-surface-900">2. Add Products</h4>
              <p className="text-xs text-surface-500 mt-0.5">List exactly what you want to order.</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center shrink-0">
              <Users size={18} className="text-surface-700" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-surface-900">3. Group Together</h4>
              <p className="text-xs text-surface-500 mt-0.5">Meet store minimums as a community.</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} className="text-brand-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-surface-900">4. Order Placed</h4>
              <p className="text-xs text-surface-500 mt-0.5">Save on fees and pick up your items.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Value Section */}
      <section className="px-4 pt-2">
        <div className="card p-5 bg-surface-50 border border-surface-200">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={20} className="text-surface-700" />
            <h3 className="text-sm font-bold text-surface-900">Why PoolNear?</h3>
          </div>
          <ul className="space-y-2.5">
            {[
              'Clear order details',
              'Nearby order discovery',
              'Simple group ordering',
              'Individual receiving locations'
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                  <Check size={10} className="text-brand-600" />
                </div>
                <span className="text-sm text-surface-700 font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      
    </div>
  );
}
