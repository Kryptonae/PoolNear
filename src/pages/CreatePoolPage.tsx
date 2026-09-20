// ═══════════════════════════════════════════════════════════════════
// PoolNear — Create Pool / Requirement Page
// Form for creating a new pool with all required fields
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createPool, getNearbyPools, joinPool } from '../services/pools';
import { findBestMatches, getMatchQuality, type MatchCandidate } from '../services/matching';
import { PLATFORM_LIST, TIME_OPTIONS, RADIUS_OPTIONS, DEFAULT_MIN_ORDER, DEFAULT_MAX_MEMBERS, type PlatformKey } from '../lib/constants';
import { ArrowLeft, Package, Clock, MapPin, Users, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function CreatePoolPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState([{ name: '', unit_price: '', quantity: '1' }]);
  const [platform, setPlatform] = useState<PlatformKey | ''>('');
  const [platformOther, setPlatformOther] = useState('');
  const [minOrderValue, setMinOrderValue] = useState(DEFAULT_MIN_ORDER.toString());
  const [timeOption, setTimeOption] = useState('1hr');
  const [customMinutes, setCustomMinutes] = useState('10');
  const [maxDistance, setMaxDistance] = useState(500);
  const [maxMembers, setMaxMembers] = useState(DEFAULT_MAX_MEMBERS);
  const [submitting, setSubmitting] = useState(false);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const hasLocation = profile?.latitude && profile?.longitude;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Validation
    const invalidItem = items.find(i => !i.name.trim() || !i.unit_price || parseFloat(i.unit_price) <= 0);
    if (invalidItem) {
      toast.error('Please enter valid details for all items (name and price > 0).');
      return;
    }
    const parsedItems = items.map(i => ({ name: i.name.trim(), unit_price: parseFloat(i.unit_price), quantity: parseInt(i.quantity) || 1 }));
    const totalAmount = parsedItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    if (!platform) {
      toast.error('Please select an ordering platform.');
      return;
    }
    if (platform === 'other' && !platformOther.trim()) {
      toast.error('Please enter the platform name.');
      return;
    }
    if (!hasLocation) {
      toast.error('Location is required to create a pool. Please enable location access.');
      return;
    }

    let expiresAt: Date;
    if (timeOption === 'custom') {
      const mins = parseInt(customMinutes);
      if (isNaN(mins) || mins < 1 || mins > 1440) {
        toast.error('Please enter a valid time between 1 and 1440 minutes.');
        return;
      }
      expiresAt = new Date(Date.now() + mins * 60 * 1000);
    } else {
      const selectedTime = TIME_OPTIONS.find((t) => t.key === timeOption);
      if (!selectedTime) {
        toast.error('Please select when you need this.');
        return;
      }
      expiresAt = selectedTime.getExpiry();
    }

    setSubmitting(true);
    try {
      // 1. Check for matches first
      const nearby = await getNearbyPools(profile!.latitude!, profile!.longitude!, maxDistance, platform as PlatformKey, 'waiting');
      const foundMatches = findBestMatches(nearby, {
        platform: platform as PlatformKey,
        amount: totalAmount,
        latitude: profile!.latitude!,
        longitude: profile!.longitude!,
        maximumDistance: maxDistance,
        requiredBy: expiresAt.toISOString(),
        minimumOrderValue: parseFloat(minOrderValue) || DEFAULT_MIN_ORDER,
      });

      if (foundMatches.length > 0) {
        setMatches(foundMatches);
        setShowMatchModal(true);
        setSubmitting(false);
        return;
      }
      
      // If no matches, create pool directly
      await handleCreatePool();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to search for matches');
      setSubmitting(false);
    }
  }

  async function handleCreatePool() {
    let expiresAt: Date;
    if (timeOption === 'custom') {
      expiresAt = new Date(Date.now() + parseInt(customMinutes) * 60 * 1000);
    } else {
      const selectedTime = TIME_OPTIONS.find((t) => t.key === timeOption)!;
      expiresAt = selectedTime.getExpiry();
    }
    const finalDestination = 'To be decided';

    setSubmitting(true);
    try {
      const parsedItems = items.map(i => ({ name: i.name.trim(), unit_price: parseFloat(i.unit_price), quantity: parseInt(i.quantity) || 1 }));
      const pool = await createPool(
        {
          items: parsedItems,
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

      toast.success('Group order started! Waiting for nearby matches.');
      navigate(`/pool/${pool.id}`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create pool');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinMatch(poolId: string) {
    setSubmitting(true);
    try {
      const parsedItems = items.map(i => ({ name: i.name.trim(), unit_price: parseFloat(i.unit_price), quantity: parseInt(i.quantity) || 1 }));
      await joinPool(
        poolId,
        profile!.id,
        parsedItems
      );
      toast.success('Successfully added your order!');
      navigate(`/pool/${poolId}`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to join pool');
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
          <h1 className="text-xl font-bold text-surface-900">Start a Group Order</h1>
          <p className="text-sm text-surface-500">Find people nearby to order with</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dynamic Items List */}
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-surface-700">
            <Package size={16} />
            Your Items
          </label>
          
          {items.map((item, index) => (
            <div key={index} className="p-4 bg-surface-50 border border-surface-200 rounded-xl space-y-3 relative">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              )}
              
              <div className="pr-8">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].name = e.target.value;
                    setItems(newItems);
                  }}
                  placeholder="e.g. Biscuit, Snacks..."
                  className="w-full px-4 py-2.5 bg-white border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 font-medium text-sm">₹</span>
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[index].unit_price = e.target.value;
                      setItems(newItems);
                    }}
                    placeholder="Unit Price"
                    min="1"
                    className="w-full pl-8 pr-4 py-2.5 bg-white border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                    required
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(item.quantity) || 1;
                      const newItems = [...items];
                      newItems[index].quantity = Math.max(1, current - 1).toString();
                      setItems(newItems);
                    }}
                    className="w-10 h-[42px] rounded-xl border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-surface-50 transition-colors text-lg bg-white"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={item.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 2) {
                        const newItems = [...items];
                        newItems[index].quantity = val;
                        setItems(newItems);
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseInt(item.quantity);
                      const newItems = [...items];
                      if (isNaN(parsed) || parsed < 1) newItems[index].quantity = '1';
                      setItems(newItems);
                    }}
                    className="flex-1 min-w-0 h-[42px] px-2 text-center bg-white border border-surface-200 rounded-xl text-surface-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(item.quantity) || 1;
                      if (current < 99) {
                        const newItems = [...items];
                        newItems[index].quantity = (current + 1).toString();
                        setItems(newItems);
                      }
                    }}
                    className="w-10 h-[42px] rounded-xl border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-surface-50 transition-colors text-lg bg-white"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          <button
            type="button"
            onClick={() => setItems([...items, { name: '', unit_price: '', quantity: '1' }])}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-surface-200 text-surface-500 font-medium text-sm hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2"
          >
            + Add Another Item
          </button>
          
          <div className="flex justify-between items-center py-2 px-1 border-b border-surface-100">
            <span className="text-sm font-medium text-surface-600">Your Order Total:</span>
            <span className="text-lg font-bold text-brand-600">
              ₹{items.reduce((sum, item) => sum + ((parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 1)), 0)}
            </span>
          </div>
        </div>

        {/* Platform Selection */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-surface-700">Where are you ordering from?</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
            <button
              type="button"
              onClick={() => setTimeOption('custom')}
              className={`chip ${timeOption === 'custom' ? 'active' : ''}`}
            >
              Custom
            </button>
          </div>
          {timeOption === 'custom' && (
            <div className="relative mt-2">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 font-medium text-sm">minutes</span>
              <input
                type="number"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                placeholder="10"
                min="1"
                max="1440"
                className="w-full px-4 py-3 bg-white border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                required
              />
            </div>
          )}
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
          className="w-full flex items-center justify-center gap-2 bg-brand-500 text-white font-semibold rounded-xl py-4 hover:bg-brand-600 transition-colors active:scale-[0.98] disabled:opacity-70 disabled:hover:bg-brand-500 disabled:active:scale-100 shadow-lg shadow-brand-500/20"
        >
          {submitting ? 'Starting...' : 'Start Group Order'}
          <ChevronRight size={20} />
        </button>

        {/* Disclaimer */}
        <p className="text-center text-xs text-surface-400 leading-relaxed">
          By creating a pool, you agree to coordinate with nearby users. PoolNear does not hold or transfer money.
        </p>
      </form>

      {/* Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-surface-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="p-5 border-b border-surface-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-surface-900 mb-1">Group Orders Found!</h3>
                <p className="text-sm text-surface-500 mb-4">
                  We found {matches.length} active order{matches.length === 1 ? '' : 's'} matching your requirement. Joining an existing order is faster!
                </p>
              </div>
              <button onClick={() => setShowMatchModal(false)} className="text-surface-400 hover:text-surface-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {matches.map((match) => {
                const quality = getMatchQuality(match.score);
                return (
                  <div key={match.pool.pool_id} className="border rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 items-center">
                        <span className="text-2xl">{quality.emoji}</span>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: quality.color }}>{quality.label}</p>
                          <p className="text-xs text-surface-500">{match.pool.distance_meters.toFixed(0)}m away • {match.pool.platform}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-surface-900 text-sm">₹{(match.pool.minimum_order_value - match.pool.current_total).toFixed(0)} needed</p>
                        <p className="text-xs text-surface-500">of ₹{match.pool.minimum_order_value}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {match.reasons.map((r, i) => (
                        <span key={i} className="text-[10px] bg-surface-100 px-2 py-0.5 rounded-full text-surface-600">{r}</span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleJoinMatch(match.pool.pool_id)}
                      disabled={submitting}
                      className="w-full py-2 bg-brand-50 text-brand-700 font-semibold rounded-lg hover:bg-brand-100 transition-colors disabled:opacity-50"
                    >
                      {submitting ? 'Joining...' : 'Join this Pool'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="p-5 border-t border-surface-100 bg-surface-50">
              <button
                onClick={() => {
                  setShowMatchModal(false);
                  handleCreatePool();
                }}
                disabled={submitting}
                className="w-full py-3 bg-surface-900 text-white rounded-xl font-semibold hover:bg-surface-800 transition-colors disabled:opacity-50"
              >
                Create New Pool Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
