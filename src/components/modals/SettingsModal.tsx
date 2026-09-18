'use client';

import React, { useState } from 'react';
import { X, Radio, Smartphone, Gamepad2, Check, Sliders, Navigation, Zap, ExternalLink } from 'lucide-react';
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
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-slate-300" />
            <h2 className="text-sm font-semibold text-slate-100">Survey & GPS Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Section 1: Location Source */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200 block">Location Source</label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationSource: 'mqtt' })}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                  formData.locationSource === 'mqtt'
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Radio className="w-4 h-4 text-slate-300" />
                  <div>
                    <div className="font-semibold text-slate-100">Hardware RTK GPS (MQTT)</div>
                    <div className="text-[10px] text-slate-400">Uses RTK hardware if online (auto-falls back to Device GPS)</div>
                  </div>
                </div>
                {formData.locationSource === 'mqtt' && <Check className="w-4 h-4 text-slate-200" />}
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationSource: 'device' })}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                  formData.locationSource === 'device'
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Smartphone className="w-4 h-4 text-slate-300" />
                  <div>
                    <div className="font-semibold text-slate-100">On-Device Mobile GPS</div>
                    <div className="text-[10px] text-slate-400">Uses phone/tablet built-in location sensor</div>
                  </div>
                </div>
                {formData.locationSource === 'device' && <Check className="w-4 h-4 text-slate-200" />}
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationSource: 'emulator' })}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                  formData.locationSource === 'emulator'
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Gamepad2 className="w-4 h-4 text-slate-300" />
                  <div>
                    <div className="font-semibold text-slate-100">Virtual Testing Emulator</div>
                    <div className="text-[10px] text-slate-400">Simulated rover movement for field testing</div>
                  </div>
                </div>
                {formData.locationSource === 'emulator' && <Check className="w-4 h-4 text-slate-200" />}
              </button>

              <a
                href="/emulator"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 flex items-center justify-between text-xs font-semibold transition"
              >
                <div className="flex items-center space-x-2">
                  <Gamepad2 className="w-4 h-4" />
                  <span>Open Standalone Rover Emulator Studio (/emulator)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Section 2: Auto Point Capture System */}
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-slate-300" /> Auto Boundary Point Capture
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Automatically captures boundary points as surveyor walks (no buttons required on hardware)
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, autoCaptureEnabled: !formData.autoCaptureEnabled })
                }
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
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-300">Auto-Capture Distance Threshold:</span>
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

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-white text-slate-900 rounded-lg transition"
            >
              {savedSuccess ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
