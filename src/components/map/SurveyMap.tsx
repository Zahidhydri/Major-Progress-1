'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { Layers, Navigation, LocateFixed } from 'lucide-react';
import { calculateSurveyMetrics } from '@/lib/geo';

interface SurveyMapProps {
  roverLocation: GpsLocation | null;
  capturedPoints: CapturedPoint[];
  autoFollow: boolean;
  onToggleAutoFollow: () => void;
  onSelectPoint?: (point: CapturedPoint) => void;
  onUpdatePointLocation?: (id: string, lat: number, lng: number) => void;
  searchedPlace?: GeocodedPlace | null;
  mapStyle?: 'osm' | 'street' | 'topo' | 'satellite';
  centerOnUserTrigger?: number;
}

function MapController({
  roverLocation,
  autoFollow,
  searchedPlace,
  centerOnUserTrigger,
  onUserLocationFound,
}: {
  roverLocation: GpsLocation | null;
  autoFollow: boolean;
  searchedPlace?: GeocodedPlace | null;
  centerOnUserTrigger?: number;
  onUserLocationFound: (lat: number, lng: number, acc?: number) => void;
}) {
  const map = useMap();
  const hasCenteredInitial = useRef(false);
  const lastTriggerRef = useRef(0);
  const roverRef = useRef(roverLocation);

  useEffect(() => {
    roverRef.current = roverLocation;
  }, [roverLocation]);

  // Auto-center on initial load
  useEffect(() => {
    if (!hasCenteredInitial.current) {
      if (roverLocation) {
        map.setView([roverLocation.lat, roverLocation.lng], 18, { animate: true });
        hasCenteredInitial.current = true;
      } else if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            onUserLocationFound(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
            if (!hasCenteredInitial.current && !roverRef.current) {
              map.setView([pos.coords.latitude, pos.coords.longitude], 17, { animate: true });
              hasCenteredInitial.current = true;
            }
          },
          (err) => console.log('Initial location fallback:', err.message),
          { timeout: 5000 }
        );
      }
    }
  }, [map, roverLocation, onUserLocationFound]);

  // Follow active position if autoFollow is enabled
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

  // Clean discrete manual centering (NO FLICKER / NO CONTINUOUS LOOP)
  useEffect(() => {
    if (centerOnUserTrigger && centerOnUserTrigger > lastTriggerRef.current) {
      lastTriggerRef.current = centerOnUserTrigger;
      const activeRover = roverRef.current;
      if (activeRover) {
        map.flyTo([activeRover.lat, activeRover.lng], 18, { animate: true, duration: 1.0 });
      } else if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            onUserLocationFound(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
            map.flyTo([pos.coords.latitude, pos.coords.longitude], 18, { animate: true, duration: 1.0 });
          },
          (err) => console.warn('Center geolocation error:', err.message),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }
  }, [centerOnUserTrigger, map, onUserLocationFound]);

  return null;
}

