// ═
// ═
// ═
// ═

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createPool, getNearbyPools, joinPool } from '../services/pools';
import { findBestMatches, getMatchQuality, type MatchCandidate } from '../services/matching';
import { PLATFORM_LIST, TIME_OPTIONS, RADIUS_OPTIONS, DEFAULT_MIN_ORDER, DEFAULT_MAX_MEMBERS, type PlatformKey } from '../lib/constants';
import { ArrowLeft, Package, Clock, MapPin, Users, ChevronRight, X, Check } from 'lucide-react';
import { useGlobalLocation } from '../hooks/useGlobalLocation';
import { PlatformLogo } from '../components/PlatformLogo';
import { LocationInput } from '../components/LocationInput';
import { Input } from '../components/ui';
import toast from 'react-hot-toast';

export function CreatePoolPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);


  const [items, setItems] = useState([{ name: '', brand: '', variant_size: '', notes: '', product_url: '', unit_price: '', quantity: '1' }]);
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
  const globalLocation = useGlobalLocation();
  const [localPoolLocation, setLocalPoolLocation] = useState(globalLocation);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Sync with global location initially if local is not set
  useEffect(() => {
    if (globalLocation && !localPoolLocation) {
      setLocalPoolLocation(globalLocation);
    }
  }, [globalLocation, localPoolLocation]);

  const canProceedToStep2 = platform !== '' && (platform !== 'other' || platformOther.trim() !== '');
  const canProceedToStep3 = items.every(i => i.name.trim() && parseFloat(i.unit_price) > 0);
  const canSubmit = localPoolLocation !== null;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (submitting || !canSubmit) return;

    const parsedItems = items.map(i => ({ name: i.name.trim(), unit_price: parseFloat(i.unit_price), quantity: parseInt(i.quantity) || 1 }));
    const totalAmount = parsedItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

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
      const nearby = await getNearbyPools(localPoolLocation.latitude, localPoolLocation.longitude, maxDistance, platform as PlatformKey, 'waiting');
      const foundMatches = findBestMatches(nearby, {
        platform: platform as PlatformKey,
        amount: totalAmount,
        latitude: localPoolLocation.latitude,
        longitude: localPoolLocation.longitude,
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
    const parsedItems = items.map(i => ({ name: i.name.trim(), unit_price: parseFloat(i.unit_price), quantity: parseInt(i.quantity) || 1 }));
    
    setSubmitting(true);
    try {
      const pool = await createPool(
        {
          items: parsedItems,
          platform: platform as PlatformKey,
          platform_other: platform === 'other' ? platformOther.trim() : undefined,
          minimum_order_value: parseFloat(minOrderValue) || DEFAULT_MIN_ORDER,
          required_by: expiresAt.toISOString(),
          maximum_distance: maxDistance,
          latitude: localPoolLocation!.latitude,
          longitude: localPoolLocation!.longitude,
          destination: localPoolLocation!.destination,
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
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-surface-50/90 backdrop-blur-md px-4 py-4 border-b border-surface-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (step > 1) setStep(step - 1);
              else navigate(-1);
            }}
            className="w-10 h-10 rounded-xl bg-surface-0 flex items-center justify-center text-surface-600 hover:bg-surface-100 transition-colors border border-surface-200 shadow-sm"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                    step >= s ? 'bg-brand-500' : 'bg-surface-200'
                  }`}
                />
              ))}
            </div>
            <h1 className="text-title-3">
              {step === 1 && 'Platform & Rules'}
              {step === 2 && 'Your Items'}
              {step === 3 && 'Delivery & Review'}
            </h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 animate-fade-in">
        {/* Step 1: Platform & Requirements */}
        {step === 1 && (
          <div className="space-y-8 animate-slide-right">
            {/* Platform Selection */}
            <div className="space-y-6">
              <label className="block text-base font-bold text-surface-900">Where are you ordering from?</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PLATFORM_LIST.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPlatform(p.key)}
                    className={`relative group flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all duration-300 active:scale-[0.98] animate-fade-in ${
                      platform === p.key
                        ? 'border-brand-500 bg-brand-50 shadow-sm scale-[1.02]'
                        : 'border-surface-200 bg-surface-0 hover:border-brand-300 hover:bg-surface-50 hover:scale-[1.02]'
                    }`}
                  >
                    <PlatformLogo platform={p.key} size={28} className={`shadow-sm transition-all duration-300 ${platform === p.key ? 'scale-110 shadow-md ring-2 ring-brand-500/20 ring-offset-1' : 'group-hover:scale-105 group-hover:shadow-md'}`} />
                    <span className={`font-semibold text-sm transition-colors ${platform === p.key ? 'text-brand-900' : 'text-surface-700 group-hover:text-surface-900'}`}>{p.label}</span>
                    {platform === p.key && (
                      <div className="absolute right-3 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center animate-scale-in shadow-sm">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {platform === 'other' && (
                <input
                  type="text"
                  value={platformOther}
                  onChange={(e) => setPlatformOther(e.target.value)}
                  placeholder="Enter platform name"
                  className="input-field mt-3"
                />
              )}
            </div>

            {/* Minimum Order Value */}
            <div className="space-y-6">
              <label className="block text-base font-bold text-surface-900">Store minimum order value</label>
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
              <Input
                type="number"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                placeholder="99"
                min="1"
                prefixNode={<span className="font-medium">₹</span>}
              />
            </div>

            {/* Required By */}
            <div className="space-y-6">
              <label className="flex items-center gap-2 text-base font-bold text-surface-900">
                <Clock size={16} className="text-surface-500" />
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
                <Input
                  type="number"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="10"
                  min="1"
                  max="1440"
                  required
                  suffixNode={<span className="font-medium text-sm">minutes</span>}
                  suffixWidth="w-20"
                  className="mt-2"
                />
              )}
            </div>

            {/* Maximum Distance */}
            <div className="space-y-6">
              <label className="flex items-center gap-2 text-base font-bold text-surface-900">
                <MapPin size={16} className="text-surface-500" />
                Maximum matching distance
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
            <div className="space-y-6">
              <label className="flex items-center gap-2 text-base font-bold text-surface-900">
                <Users size={16} className="text-surface-500" />
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
              <div className="flex justify-between text-xs text-surface-400 font-medium">
                <span>2 people</span>
                <span>10 people</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceedToStep2}
              className="btn btn-primary btn-lg w-full mt-8"
            >
              Continue to Items
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Step 2: Items */}
        {step === 2 && (
          <div className="space-y-6 animate-slide-right">
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="card p-5 space-y-4 relative">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                      className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                  )}
                  
                  <div className="pr-8 space-y-3">
                    <Input type="text" value={item.name}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].name = e.target.value;
                        setItems(newItems);
                      }}
                      placeholder="Item Name (e.g. Snacks...)"
                      className="font-semibold text-base"
                      required
                    />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input type="text" value={item.brand || ''}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].brand = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Brand (Opt)"
                        />
                      <Input type="text" value={item.variant_size || ''}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].variant_size = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Size (Opt)"
                        />
                    </div>
                    
                    <Input type="url" value={item.product_url || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].product_url = e.target.value;
                        setItems(newItems);
                      }}
                      placeholder="Product URL (Optional)"
                      />
                    
                    <textarea
                      value={item.notes || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].notes = e.target.value;
                        setItems(newItems);
                      }}
                      placeholder="Notes for orderer (Optional)"
                      rows={2}
                      className="input-field text-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-surface-100">
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].unit_price = e.target.value;
                        setItems(newItems);
                      }}
                      placeholder="Price"
                      min="1"
                      required
                      className="font-semibold"
                      prefixNode={<span className="font-medium">₹</span>}
                    />
                    
                    <div className="flex items-center gap-1 bg-surface-100 rounded-xl p-1 border border-surface-200">
                      <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(item.quantity) || 1;
                          const newItems = [...items];
                          newItems[index].quantity = Math.max(1, current - 1).toString();
                          setItems(newItems);
                        }}
                        className="w-10 h-full rounded-lg flex items-center justify-center text-surface-600 hover:bg-surface-200 hover:text-surface-900 transition-colors text-lg"
                      > - </button>
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
                        className="flex-1 min-w-0 h-full px-2 text-center bg-transparent text-surface-900 font-bold focus:outline-none"
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
                        className="w-10 h-full rounded-lg flex items-center justify-center text-surface-600 hover:bg-surface-200 hover:text-surface-900 transition-colors text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              type="button"
              onClick={() => setItems([...items, { name: '', brand: '', variant_size: '', notes: '', product_url: '', unit_price: '', quantity: '1' }])}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-surface-300 text-surface-600 font-semibold text-sm hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 bg-surface-0"
            >
              <Package size={18} />
              Add Another Item
            </button>
            
            <div className="card p-4 bg-brand-50 border-brand-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-brand-900">Your Order Total:</span>
                <span className="text-2xl font-bold text-brand-600">
                  ₹{items.reduce((sum, item) => sum + ((parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 1)), 0)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!canProceedToStep3}
              className="btn btn-primary btn-lg w-full mt-4"
            >
              Continue to Delivery
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Step 3: Location & Review */}
        {step === 3 && (
          <div className="space-y-6 animate-slide-right">
            {/* Delivery Location */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-surface-900">Delivery Location</label>
                <button 
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Change Location
                </button>
              </div>
              <div className="card p-4 flex items-start gap-3 border-brand-200 bg-brand-50/50">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={20} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="font-semibold text-surface-900 line-clamp-2">
                    {localPoolLocation?.destination || 'No location set'}
                  </p>
                  {localPoolLocation && (
                    <p className="text-xs text-surface-500 mt-1 font-medium">
                      Used for order delivery • Changing this won't affect your global location
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-surface-900 border-b border-surface-100 pb-2">Order Summary</h3>
              <div className="space-y-2 text-sm text-surface-600">
                <div className="flex justify-between">
                  <span>Platform:</span>
                  <span className="font-medium text-surface-900">
                    {platform === 'other' ? platformOther : PLATFORM_LIST.find(p => p.key === platform)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Items:</span>
                  <span className="font-medium text-surface-900">{items.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Your Total:</span>
                  <span className="font-medium text-surface-900">
                    ₹{items.reduce((sum, item) => sum + ((parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 1)), 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className="btn btn-primary btn-lg w-full py-4 mt-8"
            >
              {submitting ? 'Starting Group Order...' : 'Start Group Order Now'}
            </button>

            {/* Disclaimer */}
            <p className="text-center text-xs text-surface-400 font-medium">
              By creating a pool, you agree to coordinate with nearby users. PoolNear does not hold or transfer money.
            </p>
          </div>
        )}
      </div>

      {/* Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-0 rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-slide-up border border-surface-200 shadow-2xl">
            <div className="p-6 border-b border-surface-100 flex justify-between items-start">
              <div>
                <h3 className="text-title-2 mb-2">Group Orders Found!</h3>
                <p className="text-body-sm text-surface-500">
                  We found {matches.length} active order{matches.length === 1 ? '' : 's'} matching your requirement. Joining an existing order is faster!
                </p>
              </div>
              <button onClick={() => setShowMatchModal(false)} className="text-surface-400 hover:text-surface-600 transition-colors bg-surface-100 rounded-full p-2">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-surface-50">
              {matches.map((match) => {
                const quality = getMatchQuality(match.score);
                return (
                  <div key={match.pool.pool_id} className="card p-5 space-y-4 hover:border-brand-300 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3 items-center">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-surface-100 text-2xl">
                          {quality.emoji}
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: quality.color }}>{quality.label}</p>
                          <p className="text-xs font-medium text-surface-500">{match.pool.distance_meters.toFixed(0)}m away • {match.pool.platform}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-surface-900 text-sm">₹{(match.pool.minimum_order_value - match.pool.current_total).toFixed(0)} needed</p>
                        <p className="text-xs font-medium text-surface-500">of ₹{match.pool.minimum_order_value}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {match.reasons.map((r, i) => (
                        <span key={i} className="text-[10px] font-semibold bg-surface-100 px-2.5 py-1 rounded-lg text-surface-600">{r}</span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleJoinMatch(match.pool.pool_id)}
                      disabled={submitting}
                      className="btn btn-secondary w-full"
                    >
                      {submitting ? 'Joining...' : 'Join this Pool'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="p-6 border-t border-surface-100 bg-surface-0">
              <button
                onClick={() => {
                  setShowMatchModal(false);
                  handleCreatePool();
                }}
                disabled={submitting}
                className="btn btn-tertiary w-full"
              >
                Create New Pool Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-surface-0 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up border border-surface-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-surface-100 flex justify-between items-center">
              <h2 className="text-title-3">Change Delivery Location</h2>
              <button type="button" onClick={() => setShowLocationModal(false)} className="p-2 text-surface-400 hover:text-surface-900 hover:bg-surface-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <LocationInput 
                onLocationSelect={(loc) => {
                  if (loc) {
                    setLocalPoolLocation(loc);
                    setShowLocationModal(false);
                  }
                }}
                defaultDestination={localPoolLocation?.destination}
                defaultLatitude={localPoolLocation?.latitude}
                defaultLongitude={localPoolLocation?.longitude}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
