import { useState, useEffect } from 'react';
import { type GlobalLocation, getGlobalLocation } from '../components/GlobalLocationPicker';

export function useGlobalLocation() {
  const [location, setLocation] = useState<GlobalLocation | null>(getGlobalLocation());

  useEffect(() => {
    const handleUpdate = () => {
      setLocation(getGlobalLocation());
    };
    window.addEventListener('poolnear_location_updated', handleUpdate);
    return () => window.removeEventListener('poolnear_location_updated', handleUpdate);
  }, []);

  return location;
}
