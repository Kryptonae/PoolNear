import { supabase } from '../lib/supabase';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  display_name: string;
}

/**
 * Call the secure Edge Function to geocode an address (Forward Geocoding).
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const { data, error } = await supabase.functions.invoke('geocode', {
    body: { query: query.trim() },
  });

  if (error) {
    console.error('Geocoding error:', error);
    // Throw exact error rather than generic
    throw new Error(error.message || 'Failed to search location.');
  }

  if (data?.error) {
    console.error('Geocoding function error:', data.error);
    throw new Error(data.error);
  }

  return (data?.results || []) as GeocodeResult[];
}

/**
 * Call the secure Edge Function to reverse geocode coordinates into an address.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  const { data, error } = await supabase.functions.invoke('geocode', {
    body: { lat: latitude, lon: longitude },
  });

  if (error) {
    console.error('Reverse Geocoding error:', error);
    throw new Error(error.message || 'Failed to lookup address for coordinates.');
  }

  if (data?.error) {
    console.error('Reverse Geocoding function error:', data.error);
    throw new Error(data.error);
  }

  const results = data?.results || [];
  return results.length > 0 ? results[0] : null;
}
