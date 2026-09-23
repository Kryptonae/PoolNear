// PoolNear — Home Page

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { LocationPermissionCard } from '../components/ui';
import { ShoppingBag, Map, PackagePlus, Users, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

export function HomePage() {
  const { profile } = useAuth();
  const { coordinates, loading: geoLoading, permissionState, requestLocation } = useGeolocation();
  const navigate = useNavigate();

  const hasLocation = coordinates !== null || (profile?.latitude && profile?.longitude);

  useEffect(() => {
    if (profile?.location_permission && !coordinates) {
      requestLocation();
    }
  }, [profile?.location_permission, coordinates, requestLocation]);

  return (
    <div className="animate-fade-in max-w-3xl mx-auto pt-10 lg:pt-16 pb-8">
      
      {!hasLocation && (
        <div className="px-4 mb-8">
          <LocationPermissionCard
            onAllow={requestLocation}
            onSkip={() => {}}
            loading={geoLoading}
            denied={permissionState === 'denied'}
          />
        </div>
      )}

      {/* Compact Hero */}
      <section className="text-center px-4 mb-10">
        <h1 className="text-[28px] leading-[1.1] sm:text-3xl md:text-4xl font-extrabold mb-3 text-surface-900 uppercase">
          Order together. Save time.
        </h1>
        <p className="text-sm text-surface-500 max-w-sm mx-auto font-medium leading-relaxed">
          Share delivery fees and meet store minimums with people nearby.
        </p>
      </section>

      {/* Primary Actions */}
      <section className="px-4 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate('/create')}
          className="group relative overflow-hidden bg-brand-500 rounded-2xl border border-brand-400 p-5 sm:p-6 text-left hover:bg-brand-600 hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-500/20 active:scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShoppingBag size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Create Your Order</h2>
              <p className="text-sm text-brand-100 font-medium mt-1">Start a new group</p>
            </div>
          </div>
          <ArrowRight size={20} className="text-white opacity-80 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-1 shrink-0" />
        </button>

        <button
          onClick={() => navigate('/discover')}
          className="group relative overflow-hidden bg-surface-0 rounded-2xl border-2 border-surface-200 p-5 sm:p-6 text-left hover:border-surface-300 hover:bg-surface-50 hover:-translate-y-1 hover:shadow-sm active:scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Map size={24} className="text-surface-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900 leading-tight">Find Nearby Orders</h2>
              <p className="text-sm text-surface-500 font-medium mt-1">Join an active pool</p>
            </div>
          </div>
          <ArrowRight size={20} className="text-surface-400 group-hover:text-surface-600 transition-all duration-200 group-hover:translate-x-1 shrink-0" />
        </button>
      </section>

      {/* Compact Trust / Value Strip */}
      <section className="px-4 mb-10">
        <div className="bg-surface-50 border border-surface-200 rounded-xl p-3.5 flex items-center justify-center gap-4 sm:gap-8 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-700">
            <ShieldCheck size={14} className="text-brand-500" /> Transparent fees
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-700">
            <Map size={14} className="text-brand-500" /> Local discovery
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-700">
            <CheckCircle2 size={14} className="text-brand-500" /> Separate locations
          </div>
        </div>
      </section>

      {/* Compact How It Works */}
      <section className="px-4 pb-4">
        <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-5 text-center">How It Works</h3>
        <div className="grid grid-cols-3 gap-3 text-center max-w-lg mx-auto">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mb-3">
              <Users size={20} className="text-surface-700" />
            </div>
            <h4 className="text-xs font-bold text-surface-900 leading-tight">1. Create or Join</h4>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mb-3">
              <PackagePlus size={20} className="text-surface-700" />
            </div>
            <h4 className="text-xs font-bold text-surface-900 leading-tight">2. Add Items</h4>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-3 text-brand-600">
              <CheckCircle2 size={20} />
            </div>
            <h4 className="text-xs font-bold text-surface-900 leading-tight">3. Order Placed</h4>
          </div>
        </div>
      </section>
      
    </div>
  );
}
