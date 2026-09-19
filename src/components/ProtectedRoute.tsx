// ═══════════════════════════════════════════════════════════════════
// PoolNear — Protected Route Component
// Redirects to auth page if user is not authenticated
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, AlertCircle, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { user, profile, loading, hasValidPhone, updateProfile, refreshProfile, signOut } = useAuth();
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
          <p className="text-surface-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user is authenticated but profile is loaded and phone is missing/invalid, show Phone Setup Gate
  if (profile && !hasValidPhone) {
    const handleSubmit = async () => {
      const digits = phone.replace(/\D/g, '');
      let finalPhone = digits;
      if (digits.startsWith('91') && digits.length === 12) {
        finalPhone = digits.slice(2);
      } else if (digits.length !== 10) {
        setError('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
  
      if (!/^[6-9][0-9]{9}$/.test(finalPhone)) {
        setError('Please enter a valid mobile number starting with 6-9.');
        return;
      }
  
      setSaving(true);
      setError(null);
      try {
        const { error: err } = await updateProfile({ phone: finalPhone });
        if (err) throw new Error(err.message);
        
        toast.success('Phone number saved!');
        await refreshProfile();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-surface-200 p-6 shadow-sm animate-slide-up">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600 mb-4">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-bold text-surface-900">Add Your Phone Number</h2>
            <p className="text-surface-500 text-sm mt-2">
              Your phone number is required so pool members can contact you.
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="gate-phone">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-surface-500 text-sm font-medium">+91</span>
                </div>
                <input
                  id="gate-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full pl-12 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all font-medium"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-2 animate-fade-in">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={saving || !phone}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Save and Continue'
              )}
            </button>

            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 text-surface-500 hover:text-surface-700 py-2 text-sm font-medium transition-colors mt-2"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
