'use client';

import React, { useState } from 'react';
import {
  X,
  Radio,
  Smartphone,
  Gamepad2,
  Key,
  Database,
  Check,
  HelpCircle,
  Cpu,
  Layers,
  Info,
} from 'lucide-react';
import { AppSettings, LocationSource } from '@/types/survey';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsModalProps) {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Hardware & System Settings
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Configure GPS hardware source, API keys & Database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Section 1: Location Hardware Mode */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5">
              <span>Location Hardware Source</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Option 1: RTK Rover MQTT */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationSource: 'mqtt' })}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                  formData.locationSource === 'mqtt'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  {formData.locationSource === 'mqtt' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div>
                  <div className="font-bold text-white text-xs">Physical RTK Rover</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">MQTT Stream (ESP32/ZED-F9P)</div>
                </div>
              </button>

              {/* Option 2: Direct Phone GPS */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationSource: 'device' })}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                  formData.locationSource === 'device'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  {formData.locationSource === 'device' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div>
                  <div className="font-bold text-white text-xs">Mobile Device GPS</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Built-in Phone Location</div>
                </div>
              </button>

              {/* Option 3: Virtual Emulator */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationSource: 'emulator' })}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                  formData.locationSource === 'emulator'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Gamepad2 className="w-4 h-4 text-amber-400" />
                  {formData.locationSource === 'emulator' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div>
                  <div className="font-bold text-white text-xs">Testing Emulator</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Simulated Rover & Noise</div>
                </div>
              </button>
            </div>
          </div>

          {/* MQTT Telemetry Settings (only visible if MQTT mode) */}
          {formData.locationSource === 'mqtt' && (
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
              <div className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                MQTT Telemetry Endpoint
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-mono">Broker WebSocket URL</label>
                  <input
                    type="text"
                    value={formData.mqttBrokerUrl}
                    onChange={(e) => setFormData({ ...formData, mqttBrokerUrl: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-mono">Telemetry Topic</label>
                  <input
                    type="text"
                    value={formData.mqttTopic}
                    onChange={(e) => setFormData({ ...formData, mqttTopic: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Place Name & Geocoding API Keys */}
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" /> Place Name & Geocoding API
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                FREE DEFAULT (NOMINATIM) ACTIVE
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              The app automatically uses <strong>OpenStreetMap Nominatim</strong> for place searching without needing any API key. If you wish to use Mapbox or Google Maps, enter your key below:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-mono">Geocoding Provider</label>
                <select
                  value={formData.geocodingProvider}
                  onChange={(e) =>
                    setFormData({ ...formData, geocodingProvider: e.target.value as any })
                  }
                  className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                >
                  <option value="nominatim">OpenStreetMap (Free, No Key)</option>
                  <option value="mapbox">Mapbox Geocoding</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono">API Key (.env.local)</label>
                <input
                  type="password"
                  placeholder="Paste Mapbox token or leave empty"
                  value={formData.geocodingApiKey}
                  onChange={(e) => setFormData({ ...formData, geocodingApiKey: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Serverless Cloud Database Readiness */}
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Database & Storage
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                LOCAL INDEXEDDB READY
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Surveys are automatically saved locally in your device database (IndexedDB) for offline field use. Serverless database sync can be configured in <code className="text-cyan-400">.env.local</code>.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow-lg transition flex items-center space-x-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Settings Saved!</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
