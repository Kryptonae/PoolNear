import { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { Modal, Input } from './ui';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface PhoneNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function PhoneNumberModal({ isOpen, onClose, onSaved }: PhoneNumberModalProps) {
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
      onSaved();
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
        <div className="flex items-center gap-3 p-4 bg-brand-50/50 rounded-2xl border border-brand-100/50">
          <ShieldCheck size={24} className="text-brand-600 shrink-0" />
          <p className="text-sm font-medium text-brand-800 leading-relaxed">
            A valid phone number is required to request connections with other users.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-surface-700" htmlFor="phone-input">
            Phone Number
          </label>
          <Input
            id="phone-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
            className="font-medium"
            autoFocus
            prefixNode={<span className="text-surface-500 text-base font-bold">+91</span>}
            prefixWidth="w-14"
          />
          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wide mt-2">
            Enter your 10-digit mobile number
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-start gap-2 border border-red-100">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !phone}
          className="btn btn-primary w-full mt-2 shadow-lg shadow-brand-500/20"
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
