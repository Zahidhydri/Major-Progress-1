'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import DynamicMap from '@/components/map/DynamicMap';
import ControlPanel from '@/components/dashboard/ControlPanel';
import PlaceSearchBar from '@/components/search/PlaceSearchBar';
import SettingsModal from '@/components/modals/SettingsModal';
import ProjectsModal from '@/components/modals/ProjectsModal';
import AuthModal from '@/components/modals/AuthModal';
import {
  CapturedPoint,
  GpsLocation,
  MqttConnectionStatus,
  AppSettings,
  GeocodedPlace,
  SurveyProject,
  UserProfile,
} from '@/types/survey';
import { DEFAULT_MQTT_CONFIG, parseTelemetryPayload } from '@/lib/mqtt';
import { saveSurveyProject } from '@/lib/db';
import { calculateSurveyMetrics } from '@/lib/geo';
import { Compass, Settings, FolderOpen, User, Smartphone, Radio, Gamepad2 } from 'lucide-react';

export default function DashboardPage() {
  // App Settings
  const [settings, setSettings] = useState<AppSettings>({
    locationSource: 'mqtt',
    mqttBrokerUrl: process.env.NEXT_PUBLIC_MQTT_BROKER || DEFAULT_MQTT_CONFIG.brokerUrl,
    mqttTopic: process.env.NEXT_PUBLIC_MQTT_TOPIC || DEFAULT_MQTT_CONFIG.topic,
    geocodingProvider: 'nominatim',
    geocodingApiKey: process.env.NEXT_PUBLIC_GEOCODING_API_KEY || '',
    firebaseEnabled: false,
    mapStyle: 'osm',
  });

  // User Profile Auth State
  const [user, setUser] = useState<UserProfile>({
    id: 'usr_lead_01',
    name: 'Lead Surveyor',
    email: 'surveyor@geoverify.io',
    role: 'lead_surveyor',
    organization: 'GeoVerify GIS Systems',
    isAuthenticated: true,
  });

  // Location & Telemetry State
  const [roverLocation, setRoverLocation] = useState<GpsLocation | null>(null);
  const [capturedPoints, setCapturedPoints] = useState<CapturedPoint[]>([]);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [mqttStatus, setMqttStatus] = useState<MqttConnectionStatus>('connecting');
  const [searchedPlace, setSearchedPlace] = useState<GeocodedPlace | null>(null);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const clientRef = useRef<MqttClient | null>(null);
  const deviceWatchIdRef = useRef<number | null>(null);
  const emulatorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. MQTT Connection Stream (for RTK Rover Mode)
  useEffect(() => {
    if (settings.locationSource !== 'mqtt') return;

    const clientId = `${DEFAULT_MQTT_CONFIG.clientIdPrefix}dash_${Math.random().toString(16).substring(2, 8)}`;
    setMqttStatus('connecting');

    const client = mqtt.connect(settings.mqttBrokerUrl, {
      clientId,
      clean: true,
      connectTimeout: 8000,
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

    client.on('reconnect', () => setMqttStatus('reconnecting'));
    client.on('error', () => setMqttStatus('error'));
    client.on('close', () => setMqttStatus('disconnected'));

    return () => {
      if (client.connected) client.end(true);
    };
  }, [settings.locationSource, settings.mqttBrokerUrl, settings.mqttTopic]);

  // 2. Direct Mobile Device GPS Tracking Mode
  useEffect(() => {
    if (settings.locationSource === 'device') {
      if (!('geolocation' in navigator)) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      setMqttStatus('connected');

      const successHandler = (pos: GeolocationPosition) => {
        setRoverLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
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
      };
    }
  }, [settings.locationSource]);

  // 3. Virtual Device Emulator Mode (Local Simulated Walk)
  useEffect(() => {
    if (settings.locationSource === 'emulator') {
      setMqttStatus('connected');
      let baseLat = searchedPlace ? searchedPlace.lat : 27.7172;
      let baseLng = searchedPlace ? searchedPlace.lng : 85.3240;
      let angle = 0;

      // Initialize default position
      setRoverLocation({
        lat: baseLat,
        lng: baseLng,
        accuracy: 0.03, // RTK High Precision simulation
        altitude: 1350.5,
        heading: 45,
        speed: 1.2,
        timestamp: Date.now(),
      });

      // Walk in simulated boundary orbit
      emulatorIntervalRef.current = setInterval(() => {
        angle += 0.15;
        const radius = 0.0003;
        const noisyLat = baseLat + Math.sin(angle) * radius + (Math.random() - 0.5) * 0.00002;
        const noisyLng = baseLng + Math.cos(angle) * radius + (Math.random() - 0.5) * 0.00002;

        setRoverLocation({
          lat: noisyLat,
          lng: noisyLng,
          accuracy: 0.02 + Math.random() * 0.02,
          altitude: 1350 + Math.sin(angle) * 2,
          heading: Math.floor((angle * 180 / Math.PI) % 360),
          speed: 1.1,
          timestamp: Date.now(),
        });
      }, 1500);

      return () => {
        if (emulatorIntervalRef.current) clearInterval(emulatorIntervalRef.current);
      };
    }
  }, [settings.locationSource, searchedPlace]);

  // Capture boundary point
  const handleCapturePoint = useCallback(() => {
    if (!roverLocation) return;

    const newPoint: CapturedPoint = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      pointNumber: capturedPoints.length + 1,
      lat: roverLocation.lat,
      lng: roverLocation.lng,
      accuracy: roverLocation.accuracy,
      timestamp: roverLocation.timestamp,
      elevation: roverLocation.altitude,
    };

    setCapturedPoints((prev) => [...prev, newPoint]);
  }, [roverLocation, capturedPoints.length]);

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

  // Save current active points to Database
  const handleSaveCurrentAsProject = async (title: string, clientName?: string) => {
    if (capturedPoints.length === 0) return;

    const metrics = calculateSurveyMetrics(capturedPoints);
    const newProject: SurveyProject = {
      id: `proj_${Date.now()}`,
      title,
      clientName,
      locationName: searchedPlace?.shortName || 'Field Survey Parcel',
      points: capturedPoints,
      metrics,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      surveyorName: user.name,
      surveyorEmail: user.email,
    };

    await saveSurveyProject(newProject);
  };

  // Load project from Database onto map
  const handleLoadProject = (project: SurveyProject) => {
    setCapturedPoints(project.points);
    if (project.points.length > 0) {
      const first = project.points[0];
      setRoverLocation({
        lat: first.lat,
        lng: first.lng,
        accuracy: first.accuracy,
        timestamp: first.timestamp,
      });
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Floating Header & Place Search Bar */}
      <header className="absolute top-4 left-4 z-[450] flex flex-wrap items-center gap-3 pointer-events-auto max-w-[calc(100vw-2rem)]">
        {/* App Title Badge */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3.5 py-2 rounded-2xl flex items-center space-x-2.5 shadow-2xl">
          <div className="w-7 h-7 rounded-xl bg-cyan-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wider text-white flex items-center gap-1.5">
              <span>GeoVerify</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">WebGIS</span>
            </div>
            <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
              <span>IoT RTK Survey</span>
            </div>
          </div>
        </div>

        {/* Integrated Place Name Search Bar */}
        <PlaceSearchBar
          onSelectPlace={(place) => {
            setSearchedPlace(place);
            setAutoFollow(false);
          }}
          apiKey={settings.geocodingApiKey}
          provider={settings.geocodingProvider}
        />
      </header>

      {/* Full-Screen Leaflet Dynamic Map Component */}
      <div className="w-full h-full">
        <DynamicMap
          roverLocation={roverLocation}
          capturedPoints={capturedPoints}
          autoFollow={autoFollow}
          onToggleAutoFollow={() => setAutoFollow(!autoFollow)}
          searchedPlace={searchedPlace}
          mapStyle={settings.mapStyle}
        />
      </div>

      {/* Control Panel Sheet (Top-Right HUD on Desktop, Bottom Drawer on Mobile) */}
      <ControlPanel
        roverLocation={roverLocation}
        capturedPoints={capturedPoints}
        onCapturePoint={handleCapturePoint}
        onResetSurvey={handleResetSurvey}
        onDeletePoint={handleDeletePoint}
        onUndoLastPoint={handleUndoLastPoint}
        mqttStatus={mqttStatus}
        topic={settings.mqttTopic}
        brokerUrl={settings.mqttBrokerUrl}
        locationSource={settings.locationSource}
        user={user}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProjects={() => setIsProjectsOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSet) => setSettings(newSet)}
      />

      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        onLoadProject={handleLoadProject}
        onSaveCurrentAsProject={handleSaveCurrentAsProject}
        hasActivePoints={capturedPoints.length > 0}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onUpdateUser={(u) => setUser(u)}
      />
    </main>
  );
}
