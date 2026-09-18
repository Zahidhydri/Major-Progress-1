'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { CapturedPoint, GpsLocation, GeocodedPlace } from '@/types/survey';
import { Layers, Navigation } from 'lucide-react';

interface SurveyMapProps {
  roverLocation: GpsLocation | null;
  capturedPoints: CapturedPoint[];
  autoFollow: boolean;
  onToggleAutoFollow: () => void;
  onSelectPoint?: (point: CapturedPoint) => void;
  searchedPlace?: GeocodedPlace | null;
  mapStyle?: 'osm' | 'street' | 'topo' | 'satellite';
}

// Controller component to auto-pan or fit bounds or fly to searched place
function MapController({
  roverLocation,
  autoFollow,
  searchedPlace,
}: {
  roverLocation: GpsLocation | null;
  autoFollow: boolean;
  searchedPlace?: GeocodedPlace | null;
}) {
  const map = useMap();
  const hasCenteredInitial = useRef(false);

  // Center on first coordinate received
  useEffect(() => {
    if (roverLocation && !hasCenteredInitial.current) {
      map.setView([roverLocation.lat, roverLocation.lng], 18, { animate: true });
      hasCenteredInitial.current = true;
    }
  }, [roverLocation, map]);

  // Follow rover if autoFollow is enabled
  useEffect(() => {
    if (roverLocation && autoFollow) {
      map.panTo([roverLocation.lat, roverLocation.lng], { animate: true, duration: 0.5 });
    }
  }, [roverLocation, autoFollow, map]);

  // Fly to searched place
  useEffect(() => {
    if (searchedPlace) {
      map.flyTo([searchedPlace.lat, searchedPlace.lng], 17, { animate: true, duration: 1.2 });
    }
  }, [searchedPlace, map]);

  return null;
}

