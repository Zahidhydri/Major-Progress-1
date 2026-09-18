'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { CapturedPoint, GpsLocation, GeocodedPlace } from '@/types/survey';

interface DynamicMapProps {
  roverLocation: GpsLocation | null;
  capturedPoints: CapturedPoint[];
  autoFollow: boolean;
  onToggleAutoFollow: () => void;
  onSelectPoint?: (point: CapturedPoint) => void;
  searchedPlace?: GeocodedPlace | null;
  mapStyle?: 'osm' | 'street' | 'topo' | 'satellite';
}

// Dynamically import SurveyMap with SSR disabled to prevent window is not defined errors
const SurveyMap = dynamic(() => import('./SurveyMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 animate-ping absolute"></div>
        <div className="w-12 h-12 rounded-full border-2 border-cyan-500/40 animate-spin flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
      <p className="text-sm font-mono font-medium text-slate-300 tracking-wider">
        INITIALIZING GIS MAP ENGINE...
      </p>
      <p className="text-xs text-slate-500 mt-1">Loading Leaflet Vector Layer</p>
    </div>
  ),
});

export default function DynamicMap(props: DynamicMapProps) {
  return <SurveyMap {...props} />;
}
