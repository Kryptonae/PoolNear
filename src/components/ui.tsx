// ═══════════════════════════════════════════════════════════════════
// PoolNear — Reusable UI Components
// Pool cards, badges, empty states, loading states, modals
// ═══════════════════════════════════════════════════════════════════

import { type ReactNode } from 'react';
import { APP_NAME, PLATFORMS, POOL_STATUS, type PlatformKey, type PoolStatusKey } from '../lib/constants';
import { formatDistance } from '../lib/geo';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Clock, Users, ChevronRight, Package, AlertTriangle, Search } from 'lucide-react';

// ─── PLATFORM BADGE ─────────────────────────────────────────────

interface PlatformBadgeProps {
  platform: PlatformKey;
  platformOther?: string | null;
  size?: 'sm' | 'md';
}

export function PlatformBadge({ platform, platformOther, size = 'md' }: PlatformBadgeProps) {
  const info = PLATFORMS[platform];
  const label = platform === 'other' && platformOther ? platformOther : info.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      }`}
      style={{
        backgroundColor: info.bgColor,
        color: info.color,
      }}
    >
      <span>{info.icon}</span>
      <span>{label}</span>
    </span>
  );
}

// ─── STATUS BADGE ───────────────────────────────────────────────

interface StatusBadgeProps {
  status: PoolStatusKey;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const info = POOL_STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: info.bgColor,
        color: info.color,
      }}
    >
      <span>{info.emoji}</span>
      <span>{info.label}</span>
    </span>
  );
}

// ─── AMOUNT PROGRESS ────────────────────────────────────────────

interface AmountProgressProps {
  current: number;
  target: number;
}

export function AmountProgress({ current, target }: AmountProgressProps) {
  const percentage = Math.min((current / target) * 100, 100);
  const remaining = Math.max(target - current, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-lg font-bold text-surface-900">
          ₹{current.toFixed(0)} <span className="text-surface-400 font-normal text-sm">/ ₹{target.toFixed(0)}</span>
        </span>
        <span className="text-sm font-semibold text-brand-600">
          ₹{remaining.toFixed(0)} more needed
        </span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ─── POOL CARD ──────────────────────────────────────────────────

interface PoolCardProps {
  pool: {
    id: string;
    platform: PlatformKey;
    platform_other?: string | null;
    minimum_order_value: number;
    current_total: number;
    max_members: number;
    destination: string;
    status: PoolStatusKey;
    required_by: string;
    expires_at: string;
  };
  distanceMeters?: number;
  memberCount?: number;
  onClick?: () => void;
}

export function PoolCard({ pool, distanceMeters, memberCount, onClick }: PoolCardProps) {
  const remaining = Math.max(pool.minimum_order_value - pool.current_total, 0);
  const percentage = Math.min((pool.current_total / pool.minimum_order_value) * 100, 100);
  const timeLeft = formatDistanceToNow(new Date(pool.required_by), { addSuffix: false });

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-surface-200 p-4 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-200 active:scale-[0.98] group"
      aria-label={`View pool on ${PLATFORMS[pool.platform].label}`}
    >
      <div className="flex items-start justify-between mb-3">
        <PlatformBadge platform={pool.platform} platformOther={pool.platform_other} />
        <StatusBadge status={pool.status} />
      </div>

      {/* Amount Progress */}
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-xl font-bold text-surface-900">
            ₹{pool.current_total.toFixed(0)}
            <span className="text-surface-400 font-normal text-sm"> / ₹{pool.minimum_order_value.toFixed(0)}</span>
          </span>
          {remaining > 0 && (
            <span className="text-sm font-semibold text-brand-600">
              ₹{remaining.toFixed(0)} needed
            </span>
          )}
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-surface-500">
        {memberCount !== undefined && (
          <span className="flex items-center gap-1">
            <Users size={14} />
            {memberCount} / {pool.max_members}
          </span>
        )}
        {distanceMeters !== undefined && (
          <span className="flex items-center gap-1">
            <MapPin size={14} />
            {formatDistance(distanceMeters)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={14} />
          {timeLeft}
        </span>
      </div>

      {/* Destination & Arrow */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-100">
        <span className="text-xs text-surface-400 flex items-center gap-1">
          <Package size={12} />
          {pool.destination}
        </span>
        <ChevronRight
          size={18}
          className="text-surface-300 group-hover:text-brand-500 transition-colors"
        />
      </div>
    </button>
  );
}

// ─── EMPTY STATE ────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4 text-surface-400">
        {icon || <Search size={28} />}
      </div>
      <h3 className="text-lg font-semibold text-surface-800 mb-1">{title}</h3>
      <p className="text-sm text-surface-500 mb-6 max-w-xs">{description}</p>
      {action}
    </div>
  );
}

// ─── LOADING STATE ──────────────────────────────────────────────

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin mb-4" />
      <p className="text-sm text-surface-500 font-medium">{message}</p>
    </div>
  );
}

// ─── SKELETON CARD ──────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-4 space-y-3">
      <div className="flex justify-between">
        <div className="skeleton w-24 h-6" />
        <div className="skeleton w-20 h-5" />
      </div>
      <div className="space-y-2">
        <div className="skeleton w-40 h-7" />
        <div className="skeleton w-full h-2" />
      </div>
      <div className="flex gap-4">
        <div className="skeleton w-16 h-4" />
        <div className="skeleton w-20 h-4" />
        <div className="skeleton w-14 h-4" />
      </div>
    </div>
  );
}

// ─── ERROR STATE ────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4 text-red-400">
        <AlertTriangle size={28} />
      </div>
      <h3 className="text-lg font-semibold text-surface-800 mb-1">Something went wrong</h3>
      <p className="text-sm text-surface-500 mb-6 max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 bg-surface-900 text-white rounded-xl font-medium hover:bg-surface-800 transition-colors active:scale-95"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

// ─── MODAL ──────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-2xl shadow-xl animate-slide-up overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <h3 className="text-lg font-semibold text-surface-900">{title}</h3>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

// ─── LOCATION PERMISSION CARD ───────────────────────────────────

interface LocationCardProps {
  onAllow: () => void;
  onSkip?: () => void;
  loading?: boolean;
  denied?: boolean;
}

export function LocationPermissionCard({ onAllow, onSkip, loading, denied }: LocationCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-6 text-center animate-scale-in">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
        <MapPin size={28} className="text-brand-500" />
      </div>
      <h3 className="text-lg font-semibold text-surface-900 mb-2">
        {denied ? 'Location Required' : 'Enable Location'}
      </h3>
      <p className="text-sm text-surface-500 mb-6 leading-relaxed">
        {denied
          ? 'Location is required for automatic nearby matching. Please enable it in your browser settings.'
          : `${APP_NAME} uses your approximate location to find nearby people and active pools. Your exact location will not be publicly displayed.`}
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={onAllow}
          disabled={loading}
          className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Getting Location...
            </>
          ) : (
            'Allow Location'
          )}
        </button>
        {onSkip && !denied && (
          <button
            onClick={onSkip}
            className="w-full py-3 text-surface-500 rounded-xl font-medium hover:bg-surface-50 transition-colors"
          >
            Not Now
          </button>
        )}
      </div>
    </div>
  );
}