export default function SurveyMap({
  roverLocation,
  capturedPoints,
  autoFollow,
  onToggleAutoFollow,
  onSelectPoint,
  onUpdatePointLocation,
  searchedPlace,
  mapStyle = 'osm',
  centerOnUserTrigger = 0,
}: SurveyMapProps) {
  const [mapType, setMapType] = useState<'osm' | 'street' | 'topo' | 'satellite'>(mapStyle);
  const [showAccuracyCircle, setShowAccuracyCircle] = useState(true);
  const [localCenterTrigger, setLocalCenterTrigger] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  useEffect(() => {
    setMapType(mapStyle);
  }, [mapStyle]);

  const handleUserLocationFound = useCallback((lat: number, lng: number, accuracy?: number) => {
    setUserLocation({ lat, lng, accuracy });
  }, []);

  const effectiveTrigger = centerOnUserTrigger + localCenterTrigger;

  // Compute enclosed land metrics
  const metrics = useMemo(() => calculateSurveyMetrics(capturedPoints), [capturedPoints]);

  // Default fallback center
  const defaultCenter: [number, number] = roverLocation
    ? [roverLocation.lat, roverLocation.lng]
    : userLocation
    ? [userLocation.lat, userLocation.lng]
    : searchedPlace
    ? [searchedPlace.lat, searchedPlace.lng]
    : [27.7172, 85.3240];

  const tileLayers = {
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      maxNativeZoom: 19,
    },
    street: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxNativeZoom: 18,
    },
    topo: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxNativeZoom: 18,
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxNativeZoom: 18,
    },
  };

  // User Device Location Marker
  const userIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 26px; height: 26px; background: rgba(16, 185, 129, 0.25); border-radius: 50%;"></div>
          <div style="width: 14px; height: 14px; background: #10b981; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 10;"></div>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -13],
    });
  }, []);

  // Rover Marker
  const roverIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-rover-marker',
      html: `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 28px; height: 28px; background: rgba(59, 130, 246, 0.25); border-radius: 50%;"></div>
          <div style="width: 16px; height: 16px; background: #2563eb; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index: 10;"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }, []);

  // Searched Place Marker
  const searchPlaceIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-search-marker',
      html: `
        <div style="width: 28px; height: 28px; background: #7c3aed; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);">
          📍
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }, []);

  // Intelligent Polygon Centroid Area Marker Icon
  const centroidIcon = useMemo(() => {
    if (!metrics) return null;
    return L.divIcon({
      className: 'custom-centroid-marker',
      html: `
        <div style="background: rgba(15, 23, 42, 0.92); border: 2px solid #38bdf8; border-radius: 12px; padding: 6px 10px; color: #ffffff; font-family: monospace; font-size: 11px; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,0.4); backdrop-filter: blur(4px); white-space: nowrap;">
          <div style="font-weight: 800; color: #38bdf8; font-size: 11px;">📐 ENCLOSED LAND AREA</div>
          <div style="font-weight: 700; font-size: 13px; color: #f8fafc; margin-top: 1px;">
            ${metrics.areaSqMeters.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²
          </div>
          <div style="font-size: 10px; color: #fbbf24; margin-top: 1px;">
            ${metrics.areaAcres.toFixed(3)} Acres | ${metrics.perimeterMeters.toFixed(1)}m
          </div>
        </div>
      `,
      iconSize: [160, 54],
      iconAnchor: [80, 27],
    });
  }, [metrics]);

  const createPointIcon = (pointNum: number) => {
    return L.divIcon({
      className: 'custom-point-marker',
      html: `<div style="width: 24px; height: 24px; background: #0f172a; border: 2px solid #0ea5e9; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-weight: 600; font-size: 11px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: grab;">${pointNum}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  };

  const polygonCoords = useMemo<[number, number][]>(() => {
    return capturedPoints.map((p) => [p.lat, p.lng]);
  }, [capturedPoints]);

  return (
    <div className="relative w-full h-full bg-slate-950 font-sans">
      <MapContainer
        center={defaultCenter}
        zoom={17}
        maxZoom={20}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          key={mapType}
          attribution={tileLayers[mapType].attribution}
          url={tileLayers[mapType].url}
          maxZoom={20}
          maxNativeZoom={tileLayers[mapType].maxNativeZoom}
        />

        {mapType === 'satellite' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
            maxNativeZoom={18}
          />
        )}

        <MapController
          roverLocation={roverLocation}
          autoFollow={autoFollow}
          searchedPlace={searchedPlace}
          centerOnUserTrigger={effectiveTrigger}
          onUserLocationFound={handleUserLocationFound}
        />

        {/* User Location Marker */}
        {userLocation && !roverLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
            zIndexOffset={1100}
          >
            <Popup>
              <div className="p-1.5 text-xs font-mono text-slate-900">
                <div className="font-bold text-emerald-700">📍 Your Device Location</div>
                <div>Lat: {userLocation.lat.toFixed(6)}°</div>
                <div>Lng: {userLocation.lng.toFixed(6)}°</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Rover Accuracy Circle */}
        {roverLocation && showAccuracyCircle && roverLocation.accuracy && (
          <Circle
            center={[roverLocation.lat, roverLocation.lng]}
            radius={roverLocation.accuracy}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 1,
              dashArray: '3, 4',
            }}
          />
        )}

        {/* Active Rover / Position Marker */}
        {roverLocation && (
          <Marker
            position={[roverLocation.lat, roverLocation.lng]}
            icon={roverIcon}
            zIndexOffset={1000}
          >
            <Popup className="custom-popup">
              <div className="p-2 text-xs font-mono text-slate-100 min-w-[180px]">
                <div className="font-semibold text-blue-400 border-b pb-1 mb-1 border-slate-700">
                  Active Position
                </div>
                <div className="space-y-1">
                  <div>Lat: {roverLocation.lat.toFixed(7)}°</div>
                  <div>Lng: {roverLocation.lng.toFixed(7)}°</div>
                  {roverLocation.accuracy !== undefined && (
                    <div className="text-emerald-400">Accuracy: ±{roverLocation.accuracy.toFixed(2)}m</div>
                  )}
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

        {/* Boundary guide line from last point to active position */}
        {roverLocation && capturedPoints.length > 0 && (
          <Polyline
            positions={[
              [capturedPoints[capturedPoints.length - 1].lat, capturedPoints[capturedPoints.length - 1].lng],
              [roverLocation.lat, roverLocation.lng],
            ]}
            pathOptions={{
              color: '#38bdf8',
              weight: 2,
              dashArray: '4, 4',
              opacity: 0.7,
            }}
          />
        )}

        {/* Intelligent Enclosed Area Polygon (when 3 or more points exist) */}
        {capturedPoints.length >= 3 && (
          <Polygon
            positions={polygonCoords}
            pathOptions={{
              color: '#0284c7',
              weight: 2.5,
              fillColor: '#38bdf8',
              fillOpacity: 0.22,
            }}
          >
            <Popup>
              <div className="p-2 text-xs font-mono text-slate-900 space-y-1">
                <div className="font-bold text-sky-700 border-b pb-1 border-slate-300">
                  📐 Intelligent Enclosed Boundary
                </div>
                {metrics && (
                  <>
                    <div className="font-semibold text-slate-800">
                      Area: {metrics.areaSqMeters.toLocaleString(undefined, { maximumFractionDigits: 1 })} m² ({metrics.areaAcres.toFixed(3)} acres)
                    </div>
                    <div>Perimeter: {metrics.perimeterMeters.toFixed(1)} meters</div>
                  </>
                )}
                <div className="text-[10px] text-slate-500">Vertices: {capturedPoints.length} points</div>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* Intelligent Centroid Area Badge Marker */}
        {metrics && metrics.centroid && capturedPoints.length >= 3 && centroidIcon && (
          <Marker
            position={[metrics.centroid.lat, metrics.centroid.lng]}
            icon={centroidIcon}
            interactive={false}
            zIndexOffset={800}
          />
        )}

        {/* Polyline for 2 points */}
        {capturedPoints.length === 2 && (
          <Polyline
            positions={polygonCoords}
            pathOptions={{
              color: '#0284c7',
              weight: 2.5,
            }}
          />
        )}

        {/* Boundary Vertex Markers (Draggable for Manual Editing!) */}
        {capturedPoints.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={createPointIcon(point.pointNumber)}
            draggable={true}
            eventHandlers={{
              click: () => onSelectPoint && onSelectPoint(point),
              dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                if (onUpdatePointLocation) {
                  onUpdatePointLocation(point.id, pos.lat, pos.lng);
                }
              },
            }}
          >
            <Popup>
              <div className="p-1.5 text-xs font-mono text-slate-100">
                <div className="font-semibold text-sky-400 border-b border-slate-700 pb-1 mb-1 flex items-center justify-between">
                  <span>Point #{point.pointNumber}</span>
                  <span className="text-[9px] bg-slate-800 px-1 py-0.5 rounded text-slate-400">Draggable</span>
                </div>
                <div>Lat: {point.lat.toFixed(7)}°</div>
                <div>Lng: {point.lng.toFixed(7)}°</div>
                <div className="text-[10px] text-slate-400 mt-1">Drag marker on map to adjust location</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating Map Controls (Mobile Top-Left below search, Desktop Bottom-Left) */}
      <div className="absolute top-16 left-4 z-[450] md:bottom-6 md:top-auto md:left-6 flex items-center space-x-2 font-sans">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center space-x-1.5 shadow-xl">
          <button
            onClick={() => setLocalCenterTrigger((prev) => prev + 1)}
            title="Center Map on Active Position"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-200 hover:text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>Center Location</span>
          </button>

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
            title="Switch Map Style"
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="capitalize">{mapType}</span>
          </button>

          <button
            onClick={onToggleAutoFollow}
            title={autoFollow ? 'Auto-follow active position' : 'Free camera'}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              autoFollow
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {autoFollow ? 'Following' : 'Free Cam'}
          </button>
        </div>
      </div>
    </div>
  );
}
