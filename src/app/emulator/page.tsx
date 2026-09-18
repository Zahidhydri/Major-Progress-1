'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { DEFAULT_MQTT_CONFIG } from '@/lib/mqtt';
import { formatDMS } from '@/lib/geo';
import {
  Radio,
  Play,
  Square,
  Navigation2,
  Signal,
  Wifi,
  WifiOff,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Footprints,
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
  const [stepSize, setStepSize] = useState<number>(0.00015); // ~15 meters per step
  const [autoWalk, setAutoWalk] = useState(false);

  const clientRef = useRef<MqttClient | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const autoWalkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const brokerUrl = DEFAULT_MQTT_CONFIG.brokerUrl;
  const topic = DEFAULT_MQTT_CONFIG.topic;

  // Initialize MQTT Client on mount
  useEffect(() => {
    const clientId = `${DEFAULT_MQTT_CONFIG.clientIdPrefix}emitter_${Math.random().toString(16).substring(2, 8)}`;
    console.log(`Connecting emulator to MQTT: ${brokerUrl}`);
    setMqttStatus('connecting');

    const client = mqtt.connect(brokerUrl, {
      clientId,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
    });

    clientRef.current = client;

    client.on('connect', () => {
      console.log('Emulator connected to MQTT broker!');
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
        accuracy: accuracy !== undefined ? Number(accuracy.toFixed(2)) : 0.85,
        altitude: altitude !== undefined ? altitude : 120.5,
        heading: heading !== undefined ? heading : 45,
        speed: speed !== undefined ? speed : 1.2,
        timestamp: now,
        deviceId: 'GNSS-ROVER-PRO-X',
      };

      setCurrentPosition(payload);
      setLastTransmission(new Date(now).toLocaleTimeString());

      if (clientRef.current && clientRef.current.connected) {
        clientRef.current.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
          if (err) {
            console.error('Publish error:', err);
          } else {
            setPacketsSent((p) => p + 1);
          }
        });
      }
    },
    [topic]
  );

  // Handle Geolocation Watch
  useEffect(() => {
    if (isSurveying && !simulatedMode) {
      if (!('geolocation' in navigator)) {
        setErrorMessage('Geolocation is not supported by your browser. Switch to Field Simulation mode.');
        return;
      }

      setErrorMessage(null);

      const successHandler = (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
        publishLocation(latitude, longitude, accuracy, altitude, heading, speed);
      };

      const errorHandler = (error: GeolocationPositionError) => {
        console.warn('Geolocation watch error:', error.message);
        setErrorMessage(`GPS: ${error.message}. You can also enable "Virtual Field Simulator" below.`);
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

  // Initial simulation position (San Francisco / Greenwich / Kathmandu default)
  useEffect(() => {
    if (!currentPosition) {
      // Default initial coordinates for simulator (approx 37.7749, -122.4194 or 27.7172, 85.3240)
      setCurrentPosition({
        lat: 37.774929,
        lng: -122.419416,
        accuracy: 0.65,
        altitude: 45.2,
        heading: 90,
        speed: 0.0,
        timestamp: Date.now(),
      });
    }
  }, [currentPosition]);

  // Simulation Step Movements (N, S, E, W)
  const moveSimulated = useCallback(
    (dLat: number, dLng: number, heading: number) => {
      setCurrentPosition((prev) => {
        const baseLat = prev ? prev.lat : 37.774929;
        const baseLng = prev ? prev.lng : -122.419416;
        const newLat = baseLat + dLat;
        const newLng = baseLng + dLng;
        const accuracy = 0.5 + Math.random() * 0.4; // 0.5 - 0.9m RTK accuracy

        if (isSurveying) {
          publishLocation(newLat, newLng, accuracy, 48.0 + Math.random() * 2, heading, 1.4);
        }

        return {
          lat: newLat,
          lng: newLng,
          accuracy,
          altitude: 48.0,
          heading,
          speed: isSurveying ? 1.4 : 0,
          timestamp: Date.now(),
        };
      });
    },
    [isSurveying, publishLocation]
  );

  // Auto-walk simulator pattern
  useEffect(() => {
    if (autoWalk && isSurveying) {
      let step = 0;
      // Pre-programmed polygon perimeter walk
      const directions = [
        { dLat: stepSize, dLng: 0, h: 0 }, // North
        { dLat: stepSize, dLng: 0, h: 0 },
        { dLat: 0, dLng: stepSize * 1.4, h: 90 }, // East
        { dLat: 0, dLng: stepSize * 1.4, h: 90 },
        { dLat: -stepSize, dLng: 0, h: 180 }, // South
        { dLat: -stepSize, dLng: 0, h: 180 },
        { dLat: 0, dLng: -stepSize * 1.4, h: 270 }, // West
        { dLat: 0, dLng: -stepSize * 1.4, h: 270 },
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 md:p-6 font-sans select-none pb-12">
      {/* Mobile Device Frame Container */}
      <div className="w-full max-w-md bg-slate-900 border-2 border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Hardware Bezel Bar */}
        <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-glow-rover" />
            <span className="font-mono text-xs font-bold text-slate-300 tracking-wider">
              GNSS-EMULATOR // ROVER-01
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {mqttStatus === 'connected' ? (
              <span className="flex items-center space-x-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
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

        {/* Dashboard Link Banner */}
        <div className="bg-slate-800/40 px-5 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">Target WebGIS Dashboard</span>
          <a
            href="/"
            target="_blank"
            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold hover:underline"
          >
            <span>Open Map (/)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Main Rover Body */}
        <div className="p-5 space-y-5">
          {/* Main Giant Survey Toggle Button */}
          <button
            onClick={toggleSurvey}
            className={`w-full py-5 px-6 rounded-2xl font-black text-lg tracking-wider uppercase transition-all duration-300 flex items-center justify-center space-x-3 shadow-2xl relative overflow-hidden active:scale-[0.98] ${
              isSurveying
                ? 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white shadow-rose-600/30 border border-rose-500'
                : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-extrabold shadow-emerald-500/30 border border-emerald-400'
            }`}
          >
            {isSurveying ? (
              <>
                <Square className="w-6 h-6 fill-current animate-pulse" />
                <span>STOP SURVEY (BROADCASTING)</span>
              </>
            ) : (
              <>
                <Play className="w-6 h-6 fill-current" />
                <span>START SURVEY</span>
              </>
            )}
          </button>

          {/* Telemetry Display HUD Card */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-4 space-y-3 font-mono shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5" /> High Precision GNSS Telemetry
              </span>
              <span className="text-[10px] text-slate-400">
                {isSurveying ? '● STREAMING 1Hz' : '○ STANDBY'}
              </span>
            </div>

            {/* Coordinates Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Latitude</div>
                <div className="text-base font-bold text-white tracking-tight mt-0.5">
                  {currentPosition ? currentPosition.lat.toFixed(7) : '0.0000000'}°
                </div>
                <div className="text-[9px] text-slate-500 truncate mt-0.5">
                  {currentPosition ? formatDMS(currentPosition.lat, true) : '--'}
                </div>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Longitude</div>
                <div className="text-base font-bold text-white tracking-tight mt-0.5">
                  {currentPosition ? currentPosition.lng.toFixed(7) : '0.0000000'}°
                </div>
                <div className="text-[9px] text-slate-500 truncate mt-0.5">
                  {currentPosition ? formatDMS(currentPosition.lng, false) : '--'}
                </div>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div className="text-[9px] text-slate-400">EST. ACCURACY</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5">
                  {currentPosition?.accuracy ? `±${currentPosition.accuracy.toFixed(2)}m` : '±0.85m'}
                </div>
              </div>

              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div className="text-[9px] text-slate-400">ELEVATION</div>
                <div className="text-xs font-bold text-cyan-300 mt-0.5">
                  {currentPosition?.altitude ? `${currentPosition.altitude.toFixed(1)}m` : '120.5m'}
                </div>
              </div>

              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div className="text-[9px] text-slate-400">SPEED</div>
                <div className="text-xs font-bold text-amber-400 mt-0.5">
                  {currentPosition?.speed ? `${currentPosition.speed.toFixed(1)} m/s` : '0.0 m/s'}
                </div>
              </div>
            </div>

            {/* Packet Transmission Meter */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Packets Transmitted: <strong className="text-white font-mono">{packetsSent}</strong></span>
              <span>Last Sent: <strong className="text-cyan-400 font-mono">{lastTransmission}</strong></span>
            </div>
          </div>

          {/* Mode Switcher: Device GPS vs Virtual Walk Simulator */}
          <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Input Source Mode
                </span>
              </div>
              <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setSimulatedMode(false)}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    !simulatedMode
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Device GPS
                </button>
                <button
                  onClick={() => setSimulatedMode(true)}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    simulatedMode
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Simulator
                </button>
              </div>
            </div>

            {/* Warning / Notice banner */}
            {errorMessage && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-2 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Virtual Walk Joystick Controls (When Simulator Mode is Active) */}
            {simulatedMode ? (
              <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                <p className="text-[11px] text-slate-400">
                  Use the D-Pad or Auto-Walk to simulate walking around a boundary property:
                </p>

                {/* D-Pad Controller */}
                <div className="flex flex-col items-center justify-center space-y-1.5 py-2">
                  <button
                    onClick={() => moveSimulated(stepSize, 0, 0)}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-cyan-600 text-white border border-slate-700 hover:border-cyan-400 transition active:scale-95 shadow"
                    title="Step North"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => moveSimulated(0, -stepSize * 1.3, 270)}
                      className="p-3 rounded-xl bg-slate-800 hover:bg-cyan-600 text-white border border-slate-700 hover:border-cyan-400 transition active:scale-95 shadow"
                      title="Step West"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center font-mono text-[10px] text-cyan-400 font-bold">
                      WALK
                    </div>

                    <button
                      onClick={() => moveSimulated(0, stepSize * 1.3, 90)}
                      className="p-3 rounded-xl bg-slate-800 hover:bg-cyan-600 text-white border border-slate-700 hover:border-cyan-400 transition active:scale-95 shadow"
                      title="Step East"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    onClick={() => moveSimulated(-stepSize, 0, 180)}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-cyan-600 text-white border border-slate-700 hover:border-cyan-400 transition active:scale-95 shadow"
                    title="Step South"
                  >
                    <ArrowDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Auto-Walk Preset Button */}
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
                    <span>{autoWalk ? 'Patrolling...' : 'Auto-Walk Perimeter'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/50 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Real Hardware GPS Active</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Streaming live coordinates from device GNSS / `watchPosition`. For testing indoors, switch to &quot;Simulator&quot;.
                </p>
              </div>
            )}
          </div>

          {/* MQTT Protocol Footer Details */}
          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-[10px] font-mono text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>MQTT Broker:</span>
              <span className="text-slate-400 truncate max-w-[200px]">{brokerUrl}</span>
            </div>
            <div className="flex justify-between">
              <span>Topic:</span>
              <span className="text-cyan-400 font-bold">{topic}</span>
            </div>
            <div className="flex justify-between">
              <span>Payload:</span>
              <span className="text-slate-400">&#123; lat, lng, timestamp, accuracy &#125;</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
