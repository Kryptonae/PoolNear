// ═══════════════════════════════════════════════════════════════════
// PoolNear — App Configuration & Constants
// Central place to change app name, platforms, and defaults
// ═══════════════════════════════════════════════════════════════════

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'PoolNear';

// ─── SUPPORTED PLATFORMS ────────────────────────────────────────

export type PlatformKey = 'blinkit' | 'zepto' | 'swiggy_instamart' | 'flipkart_minutes' | 'bigbasket' | 'other';

export interface PlatformInfo {
  key: PlatformKey;
  label: string;
  color: string;
  bgColor: string;
  icon: string; // emoji or icon identifier
  defaultMinOrder: number;
}

export const PLATFORMS: Record<PlatformKey, PlatformInfo> = {
  blinkit: {
    key: 'blinkit',
    label: 'Blinkit',
    color: '#F5C518',
    bgColor: '#FEF9E7',
    icon: '⚡',
    defaultMinOrder: 99,
  },
  zepto: {
    key: 'zepto',
    label: 'Zepto',
    color: '#7B2D8E',
    bgColor: '#F3E8F9',
    icon: '🟣',
    defaultMinOrder: 99,
  },
  swiggy_instamart: {
    key: 'swiggy_instamart',
    label: 'Swiggy Instamart',
    color: '#FC8019',
    bgColor: '#FFF3E8',
    icon: '🧡',
    defaultMinOrder: 99,
  },
  flipkart_minutes: {
    key: 'flipkart_minutes',
    label: 'Flipkart Minutes',
    color: '#2874F0',
    bgColor: '#E8F0FE',
    icon: '💙',
    defaultMinOrder: 99,
  },
  bigbasket: {
    key: 'bigbasket',
    label: 'BigBasket',
    color: '#84C225',
    bgColor: '#F0F9E8',
    icon: '💚',
    defaultMinOrder: 99,
  },
  other: {
    key: 'other',
    label: 'Other',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '📦',
    defaultMinOrder: 99,
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);

// ─── RADIUS OPTIONS ─────────────────────────────────────────────

export interface RadiusOption {
  value: number;    // meters
  label: string;
}

export const RADIUS_OPTIONS: RadiusOption[] = [
  { value: 100, label: '100 m' },
  { value: 200, label: '200 m' },
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 2000, label: '2 km' },
];

export const DEFAULT_RADIUS = 500;

// ─── TIME OPTIONS ───────────────────────────────────────────────

export interface TimeOption {
  key: string;
  label: string;
  getExpiry: () => Date;
}

export const TIME_OPTIONS: TimeOption[] = [
  {
    key: '30min',
    label: '30 minutes',
    getExpiry: () => new Date(Date.now() + 30 * 60 * 1000),
  },
  {
    key: '1hr',
    label: '1 hour',
    getExpiry: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    key: 'today',
    label: 'Today',
    getExpiry: () => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    },
  },
  {
    key: 'tomorrow',
    label: 'Tomorrow',
    getExpiry: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 999);
      return d;
    },
  },
];

// ─── DESTINATION PRESETS ─────────────────────────────────────────

export const DESTINATION_PRESETS = [
  'Hostel Gate',
  'College Gate',
  'Security Desk',
  'Society Gate',
  'Nearby Park',
  'Metro Station',
];

// ─── POOL STATUS CONFIG ─────────────────────────────────────────

export type PoolStatusKey = 'waiting' | 'ready' | 'ordering' | 'order_placed' | 'delivering' | 'delivered' | 'completed' | 'failed' | 'expired' | 'cancelled';

export interface PoolStatusInfo {
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
}

export const POOL_STATUS: Record<PoolStatusKey, PoolStatusInfo> = {
  waiting:      { label: 'Waiting for Members', color: '#EAB308', bgColor: '#FEF9C3', emoji: '🟡' },
  ready:        { label: 'Ready to Order',      color: '#22C55E', bgColor: '#DCFCE7', emoji: '🟢' },
  ordering:     { label: 'Ordering',             color: '#3B82F6', bgColor: '#DBEAFE', emoji: '🔵' },
  order_placed: { label: 'Order Placed',         color: '#3B82F6', bgColor: '#DBEAFE', emoji: '🔵' },
  delivering:   { label: 'Delivering',           color: '#8B5CF6', bgColor: '#EDE9FE', emoji: '🚚' },
  delivered:    { label: 'Delivered',             color: '#06B6D4', bgColor: '#CFFAFE', emoji: '📦' },
  completed:    { label: 'Completed',            color: '#22C55E', bgColor: '#DCFCE7', emoji: '✅' },
  failed:       { label: 'Failed',               color: '#EF4444', bgColor: '#FEE2E2', emoji: '🔴' },
  expired:      { label: 'Expired',              color: '#6B7280', bgColor: '#F3F4F6', emoji: '⏰' },
  cancelled:    { label: 'Cancelled',            color: '#6B7280', bgColor: '#F3F4F6', emoji: '❌' },
};

// ─── CONSTANTS ───────────────────────────────────────────────────

export const MIN_POOL_MEMBERS = 2;
export const MAX_POOL_MEMBERS = 10;
export const DEFAULT_MAX_MEMBERS = 5;
export const DEFAULT_MIN_ORDER = 99;
export const ORDER_PROOF_TIMEOUT_HOURS = 2;
