'use client';

import React, { useState } from 'react';
import {
  GpsLocation,
  CapturedPoint,
  SurveyMetrics,
  MqttConnectionStatus,
} from '@/types/survey';
import { calculateSurveyMetrics, exportToGeoJSON, formatDMS } from '@/lib/geo';
import {
  MapPin,
  Plus,
  RotateCcw,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  Activity,
  Radio,
  Trash2,
  Undo2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Compass,
  Zap,
} from 'lucide-react';

interface ControlPanelProps {
  roverLocation: GpsLocation | null;
  capturedPoints: CapturedPoint[];
  onCapturePoint: () => void;
  onResetSurvey: () => void;
  onDeletePoint: (id: string) => void;
  onUndoLastPoint: () => void;
  mqttStatus: MqttConnectionStatus;
  topic: string;
  brokerUrl: string;
}

export default function ControlPanel({
  roverLocation,
  capturedPoints,
  onCapturePoint,
  onResetSurvey,
  onDeletePoint,
  onUndoLastPoint,
  mqttStatus,
  topic,
  brokerUrl,
}: ControlPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'points' | 'telemetry'>('metrics');
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Compute metrics in real-time
  const metrics: SurveyMetrics | null = calculateSurveyMetrics(capturedPoints);

  // Handle Export GeoJSON
  const handleExportGeoJSON = () => {
    const geojson = exportToGeoJSON(capturedPoints, metrics);
    if (!geojson) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `survey_boundary_${new Date().toISOString().slice(0, 10)}.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyCoordinates = () => {
    const text = capturedPoints
      .map((p) => `P${p.pointNumber}: ${p.lat.toFixed(7)}, ${p.lng.toFixed(7)} (Acc: ±${p.accuracy?.toFixed(1) || 'N/A'}m)`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = {
    connected: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    connecting: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    reconnecting: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    disconnected: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
    error: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  }[mqttStatus];

  return (
    <aside
      aria-label="Survey control panel"
      className="absolute top-4 right-4 z-[400] w-96 max-w-[calc(100vw-2rem)] glass-panel rounded-2xl shadow-2xl transition-all duration-300 border border-slate-700/60 overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]"
    >
      {/* Header Bar */}
      <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white flex items-center gap-1.5">
              GeoVerify <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">WebGIS</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]" title={topic}>
              {topic}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border flex items-center gap-1 ${statusColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${mqttStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`} />
            <span className="capitalize">{mqttStatus}</span>
          </span>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Live Rover Telemetry Card */}
          <div className="p-3.5 bg-slate-900/40 border-b border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 font-mono">
                <Activity className="w-3.5 h-3.5" /> Live Rover Stream
              </span>
              {roverLocation ? (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  RECEIVING PACKETS
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded animate-pulse">
                  AWAITING GPS SIGNAL...
                </span>
              )}
            </div>

            {roverLocation ? (
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">LATITUDE</div>
                  <div className="text-white font-semibold text-xs tracking-tight">{roverLocation.lat.toFixed(7)}°</div>
                  <div className="text-[9px] text-slate-500 truncate">{formatDMS(roverLocation.lat, true)}</div>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">LONGITUDE</div>
                  <div className="text-white font-semibold text-xs tracking-tight">{roverLocation.lng.toFixed(7)}°</div>
                  <div className="text-[9px] text-slate-500 truncate">{formatDMS(roverLocation.lng, false)}</div>
                </div>

                <div className="bg-slate-950/60 p-1.5 px-2 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">ACCURACY</span>
                  <span className="text-emerald-400 font-bold text-xs">
                    {roverLocation.accuracy !== undefined ? `±${roverLocation.accuracy.toFixed(2)}m` : 'N/A'}
                  </span>
                </div>

                <div className="bg-slate-950/60 p-1.5 px-2 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">LAST SYNC</span>
                  <span className="text-slate-300 text-[10px]">
                    {new Date(roverLocation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center mb-2">
                  <Zap className="w-4 h-4 animate-bounce" />
                </div>
                <p className="text-xs text-slate-300 font-medium">No Rover Telemetry Yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Open the <a href="/emulator" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">Mobile Emulator</a> and click &quot;Start Survey&quot;.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-3 bg-slate-900/60 border-b border-slate-800/80 space-y-2">
            <button
              onClick={onCapturePoint}
              disabled={!roverLocation}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wide uppercase transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg ${
                roverLocation
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Capture Boundary Point ({capturedPoints.length + 1})</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onUndoLastPoint}
                disabled={capturedPoints.length === 0}
                className="py-1.5 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-700/70 border border-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 transition"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo Point</span>
              </button>

              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={capturedPoints.length === 0}
                className="py-1.5 px-3 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-900/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Survey</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-medium">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 py-2.5 text-center border-b-2 transition ${
                activeTab === 'metrics'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Land Metrics ({capturedPoints.length})
            </button>
            <button
              onClick={() => setActiveTab('points')}
              className={`flex-1 py-2.5 text-center border-b-2 transition ${
                activeTab === 'points'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Vertices ({capturedPoints.length})
            </button>
          </div>

          {/* Content Area with Scroll */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-[160px] max-h-[260px]">
            {activeTab === 'metrics' && (
              <div className="space-y-3">
                {metrics ? (
                  <>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-950/40 to-slate-900/60 border border-cyan-800/40 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-cyan-300 font-mono uppercase tracking-wider">
                        <span>Calculated Enclosed Area</span>
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                          @turf/turf
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                        <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-400">SQUARE METERS</div>
                          <div className="text-base font-bold text-white">
                            {metrics.areaSqMeters.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-cyan-400">m²</span>
                          </div>
                        </div>

                        <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-400">HECTARES</div>
                          <div className="text-base font-bold text-emerald-400">
                            {metrics.areaHectares.toFixed(4)} <span className="text-xs text-slate-300">ha</span>
                          </div>
                        </div>

                        <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-400">ACRES</div>
                          <div className="text-sm font-bold text-amber-300">
                            {metrics.areaAcres.toFixed(4)} <span className="text-xs text-slate-300">ac</span>
                          </div>
                        </div>

                        <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-400">SQUARE FEET</div>
                          <div className="text-sm font-bold text-slate-200">
                            {metrics.areaSqFeet.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs text-slate-400">ft²</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                      <div className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">
                        Perimeter Boundary
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono">
                        <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-400">METERS</div>
                          <div className="text-sm font-bold text-cyan-300">
                            {metrics.perimeterMeters.toFixed(2)} m
                          </div>
                        </div>
                        <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-400">FEET</div>
                          <div className="text-sm font-bold text-slate-300">
                            {metrics.perimeterFeet.toFixed(1)} ft
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-6 px-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-2">
                      <Layers className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-medium text-slate-300">
                      {capturedPoints.length === 0
                        ? 'No Boundary Points Captured'
                        : capturedPoints.length < 3
                        ? `Need ${3 - capturedPoints.length} More Point(s) to Calculate Area`
                        : ''}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Walk to each corner of the property and click &quot;Capture Boundary Point&quot;.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'points' && (
              <div className="space-y-2">
                {capturedPoints.length > 0 ? (
                  capturedPoints.map((point) => (
                    <div
                      key={point.id}
                      className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between font-mono text-xs hover:border-slate-700 transition"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold text-[10px]">
                          {point.pointNumber}
                        </span>
                        <div>
                          <div className="text-white text-[11px]">
                            {point.lat.toFixed(6)}°, {point.lng.toFixed(6)}°
                          </div>
                          <div className="text-[9px] text-slate-500 flex items-center gap-2">
                            <span>Acc: ±{point.accuracy?.toFixed(1) || 'N/A'}m</span>
                            <span>•</span>
                            <span>{new Date(point.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDeletePoint(point.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                        title="Delete this point"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No points recorded yet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions (Export & Copy) */}
          <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportGeoJSON}
                disabled={capturedPoints.length === 0}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 transition"
                title="Download GeoJSON format"
              >
                <Download className="w-3 h-3 text-cyan-400" />
                <span>GeoJSON</span>
              </button>

              <button
                onClick={handleCopyCoordinates}
                disabled={capturedPoints.length === 0}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 transition"
                title="Copy coordinates to clipboard"
              >
                <Copy className="w-3 h-3 text-cyan-400" />
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <a
              href="/emulator"
              target="_blank"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium hover:underline"
            >
              <span>Rover Emulator</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reset Survey */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h2 className="text-sm font-bold text-white">Reset Survey Data?</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will erase all <strong className="text-cyan-400">{capturedPoints.length} captured boundary points</strong> and clear the calculated polygon from the map.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetSurvey();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-600/30"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
