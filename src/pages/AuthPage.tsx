// ═══════════════════════════════════════════════════════════════════
// PoolNear — Authentication Page
// Sign up / Sign in with Supabase Auth
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { APP_NAME } from '../lib/constants';
import { Eye, EyeOff, Mail, Lock, User, CheckCircle2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export function AuthPage() {
  const { user, loading, signUp, signIn, resendVerificationEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verificationSentTo, setVerificationSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Handle resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (isSignUp) {
      if (!name.trim()) {
        toast.error('Please enter your name');
        return;
      }
      if (!phone.trim() || !/^[6-9][0-9]{9}$/.test(phone)) {
        toast.error('Please enter a valid 10-digit phone number');
        return;
      }
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, name, phone);
        if (error) throw error;
        setVerificationSentTo(email);
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          // Check for unverified email error
          if (error.message.includes('Email not confirmed') || error.message.includes('email address is not verified')) {
            setVerificationSentTo(email);
            throw new Error('Please verify your email before signing in.');
          }
          throw error;
        }
        toast.success('Welcome back!');
      }
    } catch (err) {
      toast.error((err as Error).message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!verificationSentTo || resendCooldown > 0 || resending) return;
    
    setResending(true);
    try {
      const { error } = await resendVerificationEmail(verificationSentTo);
      if (error) throw error;
      toast.success('Verification email resent! Please check your inbox.');
      setResendCooldown(60); // 60 seconds cooldown
    } catch (err) {
      toast.error((err as Error).message || 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  }

  if (verificationSentTo) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-6 py-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-400/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-400/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />

        <div className="relative w-full max-w-sm animate-slide-up">
          <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 text-center">
            <div className="w-16 h-16 mx-auto bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600 mb-6">
              <Mail size={32} />
            </div>
            
            <h2 className="text-xl font-bold text-surface-900 mb-2">Check Your Email</h2>
            
            <p className="text-sm text-surface-600 mb-6">
              We've sent a verification link to:<br />
              <strong className="text-surface-900 mt-1 inline-block">{verificationSentTo}</strong>
            </p>
            
            <div className="bg-surface-50 p-4 rounded-xl text-left mb-6 space-y-2 text-sm text-surface-600">
              <p className="flex gap-2 items-start"><CheckCircle2 size={16} className="text-brand-500 mt-0.5 shrink-0" /> <span>Open your email inbox.</span></p>
              <p className="flex gap-2 items-start"><CheckCircle2 size={16} className="text-brand-500 mt-0.5 shrink-0" /> <span>Find the PoolNear verification email.</span></p>
              <p className="flex gap-2 items-start"><CheckCircle2 size={16} className="text-brand-500 mt-0.5 shrink-0" /> <span>Click the verification link.</span></p>
            </div>

            <p className="text-sm font-medium text-surface-700 mb-6">
              Once you click the verification link, come back here and sign in.
            </p>

            <button
              onClick={() => {
                setVerificationSentTo(null);
                setIsSignUp(false);
              }}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors mb-4"
            >
              Go to Sign In
            </button>

            <button
              onClick={handleResendVerification}
              disabled={resending || resendCooldown > 0}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
              {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend Verification Email'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-6 py-12">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-400/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-400/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg shadow-brand-500/30">
            P
          </div>
          <h1 className="text-2xl font-bold text-surface-900">{APP_NAME}</h1>
          <p className="text-surface-500 mt-1 text-sm">
            Pool orders with people nearby
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-1">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h2>
          <p className="text-sm text-surface-500 mb-6">
            {isSignUp
              ? 'Sign up to start pooling orders nearby'
              : 'Sign in to continue'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="auth-name">
                    Name
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full pl-10 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                      autoComplete="name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="auth-phone">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 font-medium">+91</span>
                    <input
                      id="auth-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="w-full pl-12 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="auth-email">
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5" htmlFor="auth-password">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:from-brand-600 hover:to-brand-700 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setEmail('');
                setPassword('');
                setName('');
              }}
              className="text-sm text-surface-500 hover:text-brand-600 transition-colors"
            >
              {isSignUp ? (
                <>Already have an account? <span className="font-semibold text-brand-600">Sign in</span></>
              ) : (
                <>Don&apos;t have an account? <span className="font-semibold text-brand-600">Sign up</span></>
              )}
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-surface-400 mt-6 max-w-xs mx-auto leading-relaxed">
          {APP_NAME} does not hold or transfer your money. All payments are coordinated externally between users.
        </p>
      </div>
    </div>
  );
}
