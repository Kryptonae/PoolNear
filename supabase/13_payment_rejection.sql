-- ═══════════════════════════════════════════════════════════════════
-- PoolNear — Migration 13: Payment Rejection Flow (ENUM ONLY)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Safely add 'payment_rejected' to notification_type
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_rejected';
