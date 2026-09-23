import { useState, useEffect } from 'react';
import { LocationInput } from './LocationInput';

export interface GlobalLocation {
  destination: string;
  latitude: number;
  longitude: number;
}

export function getGlobalLocation(): GlobalLocation | null {
  try {
    const saved = localStorage.getItem('poolnear_global_location');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function setGlobalLocation(loc: GlobalLocation) {
  localStorage.setItem('poolnear_global_location', JSON.stringify(loc));
  window.dispatchEvent(new Event('poolnear_location_updated'));
}

export function GlobalLocationPicker() {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    if (!getGlobalLocation()) {
      setIsOpen(true);
    }
    
    // Listen for events to show it manually if needed
    const handleShow = () => setIsOpen(true);
    window.addEventListener('poolnear_request_location', handleShow);
    return () => window.removeEventListener('poolnear_request_location', handleShow);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-0 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-surface-200">
        <div className="p-8 text-center border-b border-surface-200 bg-surface-50/50">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner border border-brand-100">
            <span className="text-3xl">📍</span>
          </div>
          <h2 className="text-title-2 text-surface-900">Choose Your Location</h2>
          <p className="text-sm font-medium text-surface-500 mt-3 leading-relaxed">
            Choose where you are, or enter a different location manually.
          </p>
        </div>
        
        <div className="p-6 bg-surface-100">
          <LocationInput 
            onLocationSelect={(loc) => {
              if (loc) {
                setGlobalLocation(loc);
                setIsOpen(false);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
