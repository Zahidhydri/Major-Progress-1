'use client';

import React, { useState } from 'react';
import {
  X,
  Radio,
  Smartphone,
  Gamepad2,
  Check,
  Sliders,
  Zap,
  ExternalLink,
  ShieldCheck,
  LogOut,
  Layers,
  Activity,
  User,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { AppSettings, LocationSource, UserProfile } from '@/types/survey';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  user: UserProfile;
  onOpenAuthModal: () => void;
  onLogoutUser: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  user,
  onOpenAuthModal,
  onLogoutUser,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'devices' | 'account' | 'preferences'>('devices');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isPingTesting, setIsPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  React.useEffect(() => {
    setFormData(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleTestPing = () => {
    setIsPingTesting(true);
    setPingResult(null);
    setTimeout(() => {
      setIsPingTesting(false);
      setPingResult('Connected! MQTT Broker ping latency: 32ms (High Speed)');
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                System & GPS Settings Hub
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Manage connected RTK/emulator hardware, Google login & survey preferences
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

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
              activeTab === 'devices'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Connected Devices</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
              activeTab === 'account'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Google Login</span>
            {user.isAuthenticated && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
              activeTab === 'preferences'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Survey Options</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-300">
          {/* TAB 1: CONNECTED DEVICES */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-200 block uppercase tracking-wider font-mono">
                Select Active GPS Telemetry Source
              </label>

              <div className="space-y-2">
                {/* Hardware RTK / MQTT Stream */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, locationSource: 'mqtt' })}
                  className={`w-full p-3 rounded-xl border text-left flex items-start justify-between transition ${
                    formData.locationSource === 'mqtt'
                      ? 'bg-cyan-950/40 border-cyan-500/60 text-white shadow-md'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Radio className="w-4 h-4 text-cyan-400 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <span>Hardware RTK Rover / Field Laptop (MQTT)</span>
                        <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                          Live Stream
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Receives centimetric position broadcast over MQTT broker topic
                      </div>
                    </div>
                  </div>
                  {formData.locationSource === 'mqtt' && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>

                {/* On-Device Mobile Phone GPS */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, locationSource: 'device' })}
                  className={`w-full p-3 rounded-xl border text-left flex items-start justify-between transition ${
                    formData.locationSource === 'device'
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-md'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Smartphone className="w-4 h-4 text-emerald-400 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <span>Mobile Device GPS (Field Rover Phone)</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          Phone Mode
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Uses mobile phone GPS as field hardware and broadcasts live coordinates
                      </div>
                    </div>
                  </div>
                  {formData.locationSource === 'device' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>

                {/* Virtual Emulator D-Pad */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, locationSource: 'emulator' })}
                  className={`w-full p-3 rounded-xl border text-left flex items-start justify-between transition ${
                    formData.locationSource === 'emulator'
                      ? 'bg-purple-950/40 border-purple-500/60 text-white shadow-md'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Gamepad2 className="w-4 h-4 text-purple-400 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <span>Virtual Joystick Controller</span>
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                          D-Pad / WASD
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Simulate field walking using keyboard arrows / WASD or floating joystick
                      </div>
                    </div>
                  </div>
                  {formData.locationSource === 'emulator' && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                </button>
              </div>

              {/* MQTT Broker Configuration */}
              <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3 font-mono">
                <div className="text-[11px] font-bold text-slate-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" /> MQTT Hardware Connection Parameters
                  </span>
                  <button
                    type="button"
                    onClick={handleTestPing}
                    disabled={isPingTesting}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[10px] flex items-center gap-1 transition border border-slate-700"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isPingTesting ? 'animate-spin' : ''}`} />
                    <span>Test Ping</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Broker WebSockets URL</label>
                    <input
                      type="text"
                      value={formData.mqttBrokerUrl}
                      onChange={(e) => setFormData({ ...formData, mqttBrokerUrl: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Telemetry Topic</label>
                    <input
                      type="text"
                      value={formData.mqttTopic}
                      onChange={(e) => setFormData({ ...formData, mqttTopic: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </div>

                {pingResult && (
                  <div className="p-2 bg-cyan-950/60 border border-cyan-500/40 rounded-lg text-cyan-300 text-[10px] flex items-center gap-1.5 font-mono">
                    <Activity className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>{pingResult}</span>
                  </div>
                )}
              </div>

              <a
                href="/emulator"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 flex items-center justify-between text-xs font-semibold transition"
              >
                <div className="flex items-center space-x-2">
                  <Gamepad2 className="w-4 h-4 text-cyan-400" />
                  <span>Open Standalone Rover Emulator Studio (/emulator)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* TAB 2: GOOGLE ACCOUNT & AUTH */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-200 block uppercase tracking-wider font-mono">
                Google Account & Cloud Profile
              </label>

              {user.isAuthenticated ? (
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-300 font-bold text-base shadow">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                        <span>{user.name}</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                          Google User
                        </span>
                      </div>
                      <div className="text-slate-400 font-mono text-xs truncate">{user.email}</div>
                      <div className="text-[10px] text-cyan-400 font-mono capitalize mt-0.5">
                        {user.role.replace('_', ' ')} • {user.organization}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/30 rounded-lg text-emerald-300 text-[11px] flex items-center gap-2 font-mono">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Survey projects auto-syncing to cloud database under this account.</span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={onLogoutUser}
                      className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg font-semibold transition flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-slate-950/80 rounded-xl border border-slate-800 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Save & Access Your Surveys Anywhere</h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Log in with Google to save map survey projects to cloud database and modify them later across all your devices.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuthModal();
                    }}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition flex items-center justify-center space-x-2 shadow-lg"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#ffffff"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#ffffff"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                    </svg>
                    <span>Sign In with Google Account</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-200 block uppercase tracking-wider font-mono">
                Map Layer & Boundary Capture Options
              </label>

              {/* Auto Capture */}
              <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" /> Auto Boundary Point Capture
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Automatically logs boundary points as rover moves
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...formData, autoCaptureEnabled: !formData.autoCaptureEnabled };
                      setFormData(updated);
                      onUpdateSettings(updated);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.autoCaptureEnabled ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.autoCaptureEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {formData.autoCaptureEnabled && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-mono">
                    <span className="text-[11px] text-slate-300">Distance Threshold:</span>
                    <select
                      value={formData.autoCaptureDistance}
                      onChange={(e) =>
                        setFormData({ ...formData, autoCaptureDistance: Number(e.target.value) })
                      }
                      className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none"
                    >
                      <option value={2}>Every 2 Meters</option>
                      <option value={3}>Every 3 Meters</option>
                      <option value={5}>Every 5 Meters</option>
                      <option value={10}>Every 10 Meters</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Map Tile Style */}
              <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-200 block">Default Map Layer Style</label>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  {(['osm', 'street', 'topo', 'satellite'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setFormData({ ...formData, mapStyle: style })}
                      className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold capitalize transition ${
                        formData.mapStyle === style
                          ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {style} Map
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition shadow-md"
            >
              {savedSuccess ? 'Settings Saved!' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

