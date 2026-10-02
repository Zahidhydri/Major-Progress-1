'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { DEFAULT_MQTT_CONFIG } from '@/lib/mqtt';
import { formatDMS } from '@/lib/geo';
import DynamicMap from '@/components/map/DynamicMap';
import {
  Radio,
  Play,
  Square,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Footprints,
  LocateFixed,
  MapPin,
  Keyboard,
  Check,
  Activity,
  Layers,
  Sparkles,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

export default function RoverEmulatorPage() {
  const [isSurveying, setIsSurveying] = useState(true);
  const [mqttStatus, setMqttStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('connecting');
  const [currentPosition, setCurrentPosition] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    altitude?: number | null;
    heading?: number | null;
    speed?: number | null;
    timestamp: number;
  } | null>(null);

  const [packetsSent, setPacketsSent] = useState(0);
  const [lastTransmission, setLastTransmission] = useState<string>('Never');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [simulatedMode, setSimulatedMode] = useState(true);
  const [stepSize, setStepSize] = useState<number>(0.00003); // ~3 meters per step
  const [autoWalk, setAutoWalk] = useState(false);
  const [inputLat, setInputLat] = useState<string>('');
  const [inputLng, setInputLng] = useState<string>('');
  const [locationSynced, setLocationSynced] = useState(false);
  const [activeDirection, setActiveDirection] = useState<'N' | 'S' | 'E' | 'W' | null>(null);

  const clientRef = useRef<MqttClient | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const autoWalkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER || DEFAULT_MQTT_CONFIG.brokerUrl;
  const topic = process.env.NEXT_PUBLIC_MQTT_TOPIC || DEFAULT_MQTT_CONFIG.topic;

  // Initialize MQTT Client on mount
  useEffect(() => {
    const clientId = `${DEFAULT_MQTT_CONFIG.clientIdPrefix}emitter_${Math.random().toString(16).substring(2, 8)}`;
    setMqttStatus('connecting');

    const client = mqtt.connect(brokerUrl, {
      clientId,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
    });

    clientRef.current = client;

    client.on('connect', () => {
      setMqttStatus('connected');
    });

    client.on('error', (err) => {
      console.error('MQTT error:', err);
      setMqttStatus('error');
    });

    client.on('close', () => {
      setMqttStatus('disconnected');
    });

    return () => {
      if (client.connected) {
        client.end(true);
      }
    };
  }, [brokerUrl]);

  // Publish telemetry payload to MQTT topic
  const publishLocation = useCallback(
    (lat: number, lng: number, accuracy?: number, altitude?: number | null, heading?: number | null, speed?: number | null) => {
      const now = Date.now();
      const payload = {
        lat: Number(lat.toFixed(7)),
        lng: Number(lng.toFixed(7)),
        accuracy: accuracy !== undefined ? Number(accuracy.toFixed(2)) : 0.03,
        altitude: altitude !== undefined ? altitude : 120.5,
        heading: heading !== undefined ? heading : 45,
        speed: speed !== undefined ? speed : 1.2,
        timestamp: now,
        deviceId: 'GNSS-ROVER-PRO-X',
      };

      setCurrentPosition(payload);
      setInputLat(payload.lat.toString());
      setInputLng(payload.lng.toString());
      setLastTransmission(new Date(now).toLocaleTimeString());

      if (clientRef.current && clientRef.current.connected) {
        clientRef.current.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
          if (!err) {
            setPacketsSent((p) => p + 1);
          }
        });
      }
    },
    [topic]
  );

  // Auto-detect User's Real Device Location on initial load
  const syncToUserLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy || 0.05;
        const alt = pos.coords.altitude || 120.0;

        const payload = {
          lat: Number(lat.toFixed(7)),
          lng: Number(lng.toFixed(7)),
          accuracy: Number(acc.toFixed(2)),
          altitude: alt,
          heading: 0,
          speed: 0,
          timestamp: Date.now(),
        };

        setCurrentPosition(payload);
        setInputLat(payload.lat.toString());
        setInputLng(payload.lng.toString());
        setLocationSynced(true);
        setErrorMessage(null);

        if (isSurveying) {
          publishLocation(payload.lat, payload.lng, payload.accuracy, payload.altitude, 0, 0);
        }
        setTimeout(() => setLocationSynced(false), 2000);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setErrorMessage(`Device location error: ${err.message}. Enter custom coordinates below.`);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, [isSurveying, publishLocation]);

  // Sync on initial mount
  useEffect(() => {
    syncToUserLocation();
  }, [syncToUserLocation]);

  // Handle Geolocation Watch for Real Mode
  useEffect(() => {
    if (isSurveying && !simulatedMode) {
      if (!('geolocation' in navigator)) {
        setErrorMessage('Geolocation is not supported by your browser.');
        return;
      }

      setErrorMessage(null);

      const successHandler = (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
        publishLocation(latitude, longitude, accuracy, altitude, heading, speed);
      };

      const errorHandler = (error: GeolocationPositionError) => {
        setErrorMessage(`GPS: ${error.message}`);
      };

      const id = navigator.geolocation.watchPosition(successHandler, errorHandler, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      watchIdRef.current = id;
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isSurveying, simulatedMode, publishLocation]);

  // Step movement helper (North, South, East, West)
  const moveSimulated = useCallback(
    (dLat: number, dLng: number, heading: number, dir?: 'N' | 'S' | 'E' | 'W') => {
      if (!isSurveying) {
        setIsSurveying(true);
      }
      if (dir) {
        setActiveDirection(dir);
        setTimeout(() => setActiveDirection(null), 250);
      }

      setCurrentPosition((prev) => {
        const baseLat = prev ? prev.lat : 21.1458;
        const baseLng = prev ? prev.lng : 79.0882;
        const newLat = baseLat + dLat;
        const newLng = baseLng + dLng;
        const accuracy = 0.02 + Math.random() * 0.02; // ±0.02m RTK precision

        publishLocation(newLat, newLng, accuracy, 120.0, heading, 1.4);

        return {
          lat: newLat,
          lng: newLng,
          accuracy,
          altitude: 120.0,
          heading,
          speed: 1.4,
          timestamp: Date.now(),
        };
      });
    },
    [isSurveying, publishLocation]
  );

  // Keyboard Arrow Keys & WASD Navigation for Desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          moveSimulated(stepSize, 0, 0, 'N');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          moveSimulated(-stepSize, 0, 180, 'S');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveSimulated(0, -stepSize * 1.3, 270, 'W');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveSimulated(0, stepSize * 1.3, 90, 'E');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveSimulated, stepSize]);

  // Auto-walk simulator pattern
  useEffect(() => {
    if (autoWalk && isSurveying) {
      let step = 0;
      const directions = [
        { dLat: stepSize, dLng: 0, h: 0, dir: 'N' as const },
        { dLat: stepSize, dLng: 0, h: 0, dir: 'N' as const },
        { dLat: 0, dLng: stepSize * 1.3, h: 90, dir: 'E' as const },
        { dLat: 0, dLng: stepSize * 1.3, h: 90, dir: 'E' as const },
        { dLat: -stepSize, dLng: 0, h: 180, dir: 'S' as const },
        { dLat: -stepSize, dLng: 0, h: 180, dir: 'S' as const },
        { dLat: 0, dLng: -stepSize * 1.3, h: 270, dir: 'W' as const },
        { dLat: 0, dLng: -stepSize * 1.3, h: 270, dir: 'W' as const },
      ];

      autoWalkIntervalRef.current = setInterval(() => {
        const dir = directions[step % directions.length];
        moveSimulated(dir.dLat, dir.dLng, dir.h, dir.dir);
        step++;
      }, 1500);
    } else {
      if (autoWalkIntervalRef.current) {
        clearInterval(autoWalkIntervalRef.current);
        autoWalkIntervalRef.current = null;
      }
    }

    return () => {
      if (autoWalkIntervalRef.current) {
        clearInterval(autoWalkIntervalRef.current);
      }
    };
  }, [autoWalk, isSurveying, stepSize, moveSimulated]);

  const toggleSurvey = () => {
    if (!isSurveying) {
      setIsSurveying(true);
      if (currentPosition) {
        publishLocation(
          currentPosition.lat,
          currentPosition.lng,
          currentPosition.accuracy,
          currentPosition.altitude,
          currentPosition.heading,
          currentPosition.speed
        );
      }
    } else {
      setIsSurveying(false);
      setAutoWalk(false);
    }
  };

  const handleApplyCustomCoords = () => {
    const lat = parseFloat(inputLat);
    const lng = parseFloat(inputLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      const payload = {
        lat,
        lng,
        accuracy: 0.03,
        altitude: 120.0,
        heading: 0,
        speed: 0,
        timestamp: Date.now(),
      };
      setCurrentPosition(payload);
      if (isSurveying) {
        publishLocation(lat, lng, 0.03, 120.0, 0, 0);
      }
    }
  };

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Studio Header Navigation Bar */}
      <header className="w-full h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-6 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center space-x-3">
          <a
            href="/"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs border border-slate-700 transition flex items-center space-x-1.5 shadow-sm"
          >
            <span>← Back to Map</span>
          </a>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-glow-rover" />
            <h1 className="text-xs font-bold text-white tracking-wider font-mono uppercase">
              GNSS RTK Telemetry Studio <span className="text-[10px] text-slate-400 font-normal">v2.4 Desktop</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={syncToUserLocation}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white font-semibold text-xs transition border border-blue-500/50 shadow-sm"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>{locationSynced ? 'Synced!' : 'My Location'}</span>
          </button>

          {mqttStatus === 'connected' ? (
            <span className="flex items-center space-x-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/30 font-bold font-mono">
              <Wifi className="w-3.5 h-3.5" />
              <span>MQTT LIVE</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-[10px] text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30 font-bold font-mono">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="capitalize">{mqttStatus}</span>
            </span>
          )}
        </div>
      </header>

      {/* Main Desktop Studio 2-Column Layout */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Handheld Rover Telemetry Control Deck */}
        <div className="lg:col-span-5 h-full overflow-y-auto p-4 md:p-5 space-y-4 border-r border-slate-800/80 bg-slate-950/60 custom-scrollbar">
          {/* Main Giant Survey Toggle Button */}
          <button
            onClick={toggleSurvey}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wider uppercase transition-all duration-300 flex items-center justify-center space-x-3 shadow-2xl relative overflow-hidden active:scale-[0.98] ${
              isSurveying
                ? 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white shadow-rose-600/30 border border-rose-500'
                : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-extrabold shadow-emerald-500/30 border border-emerald-400'
            }`}
          >
            {isSurveying ? (
              <>
                <Square className="w-5 h-5 fill-current animate-pulse" />
                <span>PAUSE TELEMETRY STREAM</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>START TELEMETRY STREAM</span>
              </>
            )}
          </button>

          {/* Telemetry Display HUD Card */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-3 font-mono shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5" /> High Precision RTK Telemetry HUD
              </span>
              <span className="text-[9px] text-slate-400">
                {isSurveying ? '● STREAMING 1Hz' : '○ STANDBY'}
              </span>
            </div>

            {/* Coordinates Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Latitude</div>
                <div className="text-sm font-bold text-white tracking-tight mt-0.5">
                  {currentPosition ? currentPosition.lat.toFixed(7) : '0.0000000'}°
                </div>
                <div className="text-[9px] text-slate-500 truncate mt-0.5">
                  {currentPosition ? formatDMS(currentPosition.lat, true) : '--'}
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Longitude</div>
                <div className="text-sm font-bold text-white tracking-tight mt-0.5">
                  {currentPosition ? currentPosition.lng.toFixed(7) : '0.0000000'}°
                </div>
                <div className="text-[9px] text-slate-500 truncate mt-0.5">
                  {currentPosition ? formatDMS(currentPosition.lng, false) : '--'}
                </div>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                <div className="text-[8px] text-slate-400 uppercase">RTK Precision</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5">
                  {currentPosition?.accuracy ? `±${currentPosition.accuracy.toFixed(2)}m` : '±0.03m'}
                </div>
              </div>

              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                <div className="text-[8px] text-slate-400 uppercase">Elevation</div>
                <div className="text-xs font-bold text-cyan-300 mt-0.5">
                  {currentPosition?.altitude ? `${currentPosition.altitude.toFixed(1)}m` : '120.0m'}
                </div>
              </div>

              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                <div className="text-[8px] text-slate-400 uppercase">Rover Speed</div>
                <div className="text-xs font-bold text-amber-400 mt-0.5">
                  {currentPosition?.speed ? `${currentPosition.speed.toFixed(1)} m/s` : '0.0 m/s'}
                </div>
              </div>
            </div>

            {/* Packet Transmission Meter */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span>Packets Transmitted: <strong className="text-white font-mono">{packetsSent}</strong></span>
              <span>Last Sent: <strong className="text-cyan-400 font-mono">{lastTransmission}</strong></span>
            </div>
          </div>

          {/* D-Pad Joystick & Controls Card (Optimized for Desktop + Mobile) */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Interactive D-Pad Joystick
                </span>
              </div>

              {/* Step Size Selector */}
              <div className="flex items-center space-x-1.5 text-[10px] font-mono">
                <span className="text-slate-400">Step Size:</span>
                <select
                  value={stepSize}
                  onChange={(e) => setStepSize(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-cyan-300 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value={0.00001}>1 Meter</option>
                  <option value={0.00003}>3 Meters</option>
                  <option value={0.00005}>5 Meters</option>
                  <option value={0.00015}>15 Meters</option>
                </select>
              </div>
            </div>

            {/* Touch D-Pad Joystick Grid */}
            <div className="flex flex-col items-center justify-center space-y-2 py-2 select-none">
              <button
                onClick={() => moveSimulated(stepSize, 0, 0, 'N')}
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition active:scale-90 shadow-lg touch-manipulation ${
                  activeDirection === 'N'
                    ? 'bg-cyan-500 text-white border-cyan-300 scale-105'
                    : 'bg-slate-800 hover:bg-cyan-600 text-white border-slate-700 hover:border-cyan-400'
                }`}
                title="Step North (W / Up Arrow)"
              >
                <ArrowUp className="w-6 h-6" />
              </button>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => moveSimulated(0, -stepSize * 1.3, 270, 'W')}
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition active:scale-90 shadow-lg touch-manipulation ${
                    activeDirection === 'W'
                      ? 'bg-cyan-500 text-white border-cyan-300 scale-105'
                      : 'bg-slate-800 hover:bg-cyan-600 text-white border-slate-700 hover:border-cyan-400'
                  }`}
                  title="Step West (A / Left Arrow)"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>

                <div className="w-12 h-12 rounded-full bg-slate-950 border-2 border-slate-700 flex flex-col items-center justify-center text-[9px] font-mono text-cyan-400 font-bold shadow-inner">
                  <span>ROVER</span>
                </div>

                <button
                  onClick={() => moveSimulated(0, stepSize * 1.3, 90, 'E')}
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition active:scale-90 shadow-lg touch-manipulation ${
                    activeDirection === 'E'
                      ? 'bg-cyan-500 text-white border-cyan-300 scale-105'
                      : 'bg-slate-800 hover:bg-cyan-600 text-white border-slate-700 hover:border-cyan-400'
                  }`}
                  title="Step East (D / Right Arrow)"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>

              <button
                onClick={() => moveSimulated(-stepSize, 0, 180, 'S')}
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition active:scale-90 shadow-lg touch-manipulation ${
                  activeDirection === 'S'
                    ? 'bg-cyan-500 text-white border-cyan-300 scale-105'
                    : 'bg-slate-800 hover:bg-cyan-600 text-white border-slate-700 hover:border-cyan-400'
                }`}
                title="Step South (S / Down Arrow)"
              >
                <ArrowDown className="w-6 h-6" />
              </button>
            </div>

            {/* Desktop Keyboard Shortcuts Banner */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px] text-slate-300 font-mono">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Keyboard className="w-4 h-4 text-cyan-400" />
                <span>Desktop Key Controls:</span>
              </span>
              <div className="flex items-center space-x-1 font-bold text-cyan-300">
                <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">W</span>
                <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">A</span>
                <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">S</span>
                <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">D</span>
                <span className="text-slate-500">or</span>
                <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Arrows</span>
              </div>
            </div>

            {/* Auto-Walk Patrol Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs text-slate-200 font-bold">Auto Boundary Patrol</div>
                <div className="text-[10px] text-slate-400">Automatically steps rover along boundary perimeter</div>
              </div>
              <button
                onClick={() => setAutoWalk(!autoWalk)}
                disabled={!isSurveying}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                  autoWalk
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-glow-rover'
                    : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 disabled:opacity-40'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>{autoWalk ? 'Patrolling...' : 'Auto Walk'}</span>
              </button>
            </div>
          </div>

          {/* Custom Coordinates Input Card */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-2.5 shadow-xl">
            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Set Initial Origin Coordinates
              </span>
              <button
                onClick={syncToUserLocation}
                className="text-cyan-400 hover:underline flex items-center gap-1 text-[10px]"
              >
                <RefreshCw className="w-3 h-3" /> Auto Detect
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[9px] text-slate-400 block mb-1 font-mono">LATITUDE</label>
                <input
                  type="text"
                  value={inputLat}
                  onChange={(e) => setInputLat(e.target.value)}
                  placeholder="21.1458000"
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[9px] text-slate-400 block mb-1 font-mono">LONGITUDE</label>
                <input
                  type="text"
                  value={inputLng}
                  onChange={(e) => setInputLng(e.target.value)}
                  placeholder="79.0882000"
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <button
              onClick={handleApplyCustomCoords}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-700 active:scale-95 shadow"
            >
              Teleport Rover to Coordinates
            </button>
          </div>
        </div>

        {/* Right Column: Live Desktop GIS Map Window */}
        <div className="lg:col-span-7 h-full relative bg-slate-950 flex flex-col border-l border-slate-800/80">
          <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between shrink-0 z-10">
            <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Interactive Telemetry Map View
            </span>
            <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
              <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-cyan-300">
                BROKER: {brokerUrl.split('//')[1] || 'hivemq'}
              </span>
              <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                TOPIC: {topic}
              </span>
            </div>
          </div>

          <div className="w-full flex-1 relative">
            <DynamicMap
              roverLocation={currentPosition}
              capturedPoints={[]}
              autoFollow={true}
              onToggleAutoFollow={() => {}}
              mapStyle="street"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
