import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, CheckCircle2, Loader2, Edit2, X } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { geocodeAddress, reverseGeocode, type GeocodeResult } from '../services/geocoding';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import { useDebounce } from 'use-debounce';

// Fix Leaflet default icon issues in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

function MapEvents({ onLocationClick }: { onLocationClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface LocationInputProps {
  onLocationSelect: (location: { destination: string; latitude: number; longitude: number } | null) => void;
  defaultDestination?: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
}

export function LocationInput({ 
  onLocationSelect, 
  defaultDestination = '',
  defaultLatitude,
  defaultLongitude
}: LocationInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 400);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  
  const [selectedLocation, setSelectedLocation] = useState<{ destination: string; latitude: number; longitude: number } | null>(
    defaultDestination && defaultLatitude && defaultLongitude 
      ? { destination: defaultDestination, latitude: defaultLatitude, longitude: defaultLongitude }
      : null
  );
  const { error: geoError, requestLocation } = useGeolocation();

  useEffect(() => {
    async function performSearch() {
      if (!debouncedQuery.trim() || debouncedQuery.trim().length < 3) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      
      setIsSearching(true);
      try {
        const results = await geocodeAddress(debouncedQuery);
        setSearchResults(results);
      } catch (err: any) {
        // Silently handle search errors during live search to avoid spamming toasts
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }
    
    performSearch();
  }, [debouncedQuery]);

  const handleUseCurrentLocation = async () => {
    setIsGpsLoading(true);
    setSelectedLocation(null);
    onLocationSelect(null);
    setSearchQuery('');
    
    const coords = await requestLocation();
    
    if (coords) {
      // Reverse geocode the GPS coordinates
      try {
        const result = await reverseGeocode(coords.latitude, coords.longitude);
        const loc = {
          destination: result?.display_name || 'Location found — address unavailable',
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        
        if (!result) {
          toast.success('Location found, but we couldn\'t determine the address.');
        }
        
        setSelectedLocation(loc);
        onLocationSelect(loc);
      } catch (err: any) {
        // GPS succeeded, but reverse geocoding failed. Do not discard coordinates.
        const loc = {
          destination: 'Location found — address unavailable',
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        toast.error('Location found, but address lookup failed. Please confirm or edit.');
        setSelectedLocation(loc);
        onLocationSelect(loc);
      } finally {
        setIsGpsLoading(false);
      }
    } else {
      setIsGpsLoading(false);
    }
  };
  
  // Show GPS error toast when it updates
  useEffect(() => {
    if (geoError && isGpsLoading) {
      toast.error(`GPS Error: ${geoError}`);
    }
  }, [geoError, isGpsLoading]);

  const handleSelectResult = (result: GeocodeResult) => {
    const loc = {
      destination: result.display_name,
      latitude: result.latitude,
      longitude: result.longitude,
    };
    setSelectedLocation(loc);
    onLocationSelect(loc);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedLocation(null);
    onLocationSelect(null);
  };

    const mapClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMapClick = (lat: number, lng: number) => {
      // Immediate optimistic update of coordinates without aggressive API calls
      const loc = {
        destination: 'Pinned location... resolving address',
        latitude: lat,
        longitude: lng
      };
      setSelectedLocation(loc);
      onLocationSelect(loc);

      if (mapClickTimeout.current) clearTimeout(mapClickTimeout.current);
      
      mapClickTimeout.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const result = await reverseGeocode(lat, lng);
          const resolvedLoc = {
            destination: result?.display_name || 'Location found — address unavailable',
            latitude: lat,
            longitude: lng
          };
          setSelectedLocation(resolvedLoc);
          onLocationSelect(resolvedLoc);
        } catch (err) {
          const errorLoc = { destination: 'Location found — address unavailable', latitude: lat, longitude: lng };
          setSelectedLocation(errorLoc);
          onLocationSelect(errorLoc);
        } finally {
          setIsSearching(false);
        }
      }, 1500);
    };

  return (
    <div className="space-y-3">
      {selectedLocation ? (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3">
            <div className="mt-0.5 text-emerald-600 shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-900 line-clamp-2">
                {selectedLocation.destination}
              </p>
              <p className="text-xs text-emerald-700 mt-1 font-mono">
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </p>
            </div>
            <button 
              type="button"
              onClick={handleClear}
              className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors shrink-0"
              title="Edit location"
            >
              <Edit2 size={16} />
            </button>
          </div>
          
          <div className="h-48 w-full rounded-xl overflow-hidden border border-surface-200 shadow-sm relative z-0">
            {isSearching && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-[1000] flex items-center justify-center">
                <Loader2 className="animate-spin text-brand-500" size={24} />
              </div>
            )}
            <MapContainer 
              center={[selectedLocation.latitude, selectedLocation.longitude]} 
              zoom={15} 
              scrollWheelZoom={true} 
              className="h-full w-full"
            >
              <TileLayer 
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
              />
              <Marker position={[selectedLocation.latitude, selectedLocation.longitude]} />
              <MapUpdater center={[selectedLocation.latitude, selectedLocation.longitude]} />
              <MapEvents onLocationClick={handleMapClick} />
            </MapContainer>
          </div>
          <p className="text-[10px] text-surface-400 text-center uppercase tracking-wide">
            Tap map to adjust location
          </p>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="relative flex gap-2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for area, street name..."
              className="flex-1 w-full bg-surface-50 border border-surface-200 text-surface-900 text-sm rounded-xl pl-10 pr-10 py-3 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all placeholder:text-surface-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {!searchQuery.trim() ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isGpsLoading}
                className="w-full flex items-center gap-3 p-3 bg-white border border-surface-200 rounded-xl hover:bg-brand-50 hover:border-brand-200 transition-all active:scale-[0.98] disabled:opacity-50 text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                  {isGpsLoading ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-brand-700">Use current location</div>
                  <div className="text-xs text-brand-500/70">Using GPS</div>
                </div>
              </button>

              {/* In the future, saved locations would go here */}
            </div>
          ) : (
            <div className="bg-white border border-surface-200 rounded-xl shadow-sm overflow-hidden divide-y divide-surface-100 min-h-[100px] relative">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-8 text-surface-400">
                  <Loader2 className="animate-spin mb-2" size={24} />
                  <span className="text-sm font-medium">Searching...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((res, i) => {
                  const parts = res.display_name.split('\n');
                  const mainName = parts[0];
                  const subName = parts.length > 1 ? parts.slice(1).join(', ') : '';
                  
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectResult(res)}
                      className="w-full text-left p-3 hover:bg-brand-50 transition-colors flex gap-3 items-start group"
                    >
                      <MapPin size={18} className="text-surface-400 group-hover:text-brand-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-surface-900 group-hover:text-brand-700 truncate">
                          {mainName}
                        </span>
                        {subName && (
                          <span className="block text-xs text-surface-500 line-clamp-1 mt-0.5">
                            {subName}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : debouncedQuery.length >= 3 ? (
                <div className="flex flex-col items-center justify-center py-8 text-surface-500">
                  <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mb-3">
                    <MapPin size={20} className="text-surface-400" />
                  </div>
                  <span className="text-sm font-semibold text-surface-900">No locations found</span>
                  <span className="text-xs mt-1">Try a nearby area, landmark, or street name.</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-surface-400">
                  <span className="text-sm font-medium">Type at least 3 characters...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
