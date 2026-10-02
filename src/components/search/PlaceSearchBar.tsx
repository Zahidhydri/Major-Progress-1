'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import { searchPlaces } from '@/lib/geocoding';
import { GeocodedPlace } from '@/types/survey';

interface PlaceSearchBarProps {
  onSelectPlace: (place: GeocodedPlace) => void;
  apiKey?: string;
  provider?: 'nominatim' | 'mapbox' | 'google';
}

export default function PlaceSearchBar({
  onSelectPlace,
  apiKey,
  provider = 'nominatim',
}: PlaceSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodedPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced place search
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      const res = await searchPlaces(query, apiKey, provider);
      setResults(res);
      setIsLoading(false);
      setIsOpen(true);
    }, 350);

    return () => clearTimeout(timer);
  }, [query, apiKey, provider]);

  const handleSelect = (place: GeocodedPlace) => {
    setQuery(place.shortName || place.displayName);
    setIsOpen(false);
    setIsMobileExpanded(false);
    onSelectPlace(place);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const openMobileSearch = () => {
    setIsMobileExpanded(true);
    setTimeout(() => {
      mobileInputRef.current?.focus();
    }, 100);
  };

  return (
    <div ref={containerRef} className="relative font-sans">
      {/* Mobile Trigger Button (Visible on screens smaller than md) */}
      <div className="md:hidden">
        <button
          onClick={openMobileSearch}
          className="bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 text-xs text-slate-300 shadow-md transition active:scale-95"
          title="Search place..."
        >
          <Search className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-medium text-[11px] truncate max-w-[90px]">
            {query ? query : 'Search Place'}
          </span>
        </button>
      </div>

      {/* Desktop Search Bar (Visible on md and larger) */}
      <div className="hidden md:block relative w-64 lg:w-80">
        <div className="relative flex items-center">
          <div className="absolute left-3 text-slate-400 pointer-events-none">
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            placeholder="Search place, city, or boundary..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-900/90 text-slate-100 placeholder-slate-400 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-md transition"
          />

          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 p-0.5 text-slate-400 hover:text-white rounded-md transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Desktop Autocomplete Dropdown */}
        {isOpen && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-[600] max-h-64 overflow-y-auto divide-y divide-slate-800/80">
            <div className="px-3 py-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider bg-slate-950/80 flex items-center justify-between">
              <span>Places ({results.length})</span>
              <span className="text-[9px] text-cyan-400">OSM Nominatim</span>
            </div>
            {results.map((place) => (
              <button
                key={place.placeId}
                onClick={() => handleSelect(place)}
                className="w-full px-3 py-2 text-left hover:bg-slate-800/90 transition flex items-start space-x-2.5 group"
              >
                <MapPin className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                    {place.shortName || place.displayName.split(',')[0]}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {place.displayName}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Expanded Full-Screen Search Modal */}
      {isMobileExpanded && (
        <div className="fixed inset-0 z-[800] bg-slate-950/95 backdrop-blur-md p-4 flex flex-col md:hidden animate-in fade-in duration-200">
          <div className="flex items-center space-x-2 mb-3">
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-cyan-400" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search place, city or address..."
                className="w-full pl-9 pr-8 py-2.5 text-xs bg-slate-900 text-slate-100 placeholder-slate-400 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 font-sans shadow-inner"
              />
              {query && (
                <button
                  onClick={handleClear}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsMobileExpanded(false)}
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl"
            >
              Cancel
            </button>
          </div>

          {/* Mobile Search Results List */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 space-x-2 text-xs font-mono">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Searching places...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((place) => (
                <button
                  key={place.placeId}
                  onClick={() => handleSelect(place)}
                  className="w-full p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-left hover:bg-slate-800 transition flex items-start space-x-3"
                >
                  <MapPin className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {place.shortName || place.displayName.split(',')[0]}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                      {place.displayName}
                    </div>
                  </div>
                </button>
              ))
            ) : query.trim().length >= 2 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                No matching places found.
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                Type city or location name to search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

