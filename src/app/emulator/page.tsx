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
} from 'lucide-react';

export default function RoverEmulatorPage() {
  const [isSurveying, setIsSurveying] = useState(false);
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

  const clientRef = useRef<MqttClient | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const autoWalkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const brokerUrl = DEFAULT_MQTT_CONFIG.brokerUrl;
  const topic = DEFAULT_MQTT_CONFIG.topic;

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
    (dLat: number, dLng: number, heading: number) => {
      setCurrentPosition((prev) => {
        const baseLat = prev ? prev.lat : 27.7172;
        const baseLng = prev ? prev.lng : 85.3240;
        const newLat = baseLat + dLat;
        const newLng = baseLng + dLng;
        const accuracy = 0.02 + Math.random() * 0.02; // ±0.02m RTK precision

        if (isSurveying) {
          publishLocation(newLat, newLng, accuracy, 120.0, heading, 1.4);
        }

        return {
          lat: newLat,
          lng: newLng,
          accuracy,
          altitude: 120.0,
          heading,
          speed: isSurveying ? 1.4 : 0,
          timestamp: Date.now(),
        };
      });
    },
    [isSurveying, publishLocation]
  );

  // Keyboard Arrow Keys Navigation (Desktop support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          moveSimulated(stepSize, 0, 0);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          moveSimulated(-stepSize, 0, 180);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveSimulated(0, -stepSize * 1.3, 270);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveSimulated(0, stepSize * 1.3, 90);
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
        { dLat: stepSize, dLng: 0, h: 0 },
        { dLat: stepSize, dLng: 0, h: 0 },
        { dLat: 0, dLng: stepSize * 1.3, h: 90 },
        { dLat: 0, dLng: stepSize * 1.3, h: 90 },
        { dLat: -stepSize, dLng: 0, h: 180 },
        { dLat: -stepSize, dLng: 0, h: 180 },
        { dLat: 0, dLng: -stepSize * 1.3, h: 270 },
        { dLat: 0, dLng: -stepSize * 1.3, h: 270 },
      ];

      autoWalkIntervalRef.current = setInterval(() => {
        const dir = directions[step % directions.length];
        moveSimulated(dir.dLat, dir.dLng, dir.h);
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
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-3 md:p-6 font-sans select-none pb-24 overflow-y-auto">
      {/* Container Grid for Responsive Layout */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Handheld Rover Controller */}
        <div className="lg:col-span-6 w-full bg-slate-900 border-2 border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] lg:max-h-none">
          {/* Top Hardware Bezel Bar */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-glow-rover" />
              <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
                RTK-EMULATOR // GNSS-PRO-X
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {mqttStatus === 'connected' ? (
                <span className="flex items-center space-x-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <Wifi className="w-3 h-3" />
                  <span>ONLINE</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                  <WifiOff className="w-3 h-3" />
                  <span className="capitalize">{mqttStatus}</span>
                </span>
              )}
            </div>
          </div>

          {/* Top Location Sync Header */}
          <div className="bg-slate-950/60 p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs flex-shrink-0">
            <button
              onClick={syncToUserLocation}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition active:scale-95"
            >
              <LocateFixed className="w-4 h-4" />
              <span>{locationSynced ? 'Location Synced!' : 'Sync to My Location'}</span>
            </button>

            <a
              href="/"
              target="_blank"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium hover:underline text-xs"
            >
              <span>Dashboard Map</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Scrollable Control Panel Body */}
          <div className="p-4 md:p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-110px)] lg:max-h-none pr-1.5">
            {/* Main Giant Survey Toggle Button */}
            <button
              onClick={toggleSurvey}
              className={`w-full py-4 px-6 rounded-2xl font-black text-base tracking-wider uppercase transition-all duration-300 flex items-center justify-center space-x-3 shadow-2xl relative overflow-hidden active:scale-[0.98] ${
                isSurveying
                  ? 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white shadow-rose-600/30 border border-rose-500'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-extrabold shadow-emerald-500/30 border border-emerald-400'
              }`}
            >
              {isSurveying ? (
                <>
                  <Square className="w-5 h-5 fill-current animate-pulse" />
                  <span>STOP BROADCASTING TELEMETRY</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>START TELEMETRY STREAM</span>
                </>
              )}
            </button>

            {/* Telemetry Display HUD Card */}
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-3.5 space-y-3 font-mono shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Radio className="w-3.5 h-3.5" /> High Precision RTK Telemetry
                </span>
                <span className="text-[9px] text-slate-400">
                  {isSurveying ? '● STREAMING 1Hz' : '○ STANDBY'}
                </span>
              </div>

              {/* Coordinates Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider">Latitude</div>
                  <div className="text-sm font-bold text-white tracking-tight mt-0.5">
                    {currentPosition ? currentPosition.lat.toFixed(7) : '0.0000000'}°
                  </div>
                  <div className="text-[9px] text-slate-500 truncate mt-0.5">
                    {currentPosition ? formatDMS(currentPosition.lat, true) : '--'}
                  </div>
                </div>

                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
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
              <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                  <div className="text-[8px] text-slate-400">RTK ACCURACY</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    {currentPosition?.accuracy ? `±${currentPosition.accuracy.toFixed(2)}m` : '±0.03m'}
                  </div>
                </div>

                <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                  <div className="text-[8px] text-slate-400">ELEVATION</div>
                  <div className="text-xs font-bold text-cyan-300 mt-0.5">
                    {currentPosition?.altitude ? `${currentPosition.altitude.toFixed(1)}m` : '120.0m'}
                  </div>
                </div>

                <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                  <div className="text-[8px] text-slate-400">SPEED</div>
                  <div className="text-xs font-bold text-amber-400 mt-0.5">
                    {currentPosition?.speed ? `${currentPosition.speed.toFixed(1)} m/s` : '0.0 m/s'}
                  </div>
                </div>
              </div>

              {/* Packet Transmission Meter */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <span>Packets Transmitted: <strong className="text-white font-mono">{packetsSent}</strong></span>
                <span>Last Sent: <strong className="text-cyan-400 font-mono">{lastTransmission}</strong></span>
              </div>
            </div>

            {/* Custom Coordinates Manual Input */}
            <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-3 space-y-2">
              <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Set Custom Starting Coordinates
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-400 block mb-1">LATITUDE</label>
                  <input
                    type="text"
                    value={inputLat}
                    onChange={(e) => setInputLat(e.target.value)}
                    placeholder="27.7172000"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[9px] text-slate-400 block mb-1">LONGITUDE</label>
                  <input
                    type="text"
                    value={inputLng}
                    onChange={(e) => setInputLng(e.target.value)}
                    placeholder="85.3240000"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <button
                onClick={handleApplyCustomCoords}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-700 active:scale-95"
              >
                Apply Coordinates
              </button>
            </div>

            {/* D-Pad & Controls Card */}
            <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Joystick & Controls
                  </span>
                </div>

                {/* Step Size Selector */}
                <div className="flex items-center space-x-1 text-[10px] font-mono">
                  <span className="text-slate-400">Step:</span>
                  <select
                    value={stepSize}
                    onChange={(e) => setStepSize(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 text-cyan-300 rounded px-1.5 py-0.5"
                  >
                    <option value={0.00001}>1m</option>
                    <option value={0.00003}>3m</option>
                    <option value={0.00005}>5m</option>
                    <option value={0.00015}>15m</option>
                  </select>
                </div>
              </div>

              {/* Touch D-Pad Joystick */}
              <div className="flex flex-col items-center justify-center space-y-2 py-2 select-none">
                <button
                  onClick={() => moveSimulated(stepSize, 0, 0)}
                  className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 text-white border border-slate-700 hover:border-cyan-400 flex items-center justify-center transition active:scale-90 shadow-lg touch-manipulation"
                  title="Step North (W / Up Arrow)"
                >
                  <ArrowUp className="w-6 h-6" />
                </button>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => moveSimulated(0, -stepSize * 1.3, 270)}
                    className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 text-white border border-slate-700 hover:border-cyan-400 flex items-center justify-center transition active:scale-90 shadow-lg touch-manipulation"
                    title="Step West (A / Left Arrow)"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>

                  <div className="w-12 h-12 rounded-full bg-slate-950 border-2 border-slate-700 flex flex-col items-center justify-center text-[9px] font-mono text-cyan-400 font-bold shadow-inner">
                    <span>WALK</span>
                  </div>

                  <button
                    onClick={() => moveSimulated(0, stepSize * 1.3, 90)}
                    className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 text-white border border-slate-700 hover:border-cyan-400 flex items-center justify-center transition active:scale-90 shadow-lg touch-manipulation"
                    title="Step East (D / Right Arrow)"
                  >
                    <ArrowRight className="w-6 h-6" />
                  </button>
                </div>

                <button
                  onClick={() => moveSimulated(-stepSize, 0, 180)}
                  className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 text-white border border-slate-700 hover:border-cyan-400 flex items-center justify-center transition active:scale-90 shadow-lg touch-manipulation"
                  title="Step South (S / Down Arrow)"
                >
                  <ArrowDown className="w-6 h-6" />
                </button>
              </div>

              {/* Desktop Keyboard Shortcuts Tip */}
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Keyboard className="w-3.5 h-3.5 text-slate-300" />
                  <span>Desktop Shortcut Keys:</span>
                </span>
                <span className="font-mono text-cyan-300">W, A, S, D / Arrow Keys</span>
              </div>

              {/* Auto-Walk Patrol Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-xs text-slate-300 font-medium">Auto Patrol Simulation</span>
                <button
                  onClick={() => setAutoWalk(!autoWalk)}
                  disabled={!isSurveying}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    autoWalk
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-glow-rover'
                      : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 disabled:opacity-40'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>{autoWalk ? 'Patrolling...' : 'Auto Perimeter Walk'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive GIS Map Preview */}
        <div className="lg:col-span-6 w-full h-[400px] lg:h-[680px] bg-slate-900 border-2 border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Live Simulated GIS Map Preview
            </span>
            <span className="text-[10px] text-slate-400 font-mono">ROVER SYNC ACTIVE</span>
          </div>

          <div className="w-full h-full relative">
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
