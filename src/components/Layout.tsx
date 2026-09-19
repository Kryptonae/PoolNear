// ═══════════════════════════════════════════════════════════════════
// PoolNear — Main Layout with Bottom Navigation
// ═══════════════════════════════════════════════════════════════════

import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, LayoutDashboard, User } from 'lucide-react';
import { APP_NAME } from '../lib/constants';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/discover', icon: Search, label: 'Nearby' },
  { to: '/create', icon: PlusCircle, label: 'Create' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'My Pools' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 glass border-b border-surface-200/50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm">
              P
            </div>
            <span className="font-bold text-lg text-surface-900">
              {APP_NAME}
            </span>
          </NavLink>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-lg mx-auto w-full pb-safe">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-surface-200/50">
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
