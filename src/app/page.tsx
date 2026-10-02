'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import DynamicMap from '@/components/map/DynamicMap';
import ControlPanel from '@/components/dashboard/ControlPanel';
import PlaceSearchBar from '@/components/search/PlaceSearchBar';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import SettingsModal from '@/components/modals/SettingsModal';
import ProjectsModal from '@/components/modals/ProjectsModal';
import AuthModal from '@/components/modals/AuthModal';
import {
  CapturedPoint,
  GpsLocation,
  MqttConnectionStatus,
  AppSettings,
  GeocodedPlace,
  PolygonDisplayMode,
  SurveyProject,
  UserProfile,
} from '@/types/survey';
import { DEFAULT_MQTT_CONFIG, parseTelemetryPayload } from '@/lib/mqtt';
import { calculateDistanceMeters, calculateSurveyMetrics, autoUncrossPoints } from '@/lib/geo';
import { saveSurveyProject } from '@/lib/db';
import { Compass, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Gamepad2, ExternalLink, Database, ChevronDown, User, Check, Save, Zap } from 'lucide-react';

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

  // User Auth Profile State
  const [user, setUser] = useState<UserProfile>({
    id: '',
    name: 'Guest Surveyor',
    email: '',
    role: 'lead_surveyor',
    organization: '',
    isAuthenticated: false,
  });

  // Location & Telemetry State
  const [roverLocation, setRoverLocation] = useState<GpsLocation | null>(null);
  const [capturedPoints, setCapturedPoints] = useState<CapturedPoint[]>([]);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [mqttStatus, setMqttStatus] = useState<MqttConnectionStatus>('connecting');
  const [searchedPlace, setSearchedPlace] = useState<GeocodedPlace | null>(null);
  const [centerOnUserTrigger, setCenterOnUserTrigger] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Polygon Geometry & Active Loaded Project State
  const [polygonDisplayMode, setPolygonDisplayMode] = useState<PolygonDisplayMode>('captured');
  const [isJoystickMinimized, setIsJoystickMinimized] = useState(false);
  const [activeProject, setActiveProject] = useState<SurveyProject | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const clientRef = useRef<MqttClient | null>(null);
  const deviceWatchIdRef = useRef<number | null>(null);

  // Load persistent Google user profile on initial mount
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('geoverify_user_profile_v1');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed && parsed.isAuthenticated) {
          setUser(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to load user session:', err);
    }
  }, []);

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

    client.on('reconnect', () => setMqttStatus('reconnecting'));
    client.on('error', () => setMqttStatus('error'));
    client.on('close', () => setMqttStatus('disconnected'));

    return () => {
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

  // Step movement helper for Virtual Emulator Mode
  const moveEmulatorStep = useCallback(
    (dLat: number, dLng: number, heading: number) => {
      setRoverLocation((prev) => {
        const baseLat = prev ? prev.lat : (searchedPlace ? searchedPlace.lat : 21.1458);
        const baseLng = prev ? prev.lng : (searchedPlace ? searchedPlace.lng : 79.0882);
        const newLat = baseLat + dLat;
        const newLng = baseLng + dLng;

        const updatedLocation: GpsLocation = {
          lat: Number(newLat.toFixed(7)),
          lng: Number(newLng.toFixed(7)),
          accuracy: 0.03,
          altitude: 120.0,
          heading,
          speed: 1.4,
          timestamp: Date.now(),
        };

        if (clientRef.current && clientRef.current.connected) {
          clientRef.current.publish(
            settings.mqttTopic,
            JSON.stringify({
              lat: updatedLocation.lat,
              lng: updatedLocation.lng,
              accuracy: 0.03,
              altitude: 120.0,
              heading,
              speed: 1.4,
              timestamp: updatedLocation.timestamp,
              deviceId: 'DASHBOARD-EMULATOR',
            }),
            { qos: 0 }
          );
        }

        return updatedLocation;
      });
    },
    [searchedPlace, settings.mqttTopic]
  );

  // Keyboard navigation when Emulator mode is active
  useEffect(() => {
    if (settings.locationSource !== 'emulator') return;

    const step = 0.00003;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          moveEmulatorStep(step, 0, 0);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          moveEmulatorStep(-step, 0, 180);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveEmulatorStep(0, -step * 1.3, 270);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveEmulatorStep(0, step * 1.3, 90);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.locationSource, moveEmulatorStep]);

  // 3. Virtual Device Emulator Mode
  useEffect(() => {
    if (settings.locationSource === 'emulator') {
      setMqttStatus('connected');

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
            const baseLat = searchedPlace ? searchedPlace.lat : 21.1458;
            const baseLng = searchedPlace ? searchedPlace.lng : 79.0882;
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
        const baseLat = searchedPlace ? searchedPlace.lat : 21.1458;
        const baseLng = searchedPlace ? searchedPlace.lng : 79.0882;
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
  const handleCapturePoint = useCallback((locationOverride?: GpsLocation) => {
    const targetLoc = locationOverride || roverLocation;
    if (!targetLoc) return;

    setCapturedPoints((prev) => {
      const newPoint: CapturedPoint = {
        id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        pointNumber: prev.length + 1,
        lat: targetLoc.lat,
        lng: targetLoc.lng,
        accuracy: targetLoc.accuracy,
        timestamp: targetLoc.timestamp || Date.now(),
        elevation: targetLoc.altitude,
      };
      return [...prev, newPoint];
    });
  }, [roverLocation]);

  // Auto Point Capture System
  useEffect(() => {
    if (!settings.autoCaptureEnabled || !roverLocation) return;

    if (roverLocation.accuracy && roverLocation.accuracy > 25) {
      return;
    }

    const now = Date.now();
    if (now - lastCaptureTimeRef.current < 200) {
      return;
    }

    if (capturedPoints.length === 0) {
      handleCapturePoint(roverLocation);
      lastCaptureTimeRef.current = now;
      return;
    }

    const lastPoint = capturedPoints[capturedPoints.length - 1];
    const dist = calculateDistanceMeters(
      { lat: lastPoint.lat, lng: lastPoint.lng },
      { lat: roverLocation.lat, lng: roverLocation.lng }
    );

    const threshold = settings.autoCaptureDistance || 2;
    if (dist >= threshold) {
      handleCapturePoint(roverLocation);
      lastCaptureTimeRef.current = now;
    }
  }, [roverLocation, capturedPoints, settings.autoCaptureEnabled, settings.autoCaptureDistance, handleCapturePoint]);

  const handleResetSurvey = useCallback(() => {
    setCapturedPoints([]);
    setActiveProject(null);
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

  const handleUpdatePointLocation = useCallback((id: string, lat: number, lng: number) => {
    setCapturedPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, lat, lng } : p))
    );
  }, []);

  const handleToggleExcludePoint = useCallback((id: string) => {
    setCapturedPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isExcluded: !p.isExcluded } : p))
    );
  }, []);

  const handleAutoUncrossPoints = useCallback(() => {
    setCapturedPoints((prev) => autoUncrossPoints(prev));
  }, []);

  // Save survey project (New or Update Existing)
  const handleSaveCurrentAsProject = useCallback(async (title: string, clientName?: string) => {
    const metrics = calculateSurveyMetrics(capturedPoints, polygonDisplayMode);
    const projectId = activeProject ? activeProject.id : `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const project: SurveyProject = {
      id: projectId,
      title,
      clientName: clientName || (activeProject ? activeProject.clientName : undefined),
      points: capturedPoints,
      metrics,
      createdAt: activeProject ? activeProject.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    await saveSurveyProject(project);
    setActiveProject(project);
    setSaveToast(`Saved changes to "${title}"`);
    setTimeout(() => setSaveToast(null), 3500);
  }, [capturedPoints, polygonDisplayMode, activeProject]);

  // Quick save modifications back to currently active project
  const handleQuickSaveActiveProject = useCallback(async () => {
    if (!activeProject) return;
    await handleSaveCurrentAsProject(activeProject.title, activeProject.clientName);
  }, [activeProject, handleSaveCurrentAsProject]);

  // Load project from database
  const handleLoadProject = useCallback((project: SurveyProject) => {
    setCapturedPoints(project.points);
    setActiveProject(project);
    if (project.points.length > 0) {
      setSearchedPlace({
        placeId: project.id,
        displayName: project.title,
        shortName: project.title,
        lat: project.points[0].lat,
        lng: project.points[0].lng,
      });
      setAutoFollow(false);
    }
  }, []);

  const handleUploadMapFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let loadedPoints: CapturedPoint[] = [];
        let loadedTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

        if (parsed.points && Array.isArray(parsed.points)) {
          loadedPoints = parsed.points;
          if (parsed.title) loadedTitle = parsed.title;
        } else if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          let ptIdx = 1;
          parsed.features.forEach((feat: any) => {
            if (feat.geometry && feat.geometry.type === 'Point') {
              const [lng, lat, elev] = feat.geometry.coordinates;
              loadedPoints.push({
                id: `pt_json_${Date.now()}_${ptIdx}`,
                pointNumber: ptIdx++,
                lat,
                lng,
                elevation: elev || 120,
                timestamp: Date.now(),
              });
            } else if (feat.geometry && (feat.geometry.type === 'Polygon' || feat.geometry.type === 'LineString')) {
              const ring = feat.geometry.type === 'Polygon' ? feat.geometry.coordinates[0] : feat.geometry.coordinates;
              ring.slice(0, -1).forEach((coord: number[]) => {
                const [lng, lat, elev] = coord;
                loadedPoints.push({
                  id: `pt_json_${Date.now()}_${ptIdx}`,
                  pointNumber: ptIdx++,
                  lat,
                  lng,
                  elevation: elev || 120,
                  timestamp: Date.now(),
                });
              });
            }
          });
        }

        if (loadedPoints.length > 0) {
          const metrics = calculateSurveyMetrics(loadedPoints, 'captured');
          const project: SurveyProject = {
            id: `proj_upload_${Date.now()}`,
            title: loadedTitle,
            points: loadedPoints,
            metrics,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await saveSurveyProject(project);
          handleLoadProject(project);
          setSaveToast(`Uploaded & loaded "${loadedTitle}"`);
          setTimeout(() => setSaveToast(null), 3500);
        } else {
          setSaveToast('⚠️ Error: No valid boundary points found in file.');
          setTimeout(() => setSaveToast(null), 4000);
        }
      } catch (err) {
        console.error('File parsing error:', err);
        setSaveToast('⚠️ Error: Invalid GeoJSON or JSON survey file.');
        setTimeout(() => setSaveToast(null), 4000);
      }
    };
    reader.readAsText(file);
  }, [handleLoadProject]);

  // Cycle map style
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

  // Capture point by clicking directly on the map screen
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setCapturedPoints((prev) => {
      const newPoint: CapturedPoint = {
        id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        pointNumber: prev.length + 1,
        lat: Number(lat.toFixed(7)),
        lng: Number(lng.toFixed(7)),
        accuracy: 0.05,
        timestamp: Date.now(),
        elevation: 120.0,
      };
      return [...prev, newPoint];
    });
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Floating Header & Search Bar */}
      <header className="absolute top-4 left-4 right-4 md:right-[26rem] z-[450] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-3 pointer-events-none font-sans">
        <div className="flex items-center space-x-2 pointer-events-auto shrink-0">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-md">
            <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-200 font-bold text-xs">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xs font-bold text-white tracking-wide">
              GeoVerify <span className="text-[10px] text-slate-400 font-mono">WebGIS</span>
            </div>
          </div>

          {/* Compact Google Login / Account Status Button */}
          {user.isAuthenticated ? (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700 px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 text-white font-bold text-xs shadow-md transition pointer-events-auto"
              title={`Logged in as ${user.email}`}
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline font-mono text-[11px]">{user.name.split(' ')[0]}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white backdrop-blur-md border border-blue-500/50 px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 font-bold text-xs shadow-md transition pointer-events-auto"
              title="Sign in with Google"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              </svg>
              <span className="hidden sm:inline">Google Login</span>
            </button>
          )}
        </div>

        <div className="pointer-events-auto flex-1 max-w-sm flex justify-end">
          <PlaceSearchBar
            onSelectPlace={(place) => {
              setSearchedPlace(place);
              setAutoFollow(false);
            }}
          />
        </div>
      </header>

      {/* Active Loaded Project Banner */}
      {activeProject && (
        <div className="absolute top-28 left-4 md:top-16 md:left-4 z-[440] pointer-events-auto font-sans animate-in fade-in slide-in-from-top-2">
          <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/50 px-3 py-1.5 rounded-xl flex items-center space-x-3 text-white text-xs shadow-xl">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                Editing Survey:
              </span>
              <span className="font-bold text-white truncate max-w-[140px] md:max-w-[200px]">
                {activeProject.title}
              </span>
            </div>

            <button
              onClick={handleQuickSaveActiveProject}
              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1 transition shadow"
              title="Save updated points to database"
            >
              <Save className="w-3 h-3" />
              <span>Save Changes</span>
            </button>

            <button
              onClick={() => setActiveProject(null)}
              className="text-slate-400 hover:text-white text-[10px] font-mono underline"
            >
              Unlink
            </button>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {saveToast && (
        <div className="absolute top-16 right-4 z-[460] bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-xs px-3 py-2 rounded-xl shadow-2xl flex items-center gap-2 font-mono animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Full-Screen Map */}
      <div className="w-full h-full">
        <DynamicMap
          roverLocation={roverLocation}
          capturedPoints={capturedPoints}
          autoFollow={autoFollow}
          onToggleAutoFollow={() => setAutoFollow(!autoFollow)}
          searchedPlace={searchedPlace}
          mapStyle={settings.mapStyle}
          polygonDisplayMode={polygonDisplayMode}
          centerOnUserTrigger={centerOnUserTrigger}
          onUpdatePointLocation={handleUpdatePointLocation}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Floating On-Screen D-Pad Controller */}
      {settings.locationSource === 'emulator' && (
        <div className="absolute bottom-20 left-4 md:bottom-20 md:left-6 z-[450] pointer-events-auto font-sans select-none">
          {isJoystickMinimized ? (
            <button
              onClick={() => setIsJoystickMinimized(false)}
              className="bg-slate-900/95 hover:bg-slate-800 backdrop-blur-md border border-cyan-500/50 px-3 py-2 rounded-2xl shadow-2xl flex items-center space-x-2 text-cyan-300 font-bold text-xs transition active:scale-95 animate-in fade-in"
            >
              <Gamepad2 className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Joystick (WASD)</span>
            </button>
          ) : (
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-2xl shadow-2xl flex flex-col items-center space-y-2 max-w-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between w-full border-b border-slate-800 pb-1.5 gap-2">
                <span className="text-[10px] font-bold text-cyan-400 font-mono flex items-center gap-1">
                  <Gamepad2 className="w-3.5 h-3.5" /> EMULATOR JOYSTICK
                </span>
                <div className="flex items-center space-x-1">
                  <a
                    href="/emulator"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-slate-400 hover:text-white flex items-center gap-0.5 hover:underline mr-1"
                  >
                    <span>Studio</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <button
                    onClick={() => setIsJoystickMinimized(true)}
                    className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Minimize Joystick"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-1 my-1">
                <button
                  onClick={() => moveEmulatorStep(0.00003, 0, 0)}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 text-slate-200 hover:text-white flex items-center justify-center shadow transition active:scale-95 border border-slate-700"
                  title="Move North (Up / W)"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => moveEmulatorStep(0, -0.00003 * 1.3, 270)}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 text-slate-200 hover:text-white flex items-center justify-center shadow transition active:scale-95 border border-slate-700"
                    title="Move West (Left / A)"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-400/50 animate-pulse" />
                  <button
                    onClick={() => moveEmulatorStep(0, 0.00003 * 1.3, 90)}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 text-slate-200 hover:text-white flex items-center justify-center shadow transition active:scale-95 border border-slate-700"
                    title="Move East (Right / D)"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => moveEmulatorStep(-0.00003, 0, 180)}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 text-slate-200 hover:text-white flex items-center justify-center shadow transition active:scale-95 border border-slate-700"
                  title="Move South (Down / S)"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              <span className="text-[9px] text-slate-400 font-mono text-center">
                Use WASD or Arrow Keys
              </span>
            </div>
          )}
        </div>
      )}

      {/* Control Panel */}
      <ControlPanel
        roverLocation={roverLocation}
        capturedPoints={capturedPoints}
        onCapturePoint={handleCapturePoint}
        onResetSurvey={handleResetSurvey}
        onDeletePoint={handleDeletePoint}
        onUndoLastPoint={handleUndoLastPoint}
        onUpdatePointLocation={handleUpdatePointLocation}
        onToggleExcludePoint={handleToggleExcludePoint}
        mqttStatus={mqttStatus}
        topic={settings.mqttTopic}
        brokerUrl={settings.mqttBrokerUrl}
        locationSource={settings.locationSource}
        onOpenSettings={() => setIsSettingsOpen(true)}
        autoCaptureEnabled={settings.autoCaptureEnabled}
        autoCaptureDistance={settings.autoCaptureDistance}
        polygonDisplayMode={polygonDisplayMode}
        onChangePolygonDisplayMode={setPolygonDisplayMode}
        onAutoUncrossPoints={handleAutoUncrossPoints}
        onOpenProjectsModal={() => setIsProjectsOpen(true)}
        onToggleAutoCapture={() =>
          setSettings((prev) => ({ ...prev, autoCaptureEnabled: !prev.autoCaptureEnabled }))
        }
        onUploadMapFile={handleUploadMapFile}
      />

      {/* Mobile-First Navigation Bar */}
      <MobileNavBar
        onCenterLocation={() => setCenterOnUserTrigger((prev) => prev + 1)}
        onCapturePoint={handleCapturePoint}
        onTogglePanel={() => setIsPanelOpen(!isPanelOpen)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProjectsModal={() => setIsProjectsOpen(true)}
        autoCaptureEnabled={settings.autoCaptureEnabled}
        onToggleAutoCapture={() =>
          setSettings((prev) => ({ ...prev, autoCaptureEnabled: !prev.autoCaptureEnabled }))
        }
        capturedCount={capturedPoints.length}
        isRoverActive={Boolean(roverLocation)}
        mapStyle={settings.mapStyle}
        onCycleMapStyle={handleCycleMapStyle}
      />

      {/* Database Projects Modal */}
      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        onLoadProject={handleLoadProject}
        onSaveCurrentAsProject={handleSaveCurrentAsProject}
        hasActivePoints={capturedPoints.length > 0}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSet) => setSettings(newSet)}
        user={user}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onLogoutUser={() => {
          localStorage.removeItem('geoverify_user_profile_v1');
          setUser({
            id: '',
            name: 'Guest Surveyor',
            email: '',
            role: 'field_technician',
            organization: '',
            isAuthenticated: false,
          });
        }}
      />

      {/* Google Login & Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onUpdateUser={(updatedUser) => setUser(updatedUser)}
      />
    </main>
  );
}


