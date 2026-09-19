import { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { Modal } from './ui';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface PhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export function PhoneVerificationModal({ isOpen, onClose, onVerified }: PhoneVerificationModalProps) {
  const { updateProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const digits = phone.replace(/\D/g, '');
    
    // Extract the 10 digit number if they typed +91
    let finalPhone = digits;
    if (digits.startsWith('91') && digits.length === 12) {
      finalPhone = digits.slice(2);
    } else if (digits.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!/^[6-9][0-9]{9}$/.test(finalPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: err } = await updateProfile({ phone: finalPhone });
      if (err) throw new Error(err.message);
      
      toast.success('Phone number saved successfully!');
      onVerified();
      handleClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPhone('');
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Phone Number">
      <div className="space-y-4 mt-3">
        <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-xl">
          <ShieldCheck size={20} className="text-brand-600 flex-shrink-0" />
          <p className="text-sm text-brand-700">
            A valid phone number is required to request connections with other users.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="phone-input">
            Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-surface-500 text-sm font-medium">+91</span>
            </div>
            <input
              id="phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              className="w-full pl-12 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all font-medium"
              autoFocus
            />
          </div>
          <p className="text-xs text-surface-500 mt-2">
            Enter your 10-digit mobile number.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !phone}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Save Phone Number'
          )}
        </button>
      </div>
    </Modal>
  );
}
