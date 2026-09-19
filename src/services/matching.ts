// ═══════════════════════════════════════════════════════════════════
// PoolNear — Smart Matching Service
// Finds compatible nearby pools for a given requirement
// ═══════════════════════════════════════════════════════════════════

import type { PoolWithDistance } from './pools';
import type { PlatformKey } from '../lib/constants';

export interface MatchCandidate {
  pool: PoolWithDistance;
  score: number;            // 0–100 overall match score
  reasons: string[];        // Human-readable match reasons
  distanceMeters: number;
  amountNeeded: number;
  timeCompatible: boolean;
  platformMatch: boolean;
}

export interface MatchCriteria {
  platform: PlatformKey;
  amount: number;
  latitude: number;
  longitude: number;
  maximumDistance: number;   // meters
  requiredBy: string;       // ISO date
  minimumOrderValue: number;
}

/**
 * Score and rank nearby pools against user criteria.
 * Returns sorted array of match candidates with scores and explanations.
 */
export function findBestMatches(
  pools: PoolWithDistance[],
  criteria: MatchCriteria
): MatchCandidate[] {
  return pools
    .map((pool) => scorePool(pool, criteria))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
}

function scorePool(
  pool: PoolWithDistance,
  criteria: MatchCriteria
): MatchCandidate {
  const reasons: string[] = [];
  let score = 0;
  const maxScore = 100;

  // 1. Platform compatibility (required — 0 or 30 points)
  const platformMatch = pool.platform === criteria.platform;
  if (platformMatch) {
    score += 30;
    reasons.push(`Same platform: ${pool.platform}`);
  } else {
    // Wrong platform — disqualify
    return {
      pool, score: 0, reasons: ['Different platform'], distanceMeters: pool.distance_meters,
      amountNeeded: Math.max(pool.minimum_order_value - pool.current_total, 0),
      timeCompatible: false, platformMatch: false,
    };
  }

  // 2. Geographic distance (up to 25 points)
  const distanceMeters = pool.distance_meters;
  if (distanceMeters <= criteria.maximumDistance) {
    const distanceFraction = 1 - (distanceMeters / criteria.maximumDistance);
    const distanceScore = Math.round(distanceFraction * 25);
    score += distanceScore;
    if (distanceMeters < 200) {
      reasons.push('Very close by');
    } else if (distanceMeters < 500) {
      reasons.push('Nearby');
    } else {
      reasons.push('Within range');
    }
  } else {
    return {
      pool, score: 0, reasons: ['Too far away'], distanceMeters,
      amountNeeded: Math.max(pool.minimum_order_value - pool.current_total, 0),
      timeCompatible: false, platformMatch: true,
    };
  }

  // 3. Amount compatibility (up to 20 points)
  const amountNeeded = Math.max(pool.minimum_order_value - pool.current_total, 0);
  if (criteria.amount >= amountNeeded && amountNeeded > 0) {
    score += 20;
    reasons.push(`Your ₹${criteria.amount} covers the remaining ₹${amountNeeded.toFixed(0)}`);
  } else if (amountNeeded <= criteria.minimumOrderValue * 0.3) {
    // Pool is almost full
    score += 18;
    reasons.push(`Almost ready — only ₹${amountNeeded.toFixed(0)} more needed`);
  } else if (amountNeeded > 0) {
    const amountFraction = Math.min(criteria.amount / amountNeeded, 1);
    score += Math.round(amountFraction * 15);
    reasons.push(`₹${amountNeeded.toFixed(0)} more needed`);
  }

  // 4. Time compatibility (up to 15 points)
  const poolDeadline = new Date(pool.required_by).getTime();
  const userDeadline = new Date(criteria.requiredBy).getTime();
  const timeCompatible = poolDeadline <= userDeadline;
  if (timeCompatible) {
    score += 15;
    reasons.push('Timing works');
  } else {
    const timeDiffHours = (poolDeadline - userDeadline) / (1000 * 60 * 60);
    if (timeDiffHours <= 2) {
      score += 8;
      reasons.push('Timing is close');
    } else {
      score += 0;
      reasons.push('Pool deadline may be too late');
    }
  }

  // 5. Pool capacity (up to 10 points)
  const memberCount = Number(pool.member_count);
  const spotsLeft = pool.max_members - memberCount;
  if (spotsLeft > 0) {
    const capacityScore = Math.min(spotsLeft * 2, 10);
    score += capacityScore;
    if (spotsLeft === 1) {
      reasons.push('Last spot!');
    } else {
      reasons.push(`${spotsLeft} spots left`);
    }
  }

  // Clamp to max
  score = Math.min(score, maxScore);

  return {
    pool,
    score,
    reasons,
    distanceMeters,
    amountNeeded,
    timeCompatible,
    platformMatch,
  };
}

/**
 * Get a quality label for a match score.
 */
export function getMatchQuality(score: number): {
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
} {
  if (score >= 85) return { label: 'Perfect Match', color: '#059669', bgColor: '#ECFDF5', emoji: '🎯' };
  if (score >= 70) return { label: 'Great Match', color: '#10B981', bgColor: '#D1FAE5', emoji: '⭐' };
  if (score >= 50) return { label: 'Good Match', color: '#3B82F6', bgColor: '#DBEAFE', emoji: '👍' };
  if (score >= 30) return { label: 'Fair Match', color: '#F59E0B', bgColor: '#FEF3C7', emoji: '🤝' };
  return { label: 'Possible Match', color: '#6B7280', bgColor: '#F3F4F6', emoji: '🔍' };
}
