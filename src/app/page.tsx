'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import DynamicMap from '@/components/map/DynamicMap';
import ControlPanel from '@/components/dashboard/ControlPanel';
import { CapturedPoint, GpsLocation, MqttConnectionStatus } from '@/types/survey';
import { DEFAULT_MQTT_CONFIG, parseTelemetryPayload } from '@/lib/mqtt';
import {
  Navigation,
  Satellite,
  Compass,
  Smartphone,
  Info,
  Maximize2,
  Share2,
} from 'lucide-react';

export default function DashboardPage() {
  const [roverLocation, setRoverLocation] = useState<GpsLocation | null>(null);
  const [capturedPoints, setCapturedPoints] = useState<CapturedPoint[]>([]);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [mqttStatus, setMqttStatus] = useState<MqttConnectionStatus>('connecting');
  const [totalPackets, setTotalPackets] = useState<number>(0);
  const [brokerUrl, setBrokerUrl] = useState<string>(DEFAULT_MQTT_CONFIG.brokerUrl);
  const [topic, setTopic] = useState<string>(DEFAULT_MQTT_CONFIG.topic);

  const clientRef = useRef<MqttClient | null>(null);

  // Initialize MQTT Connection on Mount
  useEffect(() => {
    const clientId = `${DEFAULT_MQTT_CONFIG.clientIdPrefix}dash_${Math.random().toString(16).substring(2, 8)}`;

    console.log(`Connecting to MQTT broker: ${brokerUrl} (Client: ${clientId})`);
    setMqttStatus('connecting');

    const client = mqtt.connect(brokerUrl, {
      clientId,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
    });

    clientRef.current = client;

    client.on('connect', () => {
      console.log('Connected to MQTT Broker successfully!');
      setMqttStatus('connected');
      client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          console.error(`Failed to subscribe to topic ${topic}:`, err);
        } else {
          console.log(`Subscribed to topic: ${topic}`);
        }
      });
    });

    client.on('message', (receivedTopic, message) => {
      if (receivedTopic === topic) {
        const rawStr = message.toString();
        const payload = parseTelemetryPayload(rawStr);
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
          setTotalPackets((prev) => prev + 1);
        }
      }
    });

    client.on('reconnect', () => {
      console.log('Reconnecting to MQTT broker...');
      setMqttStatus('reconnecting');
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
  }, [brokerUrl, topic]);

  // Capture boundary point at current rover location
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

  // Reset survey boundary
  const handleResetSurvey = useCallback(() => {
    setCapturedPoints([]);
  }, []);

  // Delete specific point
  const handleDeletePoint = useCallback((id: string) => {
    setCapturedPoints((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      // Re-index point numbers
      return filtered.map((p, idx) => ({ ...p, pointNumber: idx + 1 }));
    });
  }, []);

  // Undo last captured point
  const handleUndoLastPoint = useCallback(() => {
    setCapturedPoints((prev) => prev.slice(0, -1));
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Floating App Bar */}
      <header className="absolute top-4 left-4 z-[400] flex items-center space-x-3 pointer-events-auto">
        <div className="glass-panel px-4 py-2.5 rounded-2xl flex items-center space-x-3 shadow-2xl border border-slate-700/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white shadow-glow-cyan">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-black tracking-wider text-white">
                GEOLAND <span className="text-cyan-400 font-mono text-xs">GIS</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                <span>IoT Land Survey System</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className="text-cyan-400">{totalPackets} Pkts</span>
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Quick Emulator Launch Link */}
          <a
            href="/emulator"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition shadow-sm text-xs font-medium"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Open Rover Emulator</span>
          </a>
        </div>
      </header>

      {/* Full-screen Leaflet Dynamic Map Component */}
      <div className="w-full h-full">
        <DynamicMap
          roverLocation={roverLocation}
          capturedPoints={capturedPoints}
          autoFollow={autoFollow}
          onToggleAutoFollow={() => setAutoFollow(!autoFollow)}
        />
      </div>

      {/* Floating Control Panel (Top-Right HUD) */}
      <ControlPanel
        roverLocation={roverLocation}
        capturedPoints={capturedPoints}
        onCapturePoint={handleCapturePoint}
        onResetSurvey={handleResetSurvey}
        onDeletePoint={handleDeletePoint}
        onUndoLastPoint={handleUndoLastPoint}
        mqttStatus={mqttStatus}
        topic={topic}
        brokerUrl={brokerUrl}
      />
    </main>
  );
}
