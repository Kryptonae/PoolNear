// ═══════════════════════════════════════════════════════════════════
// PoolNear — Main Layout with Bottom Navigation
// Responsive: mobile bottom nav, desktop side nav
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, LayoutDashboard, User, Bell } from 'lucide-react';
import { APP_NAME } from '../lib/constants';
import { useAuth } from '../contexts/AuthContext';
import { getNotifications } from '../services/pools';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { GlobalLocationPicker } from './GlobalLocationPicker';
import { useGlobalLocation } from '../hooks/useGlobalLocation';
import { MapPin, ChevronDown } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/discover', icon: Search, label: 'Nearby' },
  { to: '/create', icon: PlusCircle, label: 'Create' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'My Pools' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function Layout() {
  const location = useLocation();
  const { profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const globalLocation = useGlobalLocation();

  const handleOpenLocationPicker = () => {
    window.dispatchEvent(new Event('poolnear_request_location'));
  };

  const fetchUnread = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const notifs = await getNotifications(profile.id);
      setUnreadCount(notifs.filter((n: Record<string, unknown>) => !n.read).length);
    } catch {
      // Silent fail
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchUnread();
    
    // Refresh fallback every 60 seconds
    const interval = setInterval(fetchUnread, 60000);
    
    if (!profile?.id) {
      return () => clearInterval(interval);
    }

    // Realtime subscription
    const channel = supabase.channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          setUnreadCount((c) => c + 1);
          const newNotif = payload.new as any;
          toast.success(newNotif.message || newNotif.title || 'New notification', {
            icon: '🔔',
            duration: 4000,
          });
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchUnread, profile?.id]);

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col lg:flex-row">
      <GlobalLocationPicker />
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-white border-r border-surface-200 z-40">
        <div className="px-6 py-5 border-b border-surface-100 flex flex-col gap-4">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm">
              P
            </div>
            <span className="font-bold text-lg text-surface-900">{APP_NAME}</span>
          </NavLink>
          
          {/* Desktop Global Location Picker */}
          <button 
            onClick={handleOpenLocationPicker}
            className="flex items-center gap-2 text-sm text-surface-700 hover:text-brand-600 transition-colors bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-xl px-3 py-2 w-full active:scale-[0.98]"
          >
            <MapPin size={16} className="text-brand-500 shrink-0" />
            <span className="truncate flex-1 text-left font-medium">
              {globalLocation ? globalLocation.destination : 'Choose Location'}
            </span>
            <ChevronDown size={14} className="text-surface-400 shrink-0" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-surface-600 hover:bg-surface-50 hover:text-surface-800'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                {item.label}
              </NavLink>
            );
          })}
          {/* Notifications in sidebar */}
          <NavLink
            to="/notifications"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              location.pathname === '/notifications'
                ? 'bg-brand-50 text-brand-700'
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-800'
            }`}
          >
            <div className="relative">
              <Bell size={20} strokeWidth={location.pathname === '/notifications' ? 2.5 : 1.8} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            Notifications
          </NavLink>
        </nav>
        {/* Profile in sidebar */}
        {profile && (
          <div className="px-4 py-4 border-t border-surface-100">
            <NavLink
              to="/profile"
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm">
                {(profile.name || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 truncate">{profile.name}</p>
                <p className="text-xs text-surface-400 truncate">{profile.area || 'Set your area'}</p>
              </div>
            </NavLink>
          </div>
        )}
      </aside>

      {/* Mobile Top Header (hidden on desktop) */}
      <header className="lg:hidden sticky top-0 z-40 glass border-b border-surface-200/50">
        <div className="max-w-lg mx-auto px-4 py-2 flex flex-col gap-2">
          <div className="flex items-center justify-between h-10">
            <NavLink to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm">
                P
              </div>
              <span className="font-bold text-lg text-surface-900">
                {APP_NAME}
              </span>
            </NavLink>
            <NavLink
              to="/notifications"
              className="relative w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center text-surface-500 hover:bg-surface-200 transition-colors"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
          </div>
          
          {/* Mobile Global Location Picker */}
          <button 
            onClick={handleOpenLocationPicker}
            className="flex items-center gap-1.5 text-sm text-surface-700 hover:text-brand-600 transition-colors bg-surface-100/50 rounded-lg px-2 py-1.5 w-full active:scale-[0.98]"
          >
            <MapPin size={16} className="text-brand-500 shrink-0" />
            <span className="truncate flex-1 text-left font-medium">
              {globalLocation ? globalLocation.destination : 'Choose Location'}
            </span>
            <ChevronDown size={14} className="text-surface-400 shrink-0" />
          </button>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 lg:ml-64">
        <div className="max-w-2xl mx-auto w-full pb-safe lg:pb-6">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation (hidden on desktop) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-surface-200/50">
        <div className="max-w-lg mx-auto flex justify-around items-center h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {navItems.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                  item.to === '/create'
                    ? '' // special style for create button
                    : isActive
                    ? 'text-brand-600'
                    : 'text-surface-400 hover:text-surface-600'
                }`}
                aria-label={item.label}
              >
                {item.to === '/create' ? (
                  <div className="w-12 h-12 -mt-5 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 transition-shadow active:scale-95">
                    <Icon size={24} />
                  </div>
                ) : (
                  <>
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                    <span className="text-[10px] font-medium">
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