export default function SurveyMap({
  roverLocation,
  capturedPoints,
  autoFollow,
  onToggleAutoFollow,
  onSelectPoint,
  searchedPlace,
  mapStyle = 'osm',
}: SurveyMapProps) {
  const [mapType, setMapType] = useState<'osm' | 'street' | 'topo' | 'satellite'>(mapStyle);
  const [showAccuracyCircle, setShowAccuracyCircle] = useState(true);

  useEffect(() => {
    setMapType(mapStyle);
  }, [mapStyle]);

  // Default fallback center
  const defaultCenter: [number, number] = roverLocation
    ? [roverLocation.lat, roverLocation.lng]
    : searchedPlace
    ? [searchedPlace.lat, searchedPlace.lng]
    : [27.7172, 85.3240];

  // 100% Free Public GIS Tile Layers (Zero API Keys required)
  const tileLayers = {
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    street: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
      maxZoom: 19,
    },
    topo: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), swisstopo, MapmyIndia, &copy; OpenStreetMap contributors',
      maxZoom: 19,
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19,
    },
  };

  // Custom Rover DivIcon
  const roverIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-rover-marker',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div class="rover-pulse-ring"></div>
          <div class="rover-pulse-ring-2"></div>
          <div style="width: 22px; height: 22px; background: #f59e0b; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 0 15px #f59e0b, 0 4px 6px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10;">
            <div style="width: 8px; height: 8px; background: #0f172a; border-radius: 50%;"></div>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }, []);

  // Custom Searched Place Icon
  const searchPlaceIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-search-marker',
      html: `
        <div style="width: 32px; height: 32px; background: #8b5cf6; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; box-shadow: 0 0 14px rgba(139, 92, 246, 0.9);">
          📍
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }, []);

  // Custom Boundary Point Icon generator
  const createPointIcon = (pointNum: number) => {
    return L.divIcon({
      className: 'custom-point-marker',
      html: `<div style="width: 26px; height: 26px; background: #0f172a; border: 2px solid #06b6d4; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-weight: 700; font-size: 11px; box-shadow: 0 0 10px rgba(6, 182, 212, 0.7);">${pointNum}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14],
    });
  };

  const polygonCoords = useMemo<[number, number][]>(() => {
    return capturedPoints.map((p) => [p.lat, p.lng]);
  }, [capturedPoints]);

  return (
    <div className="relative w-full h-full bg-slate-950">
      <MapContainer
        center={defaultCenter}
        zoom={17}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        {/* Base Map Tile Layer */}
        <TileLayer
          key={mapType}
          attribution={tileLayers[mapType].attribution}
          url={tileLayers[mapType].url}
          maxZoom={tileLayers[mapType].maxZoom}
        />

        {/* Overlay Street & Place Name Labels Layer on Satellite Mode */}
        {mapType === 'satellite' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        )}

        <MapController
          roverLocation={roverLocation}
          autoFollow={autoFollow}
          searchedPlace={searchedPlace}
        />

        {/* Accuracy radius ring */}
        {roverLocation && showAccuracyCircle && roverLocation.accuracy && (
          <Circle
            center={[roverLocation.lat, roverLocation.lng]}
            radius={roverLocation.accuracy}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#f59e0b',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '3, 4',
            }}
          />
        )}

        {/* Live Rover Marker */}
        {roverLocation && (
          <Marker
            position={[roverLocation.lat, roverLocation.lng]}
            icon={roverIcon}
            zIndexOffset={1000}
          >
            <Popup className="custom-popup">
              <div className="p-2 text-xs font-mono text-slate-100 min-w-[190px]">
                <div className="font-bold text-amber-500 flex items-center justify-between border-b pb-1 mb-1.5 border-slate-700">
                  <span>📡 LIVE POSITION</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">ACTIVE</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lat:</span>
                    <span className="font-semibold">{roverLocation.lat.toFixed(7)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lng:</span>
                    <span className="font-semibold">{roverLocation.lng.toFixed(7)}°</span>
                  </div>
                  {roverLocation.accuracy !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Accuracy:</span>
                      <span className="text-emerald-400 font-semibold">±{roverLocation.accuracy.toFixed(2)} m</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-slate-700/60 text-[10px] text-slate-400">
                    <span>Last Ping:</span>
                    <span>{new Date(roverLocation.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Searched Place Marker */}
        {searchedPlace && (
          <Marker
            position={[searchedPlace.lat, searchedPlace.lng]}
            icon={searchPlaceIcon}
            zIndexOffset={900}
          >
            <Popup>
              <div className="p-1.5 text-xs font-mono text-slate-900">
                <div className="font-bold text-purple-700">{searchedPlace.shortName}</div>
                <div className="text-[10px] text-slate-600">{searchedPlace.displayName}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Boundary guide line from last captured point to current rover */}
        {roverLocation && capturedPoints.length > 0 && (
          <Polyline
            positions={[
              [capturedPoints[capturedPoints.length - 1].lat, capturedPoints[capturedPoints.length - 1].lng],
              [roverLocation.lat, roverLocation.lng],
            ]}
            pathOptions={{
              color: '#38bdf8',
              weight: 2,
              dashArray: '5, 5',
              opacity: 0.7,
            }}
          />
        )}

        {/* Polygon for 3+ points */}
        {capturedPoints.length >= 3 && (
          <Polygon
            positions={polygonCoords}
            pathOptions={{
              color: '#06b6d4',
              weight: 3,
              fillColor: '#06b6d4',
              fillOpacity: 0.22,
            }}
          >
            <Popup>
              <div className="text-xs font-mono p-1">
                <div className="font-bold text-cyan-400">Enclosed Survey Boundary</div>
                <div>{capturedPoints.length} boundary vertices</div>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* Polyline for 2 points */}
        {capturedPoints.length === 2 && (
          <Polyline
            positions={polygonCoords}
            pathOptions={{
              color: '#06b6d4',
              weight: 3,
              opacity: 0.9,
            }}
          />
        )}

        {/* Points Markers */}
        {capturedPoints.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={createPointIcon(point.pointNumber)}
            eventHandlers={{
              click: () => onSelectPoint && onSelectPoint(point),
            }}
          >
            <Popup>
              <div className="p-1.5 text-xs font-mono text-slate-100">
                <div className="font-bold text-cyan-400 border-b border-cyan-800 pb-1 mb-1">
                  Point #{point.pointNumber}
                </div>
                <div>Lat: {point.lat.toFixed(7)}°</div>
                <div>Lng: {point.lng.toFixed(7)}°</div>
                {point.accuracy !== undefined && (
                  <div className="text-emerald-400">Acc: ±{point.accuracy.toFixed(2)} m</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating Map Control Bar (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-[400] flex items-center space-x-2">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center space-x-1 shadow-2xl">
          <button
            onClick={() =>
              setMapType(
                mapType === 'osm'
                  ? 'street'
                  : mapType === 'street'
                  ? 'topo'
                  : mapType === 'topo'
                  ? 'satellite'
                  : 'osm'
              )
            }
            title="Switch Map Layer (OSM / World Street / Topo / Satellite with Place Names)"
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="capitalize">{mapType}</span>
          </button>

          <button
            onClick={onToggleAutoFollow}
            title={autoFollow ? 'Auto-follow Rover (Enabled)' : 'Auto-follow Rover (Disabled)'}
            className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              autoFollow
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700'
            }`}
          >
            <Navigation className={`w-3.5 h-3.5 ${autoFollow ? 'text-amber-400 animate-pulse' : ''}`} />
            <span>{autoFollow ? 'Following' : 'Free Cam'}</span>
          </button>

          <button
            onClick={() => setShowAccuracyCircle(!showAccuracyCircle)}
            title="Toggle Accuracy Circle"
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${
              showAccuracyCircle
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
          >
            ± Accuracy
          </button>
        </div>
      </div>
    </div>
  );
}
