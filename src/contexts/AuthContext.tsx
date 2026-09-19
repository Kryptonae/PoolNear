// ═══════════════════════════════════════════════════════════════════
// PoolNear — Authentication Context
// Wraps Supabase Auth with React context for global auth state
// ═══════════════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  location_permission: boolean;
  preferred_radius: number;
  area: string | null;
  successful_pools: number;
  completed_commitments: number;
  cancelled_pools: number;
  dispute_count: number;
  account_status: string;
  is_admin: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  hasValidPhone: boolean;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Phone validation (replaces OTP phoneVerified)
  const hasValidPhone = !!profile?.phone && /^[6-9][0-9]{9}$/.test(profile.phone);

  // Fetch profile from Supabase
  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error.message);
      return null;
    }
    return data as Profile | null;
  }

  // Refresh user from Supabase Auth (e.g., after auth state change)
  async function refreshUser() {
    const { data: { user: freshUser } } = await supabase.auth.getUser();
    if (freshUser) {
      setUser(freshUser);
    }
  }

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).then((p) => {
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, name: string, phone: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    
    if (error) {
      return { error: new Error(error.message) };
    }

    if (data.user) {
      // Create or update profile with phone using the newly created session if possible
      // However, the handle_new_user trigger in the DB normally inserts the initial profile.
      // We explicitly call update_profile_safe right after to save the phone.
      const { error: profileError } = await supabase.rpc('update_profile_safe', {
        p_name: name,
        p_phone: phone,
        p_avatar_url: null,
        p_latitude: null,
        p_longitude: null,
        p_location_permission: false,
        p_preferred_radius: 500,
        p_area: null
      });

      if (profileError) {
        // Since email confirmation is likely enabled, the user won't be authenticated yet.
        // We cannot securely update their profile here. We log the error but allow signup to succeed.
        // The mandatory Phone Gate will catch them after they verify their email and sign in.
        console.warn('Signup phone save deferred:', profileError.message);
      }
    }
    
    return { error: null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function resendVerificationEmail(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase.rpc('update_profile_safe', {
      p_name: updates.name,
      p_phone: updates.phone,
      p_avatar_url: updates.avatar_url,
      p_latitude: updates.latitude,
      p_longitude: updates.longitude,
      p_location_permission: updates.location_permission,
      p_preferred_radius: updates.preferred_radius,
      p_area: updates.area
    });

    if (!error) {
      setProfile((prev) => prev ? { ...prev, ...updates } : null);
    }
    return { error: error ? new Error(error.message) : null };
  }

  async function refreshProfile() {
    if (!user) return;
    const p = await fetchProfile(user.id);
    setProfile(p);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        hasValidPhone,
        signUp,
        signIn,
        resendVerificationEmail,
        signOut,
        updateProfile,
        refreshProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { Profile };
