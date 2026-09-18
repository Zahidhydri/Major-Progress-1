'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import DynamicMap from '@/components/map/DynamicMap';
import ControlPanel from '@/components/dashboard/ControlPanel';
import PlaceSearchBar from '@/components/search/PlaceSearchBar';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import SettingsModal from '@/components/modals/SettingsModal';
import {
  CapturedPoint,
  GpsLocation,
  MqttConnectionStatus,
  AppSettings,
  GeocodedPlace,
} from '@/types/survey';
import { DEFAULT_MQTT_CONFIG, parseTelemetryPayload } from '@/lib/mqtt';
import { calculateDistanceMeters } from '@/lib/geo';
import { Compass } from 'lucide-react';

export default function DashboardPage() {
  // App Settings
  const [settings, setSettings] = useState<AppSettings>({
    locationSource: 'mqtt',
    autoCaptureEnabled: false,
    autoCaptureDistance: 3, // meters
    mqttBrokerUrl: process.env.NEXT_PUBLIC_MQTT_BROKER || DEFAULT_MQTT_CONFIG.brokerUrl,
    mqttTopic: process.env.NEXT_PUBLIC_MQTT_TOPIC || DEFAULT_MQTT_CONFIG.topic,
    mapStyle: 'osm',
  });

  // Location & Telemetry State
  const [roverLocation, setRoverLocation] = useState<GpsLocation | null>(null);
  const [capturedPoints, setCapturedPoints] = useState<CapturedPoint[]>([]);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [mqttStatus, setMqttStatus] = useState<MqttConnectionStatus>('connecting');
  const [searchedPlace, setSearchedPlace] = useState<GeocodedPlace | null>(null);
  const [centerOnUserTrigger, setCenterOnUserTrigger] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const clientRef = useRef<MqttClient | null>(null);
  const deviceWatchIdRef = useRef<number | null>(null);
  const emulatorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mqttTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Hardware RTK GPS Stream (with Automatic Fallback to Device GPS if Offline)
  useEffect(() => {
    if (settings.locationSource !== 'mqtt') return;

    const clientId = `${DEFAULT_MQTT_CONFIG.clientIdPrefix}dash_${Math.random().toString(16).substring(2, 8)}`;
    setMqttStatus('connecting');

    const client = mqtt.connect(settings.mqttBrokerUrl, {
      clientId,
      clean: true,
      connectTimeout: 6000,
      reconnectPeriod: 3000,
    });

    clientRef.current = client;

    client.on('connect', () => {
      setMqttStatus('connected');
      client.subscribe(settings.mqttTopic, { qos: 0 });
    });

    client.on('message', (receivedTopic, message) => {
      if (receivedTopic === settings.mqttTopic) {
        const payload = parseTelemetryPayload(message.toString());
        if (payload) {
          setRoverLocation({
            lat: payload.lat,
            lng: payload.lng,
            accuracy: payload.accuracy,
            altitude: payload.altitude,
            heading: payload.heading,
            speed: payload.speed,
            timestamp: payload.timestamp,
          });
        }
      }
    });

    // Smart Fallback: If hardware MQTT times out, fall back to Device GPS
    mqttTimeoutRef.current = setTimeout(() => {
      if (!client.connected && settings.locationSource === 'mqtt') {
        console.warn('Hardware RTK not connected. Falling back to On-Device Mobile GPS...');
        setSettings((prev) => ({ ...prev, locationSource: 'device' }));
      }
    }, 6000);

    client.on('reconnect', () => setMqttStatus('reconnecting'));
    client.on('error', () => setMqttStatus('error'));
    client.on('close', () => setMqttStatus('disconnected'));

    return () => {
      if (mqttTimeoutRef.current) clearTimeout(mqttTimeoutRef.current);
      if (client.connected) client.end(true);
    };
  }, [settings.locationSource, settings.mqttBrokerUrl, settings.mqttTopic]);

  const lastCaptureTimeRef = useRef<number>(0);

  // 2. Direct Mobile Device GPS Tracking Mode (With Live MQTT Broadcast to Officer Laptop)
  useEffect(() => {
    if (settings.locationSource === 'device') {
      if (!('geolocation' in navigator)) {
        console.warn('Geolocation not supported by browser.');
        return;
      }

      setMqttStatus('connecting');

      // Connect MQTT for broadcasting live phone GPS to officer's laptop
      const clientId = `${DEFAULT_MQTT_CONFIG.clientIdPrefix}phone_${Math.random().toString(16).substring(2, 8)}`;
      const client = mqtt.connect(settings.mqttBrokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 6000,
        reconnectPeriod: 3000,
      });

      clientRef.current = client;

      client.on('connect', () => {
        setMqttStatus('connected');
      });

      const successHandler = (pos: GeolocationPosition) => {
        // Anti-Jumping Guard: Discard extremely noisy GPS fixes (> 25m accuracy spike)
        if (pos.coords.accuracy > 25) {
          console.warn(`Noisy GPS fix discarded (±${pos.coords.accuracy.toFixed(1)}m > 25m threshold)`);
          return;
        }

        const locationData: GpsLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };

        setRoverLocation(locationData);

        // Broadcast to MQTT so Officer on Laptop sees field movement live!
        if (client.connected) {
          client.publish(
            settings.mqttTopic,
            JSON.stringify({
              lat: Number(locationData.lat.toFixed(7)),
              lng: Number(locationData.lng.toFixed(7)),
              accuracy: Number((locationData.accuracy || 0.05).toFixed(2)),
              altitude: locationData.altitude || 120.0,
              heading: locationData.heading || 0,
              speed: locationData.speed || 0,
              timestamp: locationData.timestamp,
              deviceId: 'MOBILE-FIELD-PHONE',
            }),
            { qos: 0 }
          );
        }
      };

      const errorHandler = (err: GeolocationPositionError) => {
        console.warn('Device GPS error:', err.message);
        setMqttStatus('error');
      };

      const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      deviceWatchIdRef.current = watchId;

      return () => {
        if (deviceWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(deviceWatchIdRef.current);
        }
        if (client.connected) client.end(true);
      };
    }
  }, [settings.locationSource, settings.mqttBrokerUrl, settings.mqttTopic]);

  // 3. Virtual Device Emulator Mode (Starts at User's Real Location - No Forced Circle Loop)
  useEffect(() => {
    if (settings.locationSource === 'emulator') {
      setMqttStatus('connected');

      // Fetch user's real physical coordinates
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setRoverLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: 0.03,
              altitude: pos.coords.altitude || 120.0,
              heading: 0,
              speed: 0,
              timestamp: Date.now(),
            });
          },
          (err) => {
            console.warn('Emulator real location fallback:', err.message);
            const baseLat = searchedPlace ? searchedPlace.lat : 27.7172;
            const baseLng = searchedPlace ? searchedPlace.lng : 85.3240;
            setRoverLocation({
              lat: baseLat,
              lng: baseLng,
              accuracy: 0.03,
              altitude: 120.0,
              heading: 0,
              speed: 0,
              timestamp: Date.now(),
            });
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        const baseLat = searchedPlace ? searchedPlace.lat : 27.7172;
        const baseLng = searchedPlace ? searchedPlace.lng : 85.3240;
        setRoverLocation({
          lat: baseLat,
          lng: baseLng,
          accuracy: 0.03,
          altitude: 120.0,
          heading: 0,
          speed: 0,
          timestamp: Date.now(),
        });
      }
    }
  }, [settings.locationSource, searchedPlace]);

  // Capture boundary point
  const handleCapturePoint = useCallback(() => {
    if (!roverLocation) return;

    setCapturedPoints((prev) => {
      const newPoint: CapturedPoint = {
        id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        pointNumber: prev.length + 1,
        lat: roverLocation.lat,
        lng: roverLocation.lng,
        accuracy: roverLocation.accuracy,
        timestamp: roverLocation.timestamp,
        elevation: roverLocation.altitude,
      };
      return [...prev, newPoint];
    });
  }, [roverLocation]);

  // Auto Point Capture System (With Anti-Jumping & Teleport Filters)
  useEffect(() => {
    if (!settings.autoCaptureEnabled || !roverLocation) return;

    // Filter 1: Discard noisy GPS position fixes (> 15m inaccuracy)
    if (roverLocation.accuracy && roverLocation.accuracy > 15) {
      console.warn(`Auto-Capture ignored noisy GPS point (accuracy ±${roverLocation.accuracy.toFixed(1)}m > 15m)`);
      return;
    }

    const now = Date.now();
    // Filter 2: Enforce minimum 1.5-second cooldown gap between captures
    if (now - lastCaptureTimeRef.current < 1500) {
      return;
    }

    if (capturedPoints.length === 0) {
      handleCapturePoint();
      lastCaptureTimeRef.current = now;
      return;
    }

    const lastPoint = capturedPoints[capturedPoints.length - 1];
    const dist = calculateDistanceMeters(
      { lat: lastPoint.lat, lng: lastPoint.lng },
      { lat: roverLocation.lat, lng: roverLocation.lng }
    );

    // Filter 3: Discard single-frame teleport spikes (> 50 meters jump)
    if (dist > 50) {
      console.warn(`Auto-Capture ignored GPS teleport spike (${dist.toFixed(1)}m jump)`);
      return;
    }

    if (dist >= settings.autoCaptureDistance) {
      handleCapturePoint();
      lastCaptureTimeRef.current = now;
    }
  }, [roverLocation, capturedPoints, settings.autoCaptureEnabled, settings.autoCaptureDistance, handleCapturePoint]);

  const handleResetSurvey = useCallback(() => {
    setCapturedPoints([]);
  }, []);

  const handleDeletePoint = useCallback((id: string) => {
    setCapturedPoints((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return filtered.map((p, idx) => ({ ...p, pointNumber: idx + 1 }));
    });
  }, []);

  const handleUndoLastPoint = useCallback(() => {
    setCapturedPoints((prev) => prev.slice(0, -1));
  }, []);

  // Update Point Location (For Manual Edit / Drag-and-Drop)
  const handleUpdatePointLocation = useCallback((id: string, lat: number, lng: number) => {
    setCapturedPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, lat, lng } : p))
    );
  }, []);

  // Cycle map style (OSM -> Street -> Topo -> Satellite)
  const handleCycleMapStyle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      mapStyle:
        prev.mapStyle === 'osm'
          ? 'street'
          : prev.mapStyle === 'street'
          ? 'topo'
          : prev.mapStyle === 'topo'
          ? 'satellite'
          : 'osm',
    }));
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Floating Header & Search Bar */}
      <header className="absolute top-4 left-4 z-[450] flex flex-wrap items-center gap-3 pointer-events-auto max-w-[calc(100vw-2rem)]">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-md">
          <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-200 font-bold text-xs">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs font-bold text-white tracking-wide">
            GeoVerify <span className="text-[10px] text-slate-400 font-mono">WebGIS</span>
          </div>
        </div>

        <PlaceSearchBar
          onSelectPlace={(place) => {
            setSearchedPlace(place);
            setAutoFollow(false);
          }}
        />
      </header>

      {/* Full-Screen Map */}
      <div className="w-full h-full">
        <DynamicMap
          roverLocation={roverLocation}
          capturedPoints={capturedPoints}
          autoFollow={autoFollow}
          onToggleAutoFollow={() => setAutoFollow(!autoFollow)}
          searchedPlace={searchedPlace}
          mapStyle={settings.mapStyle}
          centerOnUserTrigger={centerOnUserTrigger}
          onUpdatePointLocation={handleUpdatePointLocation}
        />
      </div>

      {/* Control Panel */}
      <ControlPanel
        roverLocation={roverLocation}
        capturedPoints={capturedPoints}
        onCapturePoint={handleCapturePoint}
        onResetSurvey={handleResetSurvey}
        onDeletePoint={handleDeletePoint}
        onUndoLastPoint={handleUndoLastPoint}
        onUpdatePointLocation={handleUpdatePointLocation}
        mqttStatus={mqttStatus}
        topic={settings.mqttTopic}
        brokerUrl={settings.mqttBrokerUrl}
        locationSource={settings.locationSource}
        onOpenSettings={() => setIsSettingsOpen(true)}
        autoCaptureEnabled={settings.autoCaptureEnabled}
        autoCaptureDistance={settings.autoCaptureDistance}
      />

      {/* Mobile-First Navigation Bar */}
      <MobileNavBar
        onCenterLocation={() => setCenterOnUserTrigger((prev) => prev + 1)}
        onCapturePoint={handleCapturePoint}
        onTogglePanel={() => setIsPanelOpen(!isPanelOpen)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        autoCaptureEnabled={settings.autoCaptureEnabled}
        onToggleAutoCapture={() =>
          setSettings((prev) => ({ ...prev, autoCaptureEnabled: !prev.autoCaptureEnabled }))
        }
        capturedCount={capturedPoints.length}
        isRoverActive={Boolean(roverLocation)}
        mapStyle={settings.mapStyle}
        onCycleMapStyle={handleCycleMapStyle}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSet) => setSettings(newSet)}
      />
    </main>
  );
}
