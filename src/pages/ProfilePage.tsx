// ═══════════════════════════════════════════════════════════════════
// PoolNear — Profile Page
// User profile, trust stats, settings, and public profile view
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, type Profile } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RADIUS_OPTIONS, APP_NAME } from '../lib/constants';
import { LoadingState, ErrorState } from '../components/ui';
import {
  User, MapPin, Shield, CheckCircle2, XCircle, AlertTriangle,
  Settings, LogOut, ChevronRight, Bell, Palette,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function ProfilePage() {
  const { id: viewUserId } = useParams<{ id: string }>();
  const { profile: myProfile, user, signOut, updateProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const isOwnProfile = !viewUserId || viewUserId === user?.id;
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!isOwnProfile);
  const [error, setError] = useState<string | null>(null);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editRadius, setEditRadius] = useState(500);
  const [saving, setSaving] = useState(false);

  const profile = isOwnProfile ? myProfile : viewProfile;

  // Fetch other user's profile
  const fetchProfile = useCallback(async () => {
    if (isOwnProfile || !viewUserId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .rpc('get_public_profile', { p_user_id: viewUserId })
        .single();
      if (err) throw new Error(err.message);
      setViewProfile(data as Profile);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [viewUserId, isOwnProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (isOwnProfile && myProfile) {
      setEditName(myProfile.name || '');
      setEditArea(myProfile.area || '');
      setEditRadius(myProfile.preferred_radius || 500);
    }
  }, [isOwnProfile, myProfile]);

  async function handleSaveSettings() {
    if (!editName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const { error: err } = await updateProfile({
        name: editName.trim(),
        area: editArea.trim() || null,
        preferred_radius: editRadius,
      });
      if (err) throw err;
      toast.success('Profile updated!');
      setShowSettings(false);
      await refreshProfile();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/auth');
    } catch {
      toast.error('Failed to sign out');
    }
  }

  if (loading) return <LoadingState message="Loading profile..." />;
  if (error) return <ErrorState message={error} onRetry={fetchProfile} />;
  if (!profile) return <ErrorState message="Profile not found" />;

  const trustScore = Math.max(0, Math.min(100,
    (profile.successful_pools ?? 0) * 10 +
    (profile.completed_commitments ?? 0) * 5 -
    (profile.cancelled_pools ?? 0) * 15 -
    (profile.dispute_count ?? 0) * 20
  ));

  const trustLevel = trustScore >= 80 ? 'Excellent' : trustScore >= 50 ? 'Good' : trustScore >= 20 ? 'Fair' : 'New User';
  const trustColor = trustScore >= 80 ? 'text-emerald-600' : trustScore >= 50 ? 'text-blue-600' : trustScore >= 20 ? 'text-amber-600' : 'text-surface-500';

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6 animate-slide-up">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-brand-500/20">
            {(profile.name || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-surface-900 truncate">{profile.name}</h1>
            {profile.area && (
              <p className="text-sm text-surface-500 flex items-center gap-1 mt-0.5">
                <MapPin size={14} /> {profile.area}
              </p>
            )}
            <p className={`text-sm font-semibold mt-1 ${trustColor}`}>
              <Shield size={14} className="inline mr-1" />
              Trust: {trustLevel}
            </p>
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center text-surface-500 hover:bg-surface-200 transition-colors"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
          )}
        </div>

        {/* Trust Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
              <CheckCircle2 size={16} />
            </div>
            <p className="text-xl font-bold text-surface-900">{profile.successful_pools ?? 0}</p>
            <p className="text-xs text-surface-500">Successful Pools</p>
          </div>
          <div className="bg-surface-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
              <Shield size={16} />
            </div>
            <p className="text-xl font-bold text-surface-900">{profile.completed_commitments ?? 0}</p>
            <p className="text-xs text-surface-500">Commitments</p>
          </div>
          <div className="bg-surface-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
              <XCircle size={16} />
            </div>
            <p className="text-xl font-bold text-surface-900">{profile.cancelled_pools ?? 0}</p>
            <p className="text-xs text-surface-500">Cancellations</p>
          </div>
          <div className="bg-surface-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <AlertTriangle size={16} />
            </div>
            <p className="text-xl font-bold text-surface-900">{profile.dispute_count ?? 0}</p>
            <p className="text-xs text-surface-500">Disputes</p>
          </div>
        </div>

        {/* Trust Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-surface-600 font-medium">Trust Score</span>
            <span className={`font-bold ${trustColor}`}>{trustScore}/100</span>
          </div>
          <div className="w-full h-2 bg-surface-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${trustScore}%`,
                background: trustScore >= 80 ? '#10B981' : trustScore >= 50 ? '#3B82F6' : trustScore >= 20 ? '#F59E0B' : '#94A3B8',
              }}
            />
          </div>
        </div>

        {/* Member Since */}
        <p className="text-xs text-surface-400 mt-4 text-center">
          Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Settings Panel (own profile only) */}
      {isOwnProfile && showSettings && (
        <div className="bg-white rounded-2xl border border-surface-200 p-5 space-y-4 animate-slide-down">
          <h3 className="text-sm font-semibold text-surface-900">Edit Profile</h3>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5" htmlFor="profile-name">Name</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                id="profile-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5" htmlFor="profile-area">Area</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                id="profile-area"
                type="text"
                value={editArea}
                onChange={(e) => setEditArea(e.target.value)}
                placeholder="e.g. Koramangala, Delhi NCR"
                className="w-full pl-9 pr-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-2">Matching Radius</label>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditRadius(opt.value)}
                  className={`chip ${editRadius === opt.value ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="w-full py-2.5 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Quick Actions (own profile) */}
      {isOwnProfile && (
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 transition-colors border-b border-surface-100"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-surface-700">
              <Palette size={18} className="text-surface-400" />
              My Pools & Activity
            </span>
            <ChevronRight size={16} className="text-surface-300" />
          </button>
          <button
            onClick={() => navigate('/discover')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 transition-colors border-b border-surface-100"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-surface-700">
              <Bell size={18} className="text-surface-400" />
              Discover Nearby Pools
            </span>
            <ChevronRight size={16} className="text-surface-300" />
          </button>
          {myProfile?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 transition-colors border-b border-surface-100"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-surface-700">
                <Shield size={18} className="text-red-400" />
                Admin Dashboard
              </span>
              <ChevronRight size={16} className="text-surface-300" />
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition-colors text-sm font-medium text-red-600"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-center text-xs text-surface-400 leading-relaxed">
        {APP_NAME} trust scores are calculated from pool activity and cannot be manually edited.
      </p>
    </div>
  );
}
