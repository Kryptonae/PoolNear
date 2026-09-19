// ═══════════════════════════════════════════════════════════════════
// PoolNear — Notifications Page
// View and manage notifications
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/pools';
import { LoadingState, EmptyState } from '../components/ui';
import { Bell, CheckCheck, ChevronRight, UserPlus, CreditCard, ShoppingBag, PackageCheck, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'member_joined':
    case 'connection_request':
    case 'connection_accepted':
      return <UserPlus size={18} className="text-blue-500" />;
    case 'payment_sent':
    case 'payment_confirmed':
      return <CreditCard size={18} className="text-emerald-500" />;
    case 'order_placed':
    case 'pool_ready':
      return <ShoppingBag size={18} className="text-brand-500" />;
    case 'order_delivered':
    case 'receipt_confirmed':
    case 'pool_completed':
      return <PackageCheck size={18} className="text-emerald-500" />;
    case 'pool_failed':
    case 'pool_expired':
      return <AlertCircle size={18} className="text-red-500" />;
    default:
      return <Bell size={18} className="text-brand-500" />;
  }
}

export function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const data = await getNotifications(profile.id);
      setNotifications(data as Notification[]);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function handleMarkAllRead() {
    if (!profile?.id) return;
    await markAllNotificationsRead(profile.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleNotificationClick(notif: Notification) {
    if (!notif.read) {
      await markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, read: true } : n)
      );
    }
    // Navigate to relevant pool if data contains pool_id
    const poolId = notif.data?.pool_id as string | undefined;
    if (poolId) {
      navigate(`/pool/${poolId}`);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) return <LoadingState message="Loading notifications..." />;

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Bell size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-surface-500">{unreadCount} unread</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-brand-600 font-medium hover:text-brand-700 flex items-center gap-1"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} />}
          title="No notifications"
          description="You'll receive notifications when pools near you match your requirements."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-sm active:scale-[0.99] ${
                notif.read
                  ? 'bg-white border-surface-200'
                  : 'bg-brand-50/50 border-brand-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                    )}
                    <div className="flex-shrink-0 bg-surface-100 p-1.5 rounded-lg">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <p className={`text-sm font-semibold truncate ${notif.read ? 'text-surface-700' : 'text-surface-900'}`}>
                      {notif.title}
                    </p>
                  </div>
                  <p className="text-sm text-surface-500 mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-xs text-surface-400 mt-1">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!!notif.data?.pool_id && (
                  <ChevronRight size={16} className="text-surface-300 flex-shrink-0 mt-1" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
