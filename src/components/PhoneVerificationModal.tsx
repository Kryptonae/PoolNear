// ═══════════════════════════════════════════════════════════════════
// PoolNear — Phone Verification Modal
// OTP-based phone verification using Supabase Auth
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Phone, ShieldCheck, AlertCircle } from 'lucide-react';
import { Modal } from './ui';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface PhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export function PhoneVerificationModal({ isOpen, onClose, onVerified }: PhoneVerificationModalProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format phone to E.164 for India
  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    return `+${digits}`;
  }

  async function handleSendOtp() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhone(phone);
      const { error: err } = await supabase.auth.updateUser({ phone: formattedPhone });
      if (err) throw new Error(err.message);
      setStep('otp');
      toast.success('OTP sent to your phone');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhone(phone);
      const { error: err } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'phone_change',
      });
      if (err) throw new Error(err.message);
      toast.success('Phone verified successfully!');
      onVerified();
      handleReset();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPhone('');
    setOtp('');
    setStep('phone');
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Verify Phone Number">
      <div className="space-y-4 mt-3">
        <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-xl">
          <ShieldCheck size={20} className="text-brand-600 flex-shrink-0" />
          <p className="text-sm text-brand-700">
            A verified phone number is required to connect with other users for payment coordination.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'phone' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="verify-phone">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 font-medium text-sm">+91</span>
                <input
                  id="verify-phone"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  maxLength={10}
                  className="w-full pl-12 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                  autoComplete="tel-national"
                />
                <Phone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" />
              </div>
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Sending OTP...
                </>
              ) : (
                'Send OTP'
              )}
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="verify-otp">
                Enter OTP
              </label>
              <p className="text-xs text-surface-400 mb-2">
                We sent a 6-digit code to +91 {phone}
              </p>
              <input
                id="verify-otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 text-center text-xl tracking-[0.5em] font-mono placeholder:text-surface-400 placeholder:tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                autoComplete="one-time-code"
              />
            </div>
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Phone'
              )}
            </button>
            <button
              onClick={() => { setStep('phone'); setOtp(''); setError(null); }}
              className="w-full py-2 text-sm text-surface-500 hover:text-surface-700 transition-colors"
            >
              Change phone number
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
