'use client';

import React from 'react';
import { LocateFixed, Plus, Layers, Settings, Zap } from 'lucide-react';

interface MobileNavBarProps {
  onCenterLocation: () => void;
  onCapturePoint: () => void;
  onTogglePanel: () => void;
  onOpenSettings: () => void;
  autoCaptureEnabled: boolean;
  onToggleAutoCapture: () => void;
  capturedCount: number;
  isRoverActive: boolean;
}

export default function MobileNavBar({
  onCenterLocation,
  onCapturePoint,
  onTogglePanel,
  onOpenSettings,
  autoCaptureEnabled,
  onToggleAutoCapture,
  capturedCount,
  isRoverActive,
}: MobileNavBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[500] bg-slate-950/95 border-t border-slate-800 px-3 py-2 flex items-center justify-around md:hidden shadow-lg backdrop-blur-md font-sans">
      {/* 1. Center Location */}
      <button
        onClick={onCenterLocation}
        className="flex flex-col items-center justify-center p-1.5 text-slate-300 hover:text-white transition active:scale-95"
      >
        <LocateFixed className="w-5 h-5" />
        <span className="text-[9px] font-medium text-slate-300 mt-0.5">Center</span>
      </button>

      {/* 2. Primary Capture Button */}
      <button
        onClick={onCapturePoint}
        disabled={!isRoverActive}
        className={`flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
          isRoverActive
            ? 'bg-slate-100 text-slate-900 shadow-md'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
        }`}
      >
        <Plus className="w-4 h-4 mr-1 stroke-[3]" />
        <span>Capture ({capturedCount})</span>
      </button>

      {/* 3. Auto Capture Toggle */}
      <button
        onClick={onToggleAutoCapture}
        className={`flex flex-col items-center justify-center p-1.5 transition active:scale-95 ${
          autoCaptureEnabled ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Zap className="w-5 h-5" />
        <span className="text-[9px] font-medium mt-0.5">{autoCaptureEnabled ? 'Auto ON' : 'Auto OFF'}</span>
      </button>

      {/* 4. Panel Toggle */}
      <button
        onClick={onTogglePanel}
        className="flex flex-col items-center justify-center p-1.5 text-slate-300 hover:text-white transition active:scale-95"
      >
        <Layers className="w-5 h-5" />
        <span className="text-[9px] font-medium text-slate-300 mt-0.5">Panel</span>
      </button>

      {/* 5. Settings */}
      <button
        onClick={onOpenSettings}
        className="flex flex-col items-center justify-center p-1.5 text-slate-300 hover:text-white transition active:scale-95"
      >
        <Settings className="w-5 h-5" />
        <span className="text-[9px] font-medium text-slate-300 mt-0.5">Settings</span>
      </button>
    </div>
  );
}
