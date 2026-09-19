// ═══════════════════════════════════════════════════════════════════
// PoolNear — Geolocation Hook
// React hook wrapping the geolocation utilities with state management
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { getCurrentPosition, getPermissionStatus, type Coordinates, type GeoError } from '../lib/geo';
import { useAuth } from '../contexts/AuthContext';

interface GeolocationState {
  coordinates: Coordinates | null;
  loading: boolean;
  error: string | null;
  permissionState: PermissionState | null;
}

export function useGeolocation() {
  const { updateProfile } = useAuth();
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    loading: false,
    error: null,
    permissionState: null,
  });

  const checkPermission = useCallback(async () => {
    const status = await getPermissionStatus();
    setState((prev) => ({ ...prev, permissionState: status }));
    return status;
  }, []);

  const requestLocation = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const coords = await getCurrentPosition();
      setState({
        coordinates: coords,
        loading: false,
        error: null,
        permissionState: 'granted',
      });

      // Save location to profile
      await updateProfile({
        latitude: coords.latitude,
        longitude: coords.longitude,
        location_permission: true,
      });

      return coords;
    } catch (err) {
      const geoError = err as GeoError;
      setState({
        coordinates: null,
        loading: false,
        error: geoError.message,
        permissionState: geoError.code === 1 ? 'denied' : 'prompt',
      });
      return null;
    }
  }, [updateProfile]);

  const clearLocation = useCallback(() => {
    setState({
      coordinates: null,
      loading: false,
      error: null,
      permissionState: null,
    });
  }, []);

  return {
    ...state,
    requestLocation,
    checkPermission,
    clearLocation,
  };
}
