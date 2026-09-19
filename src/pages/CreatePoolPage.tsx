// ═══════════════════════════════════════════════════════════════════
// PoolNear — Create Pool / Requirement Page
// Form for creating a new pool with all required fields
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createPool } from '../services/pools';
import { PLATFORM_LIST, TIME_OPTIONS, RADIUS_OPTIONS, DESTINATION_PRESETS, DEFAULT_MIN_ORDER, DEFAULT_MAX_MEMBERS, type PlatformKey } from '../lib/constants';
import { ArrowLeft, Package, IndianRupee, Clock, MapPin, Users, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export function CreatePoolPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [productDescription, setProductDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [platform, setPlatform] = useState<PlatformKey | ''>('');
  const [platformOther, setPlatformOther] = useState('');
  const [minOrderValue, setMinOrderValue] = useState(DEFAULT_MIN_ORDER.toString());
  const [timeOption, setTimeOption] = useState('1hr');
  const [maxDistance, setMaxDistance] = useState(500);
  const [destination, setDestination] = useState('');
  const [customDestination, setCustomDestination] = useState('');
  const [maxMembers, setMaxMembers] = useState(DEFAULT_MAX_MEMBERS);
  const [submitting, setSubmitting] = useState(false);

  const hasLocation = profile?.latitude && profile?.longitude;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Validation
    if (!productDescription.trim()) {
      toast.error('What do you need? Please describe your item.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    if (!platform) {
      toast.error('Please select an ordering platform.');
      return;
    }
    if (platform === 'other' && !platformOther.trim()) {
      toast.error('Please enter the platform name.');
      return;
    }
    if (!destination && !customDestination.trim()) {
      toast.error('Please select a receiving location.');
      return;
    }
    if (!hasLocation) {
      toast.error('Location is required to create a pool. Please enable location access.');
      return;
    }

    const selectedTime = TIME_OPTIONS.find((t) => t.key === timeOption);
    if (!selectedTime) {
      toast.error('Please select when you need this.');
      return;
    }

    const expiresAt = selectedTime.getExpiry();
    const finalDestination = destination === 'custom' ? customDestination : destination;

    setSubmitting(true);
    try {
      const pool = await createPool(
        {
          product_description: productDescription.trim(),
          amount: parseFloat(amount),
          quantity,
          platform: platform as PlatformKey,
          platform_other: platform === 'other' ? platformOther.trim() : undefined,
          minimum_order_value: parseFloat(minOrderValue) || DEFAULT_MIN_ORDER,
          required_by: expiresAt.toISOString(),
          maximum_distance: maxDistance,
          latitude: profile!.latitude!,
          longitude: profile!.longitude!,
          destination: finalDestination,
          max_members: maxMembers,
          expires_at: expiresAt.toISOString(),
        },
        profile!.id
      );

      toast.success('Pool created! Waiting for nearby matches.');
      navigate(`/pool/${pool.id}`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create pool');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-surface-600 hover:bg-surface-200 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-surface-900">Create Requirement</h1>
          <p className="text-sm text-surface-500">Find people nearby to pool with</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* What do you need? */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-surface-700">
            <Package size={16} />
            What do you need?
          </label>
          <input
            type="text"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder="e.g. Blanket, Shampoo, Snacks..."
            className="w-full px-4 py-3 bg-white border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            required
          />
        </div>

        {/* Amount & Quantity */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-surface-700">
              <IndianRupee size={16} />
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 font-medium">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25"
                min="1"
                className="w-full pl-8 pr-4 py-3 bg-white border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-surface-700">Quantity</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-11 rounded-xl border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-surface-50 transition-colors text-lg"
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                className="flex-1 text-center py-3 bg-white border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-11 rounded-xl border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-surface-50 transition-colors text-lg"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Platform Selection */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-surface-700">Where are you ordering from?</label>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_LIST.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlatform(p.key)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  platform === p.key
                    ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                    : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'
                }`}
              >
                <span className="text-base">{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
          {platform === 'other' && (
            <input
              type="text"
              value={platformOther}
              onChange={(e) => setPlatformOther(e.target.value)}
              placeholder="Platform name"
              className="w-full px-4 py-3 bg-white border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all mt-2"
            />
          )}
        </div>

        {/* Minimum Order Value */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-surface-700">Minimum order value</label>
          <div className="flex gap-2">
            {[49, 99, 149, 199].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setMinOrderValue(val.toString())}
                className={`chip ${minOrderValue === val.toString() ? 'active' : ''}`}
              >
                ₹{val}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 font-medium">₹</span>
            <input
              type="number"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
              placeholder="99"
              min="1"
              className="w-full pl-8 pr-4 py-3 bg-white border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            />
          </div>
        </div>

        {/* Required By */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-surface-700">
            <Clock size={16} />
            Required by
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTimeOption(t.key)}
                className={`chip ${timeOption === t.key ? 'active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Maximum Distance */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-surface-700">
            <MapPin size={16} />
            Maximum distance
          </label>
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaxDistance(opt.value)}
                className={`chip ${maxDistance === opt.value ? 'active' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-surface-700">Common receiving location</label>
          <div className="flex flex-wrap gap-2">
            {DESTINATION_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDestination(d); setCustomDestination(''); }}
                className={`chip ${destination === d ? 'active' : ''}`}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDestination('custom')}
              className={`chip ${destination === 'custom' ? 'active' : ''}`}
            >
              Custom
            </button>
          </div>
          {destination === 'custom' && (
            <input
              type="text"
              value={customDestination}
              onChange={(e) => setCustomDestination(e.target.value)}
              placeholder="Enter public location"
              className="w-full px-4 py-3 bg-white border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            />
          )}
        </div>

        {/* Max Members */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-surface-700">
            <Users size={16} />
            Maximum pool members: <span className="text-brand-600">{maxMembers}</span>
          </label>
          <input
            type="range"
            min="2"
            max="10"
            value={maxMembers}
            onChange={(e) => setMaxMembers(parseInt(e.target.value))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-xs text-surface-400">
            <span>2</span>
            <span>10</span>
          </div>
        </div>

        {/* Location warning */}
        {!hasLocation && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-medium">📍 Location required</p>
            <p className="text-amber-600 mt-1">Please enable location access from the home screen before creating a pool.</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !hasLocation}
          className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:from-brand-600 hover:to-brand-700 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Creating Pool...
            </>
          ) : (
            <>
              Create Pool <ChevronRight size={18} />
            </>
          )}
        </button>

        {/* Disclaimer */}
        <p className="text-center text-xs text-surface-400 leading-relaxed">
          By creating a pool, you agree to coordinate with nearby users. PoolNear does not hold or transfer money.
        </p>
      </form>
    </div>
  );
}
