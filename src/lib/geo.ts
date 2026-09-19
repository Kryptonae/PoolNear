// ═══════════════════════════════════════════════════════════════════
// PoolNear — Geolocation Utilities
// Browser Geolocation API wrapper + Haversine distance calculation
// ═══════════════════════════════════════════════════════════════════

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeoError {
  code: number;
  message: string;
}

/**
 * Request location permission and get current position.
 * Returns coordinates on success, throws GeoError on failure.
 */
export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 0,
        message: 'Geolocation is not supported by your browser.',
      } as GeoError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let message: string;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable it in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable. Please try again.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
          default:
            message = 'An unknown error occurred while getting your location.';
        }
        reject({ code: error.code, message } as GeoError);
      },
      {
        enableHighAccuracy: false, // approximate is fine for privacy
        timeout: 10000,
        maximumAge: 300000, // cache for 5 minutes
      }
    );
  });
}

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format a distance in meters into a human-readable string.
 * Examples: "80 m away", "1.2 km away"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m away`;
  }
  return `${(meters / 1000).toFixed(1)} km away`;
}

/**
 * Check if a point is within a given radius (meters) of another point.
 */
export function isWithinRadius(
  center: Coordinates,
  point: Coordinates,
  radiusMeters: number
): boolean {
  const distance = haversineDistance(
    center.latitude,
    center.longitude,
    point.latitude,
    point.longitude
  );
  return distance <= radiusMeters;
}

/**
 * Check if the browser supports geolocation.
 */
export function isGeolocationSupported(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Check current geolocation permission status without prompting.
 * Returns 'granted', 'denied', or 'prompt'.
 */
export async function getPermissionStatus(): Promise<PermissionState> {
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    // Permissions API not supported — assume 'prompt'
    return 'prompt';
  }
}
