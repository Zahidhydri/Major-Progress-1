'use client';

import React, { useState } from 'react';
import {
  GpsLocation,
  CapturedPoint,
  SurveyMetrics,
  MqttConnectionStatus,
  LocationSource,
  PolygonDisplayMode,
} from '@/types/survey';
import { calculateSurveyMetrics, exportToGeoJSON } from '@/lib/geo';
import {
  Plus,
  RotateCcw,
  Download,
  ChevronDown,
  ChevronUp,
  Activity,
  Radio,
  Trash2,
  Undo2,
  AlertCircle,
  Settings,
  Smartphone,
  Gamepad2,
  Layers,
  Zap,
  Edit2,
  Database,
  Wand2,
  EyeOff,
  Eye,
  Ruler,
  AlertTriangle,
  Upload,
} from 'lucide-react';

interface ControlPanelProps {
  roverLocation: GpsLocation | null;
  capturedPoints: CapturedPoint[];
  onCapturePoint: () => void;
  onResetSurvey: () => void;
  onDeletePoint: (id: string) => void;
  onUndoLastPoint: () => void;
  onUpdatePointLocation: (id: string, lat: number, lng: number) => void;
  onToggleExcludePoint?: (id: string) => void;
  mqttStatus: MqttConnectionStatus;
  topic: string;
  brokerUrl: string;
  locationSource: LocationSource;
  onOpenSettings: () => void;
  autoCaptureEnabled: boolean;
  autoCaptureDistance: number;
  polygonDisplayMode?: PolygonDisplayMode;
  onChangePolygonDisplayMode?: (mode: PolygonDisplayMode) => void;
  onAutoUncrossPoints?: () => void;
  onOpenProjectsModal?: () => void;
  onToggleAutoCapture?: () => void;
  onUploadMapFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ControlPanel({
  roverLocation,
  capturedPoints,
  onCapturePoint,
  onResetSurvey,
  onDeletePoint,
  onUndoLastPoint,
  onUpdatePointLocation,
  onToggleExcludePoint,
  mqttStatus,
  locationSource,
  onOpenSettings,
  autoCaptureEnabled,
  autoCaptureDistance,
  polygonDisplayMode = 'captured',
  onChangePolygonDisplayMode,
  onAutoUncrossPoints,
  onOpenProjectsModal,
  onToggleAutoCapture,
  onUploadMapFile,
}: ControlPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'points' | 'segments'>('metrics');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editLat, setEditLat] = useState<string>('');
  const [editLng, setEditLng] = useState<string>('');
  const panelFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const metrics: SurveyMetrics | null = calculateSurveyMetrics(capturedPoints, polygonDisplayMode);

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

  const startEditing = (p: CapturedPoint) => {
    setEditingPointId(p.id);
    setEditLat(p.lat.toString());
    setEditLng(p.lng.toString());
  };

  const saveEdit = (id: string) => {
    const parsedLat = parseFloat(editLat);
    const parsedLng = parseFloat(editLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      onUpdatePointLocation(id, parsedLat, parsedLng);
    }
    setEditingPointId(null);
  };

  const sourceBadge = {
    mqtt: { label: 'RTK Rover', icon: Radio, color: 'text-slate-200 bg-slate-800 border-slate-700' },
    device: { label: 'Phone GPS', icon: Smartphone, color: 'text-slate-200 bg-slate-800 border-slate-700' },
    emulator: { label: 'Emulator', icon: Gamepad2, color: 'text-slate-200 bg-slate-800 border-slate-700' },
  }[locationSource];

  const SourceIcon = sourceBadge.icon;

  return (
    <aside
      aria-label="Survey control panel"
      className="z-[400] bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-xl transition-all duration-300 overflow-hidden flex flex-col font-sans
        md:absolute md:top-4 md:right-4 md:w-96 md:max-h-[calc(100vh-2rem)]
        max-md:fixed max-md:bottom-14 max-md:left-0 max-md:right-0 max-md:rounded-b-none max-md:max-h-[75vh]"
    >
      {/* Mobile Handle Bar */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full py-1.5 bg-slate-950 flex justify-center cursor-pointer md:hidden select-none"
      >
        <div className="w-12 h-1 rounded-full bg-slate-700" />
      </div>

      {/* Top Header Bar */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenSettings}
            className={`text-[10px] px-2.5 py-1 rounded-lg font-mono font-medium border flex items-center gap-1.5 transition ${sourceBadge.color}`}
            title="Location Settings"
          >
            <SourceIcon className="w-3 h-3" />
            <span>{sourceBadge.label}</span>
          </button>

          {onOpenProjectsModal && (
            <button
              onClick={onOpenProjectsModal}
              className="text-[10px] px-2.5 py-1 rounded-lg font-mono font-bold bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/60 flex items-center gap-1 transition shadow-sm"
              title="Open Database Projects Modal"
            >
              <Database className="w-3 h-3 text-cyan-400" />
              <span>Database</span>
            </button>
          )}

          {onToggleAutoCapture && (
            <button
              onClick={onToggleAutoCapture}
              className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 transition ${
                autoCaptureEnabled
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
              title="Toggle Auto Boundary Point Capture"
            >
              <Zap className={`w-3 h-3 ${autoCaptureEnabled ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
              <span>{autoCaptureEnabled ? 'Auto ON' : 'Auto OFF'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Live Position Stream */}
          <div className="p-3 bg-slate-950/40 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                <Activity className="w-3.5 h-3.5" /> GPS Stream
              </span>
              {roverLocation ? (
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  ACTIVE
                </span>
              ) : (
                <span className="text-[9px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                  SEARCHING...
                </span>
              )}
            </div>

            {roverLocation ? (
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <div className="text-[9px] text-slate-500">LATITUDE</div>
                  <div className="text-white font-medium text-xs tracking-tight">
                    {typeof roverLocation.lat === 'number' ? roverLocation.lat.toFixed(7) : '0.0000000'}°
                  </div>
                </div>

                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <div className="text-[9px] text-slate-500">LONGITUDE</div>
                  <div className="text-white font-medium text-xs tracking-tight">
                    {typeof roverLocation.lng === 'number' ? roverLocation.lng.toFixed(7) : '0.0000000'}°
                  </div>
                </div>

                <div className="bg-slate-900 p-1.5 px-2 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-[9px] text-slate-500">ACCURACY</span>
                  <span className="text-emerald-400 font-bold text-xs">
                    {typeof roverLocation.accuracy === 'number' ? `±${roverLocation.accuracy.toFixed(2)}m` : 'N/A'}
                  </span>
                </div>

                <div className="bg-slate-900 p-1.5 px-2 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-[9px] text-slate-500">LAST PING</span>
                  <span className="text-slate-400 text-[9px]">
                    {new Date(roverLocation.timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-center">
                <p className="text-xs text-slate-400">Awaiting Location Signal...</p>
              </div>
            )}
          </div>

          {/* Self-Intersection Alert & Auto-Fix Banner */}
          {metrics?.hasKinks && (
            <div className="p-2.5 bg-amber-950/80 border-b border-amber-700/60 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="text-[11px] font-medium leading-tight">
                  Irregular shape detected with overlapping criss-cross lines!
                </span>
              </div>
              {onAutoUncrossPoints && (
                <button
                  onClick={onAutoUncrossPoints}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] uppercase shrink-0 transition flex items-center gap-1 shadow"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Uncross</span>
                </button>
              )}
            </div>
          )}

          {/* Outlier Alert Banner */}
          {metrics && metrics.outlierPointIds.length > 0 && (
            <div className="p-2 bg-amber-950/40 border-b border-amber-800/40 px-3 flex items-center justify-between text-[11px] text-amber-300">
              <span className="flex items-center gap-1 font-mono">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>{metrics.outlierPointIds.length} potential GPS outlier point(s)</span>
              </span>
              <button
                onClick={() => setActiveTab('points')}
                className="text-[10px] text-amber-400 underline font-bold"
              >
                Review Points
              </button>
            </div>
          )}

          {/* Manual Capture Actions */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 space-y-2">
            <button
              onClick={onCapturePoint}
              disabled={!roverLocation}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase transition flex items-center justify-center space-x-2 shadow ${
                roverLocation
                  ? 'bg-slate-100 hover:bg-white text-slate-900 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Capture Boundary Point ({capturedPoints.length + 1})</span>
            </button>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={onUndoLastPoint}
                disabled={capturedPoints.length === 0}
                className="py-1.5 px-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1 transition"
                title="Undo last captured point"
              >
                <Undo2 className="w-3 h-3" />
                <span>Undo</span>
              </button>

              {onAutoUncrossPoints && (
                <button
                  onClick={onAutoUncrossPoints}
                  disabled={capturedPoints.length < 3}
                  className="py-1.5 px-1 rounded-lg text-[11px] font-medium text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1 transition"
                  title="Auto-sort vertices to fix self-intersecting lines"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Uncross</span>
                </button>
              )}

              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={capturedPoints.length === 0}
                className="py-1.5 px-1 rounded-lg text-[11px] font-medium text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-900/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1 transition"
                title="Reset active survey points"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Polygon Display Mode Switcher */}
          {onChangePolygonDisplayMode && capturedPoints.length >= 3 && (
            <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400 font-semibold">Shape Mode:</span>
              <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => onChangePolygonDisplayMode('captured')}
                  className={`px-2 py-0.5 rounded transition ${
                    polygonDisplayMode === 'captured' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Captured
                </button>
                <button
                  onClick={() => onChangePolygonDisplayMode('auto_uncross')}
                  className={`px-2 py-0.5 rounded transition ${
                    polygonDisplayMode === 'auto_uncross' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Uncrossed
                </button>
                <button
                  onClick={() => onChangePolygonDisplayMode('convex_hull')}
                  className={`px-2 py-0.5 rounded transition ${
                    polygonDisplayMode === 'convex_hull' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Hull
                </button>
              </div>
            </div>
          )}

          {/* Tab Bar */}
          <div className="flex border-b border-slate-800 bg-slate-950 text-xs font-medium">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 py-2 text-center border-b-2 transition ${
                activeTab === 'metrics'
                  ? 'border-slate-200 text-white bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Land Metrics ({capturedPoints.length})
            </button>
            <button
              onClick={() => setActiveTab('points')}
              className={`flex-1 py-2 text-center border-b-2 transition ${
                activeTab === 'points'
                  ? 'border-slate-200 text-white bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Vertices ({capturedPoints.length})
            </button>
            <button
              onClick={() => setActiveTab('segments')}
              className={`flex-1 py-2 text-center border-b-2 transition ${
                activeTab === 'segments'
                  ? 'border-slate-200 text-white bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sides ({metrics?.segments.length || 0})
            </button>
          </div>

          {/* Scrollable Tab Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[140px] max-h-[240px]">
            {activeTab === 'metrics' && (
              <div className="space-y-3">
                {metrics ? (
                  <>
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <div className="text-[10px] text-slate-400 font-mono font-semibold uppercase flex items-center justify-between">
                        <span>Enclosed Land Area</span>
                        <span className="text-[9px] text-cyan-400">{metrics.pointCount} Vertices</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <div className="text-[9px] text-slate-500">SQ METERS</div>
                          <div className="text-sm font-bold text-white">
                            {metrics.areaSqMeters.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-400">m²</span>
                          </div>
                        </div>

                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <div className="text-[9px] text-slate-500">HECTARES</div>
                          <div className="text-sm font-bold text-emerald-400">
                            {metrics.areaHectares.toFixed(4)} <span className="text-[10px] text-slate-400">ha</span>
                          </div>
                        </div>

                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <div className="text-[9px] text-slate-500">ACRES</div>
                          <div className="text-xs font-bold text-amber-300">
                            {metrics.areaAcres.toFixed(4)} <span className="text-[10px] text-slate-400">ac</span>
                          </div>
                        </div>

                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <div className="text-[9px] text-slate-500">GUNTHA</div>
                          <div className="text-xs font-bold text-cyan-300">
                            {metrics.areaGuntha.toFixed(2)} <span className="text-[10px] text-slate-400">guntha</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 font-mono">
                      <div className="text-[10px] text-slate-500 uppercase flex justify-between">
                        <span>Perimeter & Closing Loop</span>
                        <span className="text-amber-400">Gap: {metrics.closureDistanceMeters.toFixed(2)}m</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-900 p-1.5 px-2 rounded-lg border border-slate-800 text-xs">
                          <span className="text-slate-500 text-[9px] mr-1">PERIMETER:</span>
                          <span className="font-bold text-slate-200">{metrics.perimeterMeters.toFixed(2)} m</span>
                        </div>
                        <div className="bg-slate-900 p-1.5 px-2 rounded-lg border border-slate-800 text-xs">
                          <span className="text-slate-500 text-[9px] mr-1">BIGHA:</span>
                          <span className="font-bold text-slate-300">{metrics.areaBigha.toFixed(3)} bigha</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-6 px-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
                    <Layers className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                    <p className="text-xs font-medium text-slate-400">
                      {capturedPoints.length === 0
                        ? 'No Boundary Points Captured'
                        : capturedPoints.length < 3
                        ? `Capture ${3 - capturedPoints.length} more point(s) to calculate area`
                        : ''}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'points' && (
              <div className="space-y-1.5">
                {capturedPoints.length > 0 ? (
                  capturedPoints.map((point) => {
                    const isOutlier = metrics?.outlierPointIds.includes(point.id);
                    return (
                      <div
                        key={point.id}
                        className={`p-2 rounded-lg bg-slate-950/70 border flex flex-col space-y-1 font-mono text-xs transition ${
                          point.isExcluded
                            ? 'border-slate-800 opacity-50'
                            : isOutlier
                            ? 'border-amber-600/70 bg-amber-950/20'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {editingPointId === point.id ? (
                          <div className="space-y-2 p-1">
                            <div className="text-[10px] text-slate-400 font-bold">Edit Point #{point.pointNumber} Coordinates</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <span className="text-[9px] text-slate-500">LAT:</span>
                                <input
                                  type="text"
                                  value={editLat}
                                  onChange={(e) => setEditLat(e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500">LNG:</span>
                                <input
                                  type="text"
                                  value={editLng}
                                  onChange={(e) => setEditLng(e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end space-x-1 pt-1">
                              <button
                                onClick={() => setEditingPointId(null)}
                                className="px-2 py-1 text-[10px] bg-slate-800 text-slate-400 rounded hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdit(point.id)}
                                className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded font-bold"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                  point.pointNumber === 1
                                    ? 'bg-emerald-600 text-white border border-emerald-400'
                                    : point.pointNumber === capturedPoints.length
                                    ? 'bg-cyan-600 text-white border border-cyan-400'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                                }`}
                              >
                                {point.pointNumber}
                              </span>
                              <div>
                                <div className="text-slate-200 text-[11px] flex items-center gap-1">
                                  <span>
                                    {typeof point.lat === 'number' ? point.lat.toFixed(6) : '0.000000'}°, {typeof point.lng === 'number' ? point.lng.toFixed(6) : '0.000000'}°
                                  </span>
                                  {isOutlier && (
                                    <span className="text-[9px] text-amber-400 font-bold bg-amber-500/20 px-1 rounded">OUTLIER</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1">
                              {onToggleExcludePoint && (
                                <button
                                  onClick={() => onToggleExcludePoint(point.id)}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                  title={point.isExcluded ? 'Include point in area' : 'Exclude point from area'}
                                >
                                  {point.isExcluded ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              )}

                              <button
                                onClick={() => startEditing(point)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Manually edit lat/lng"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => onDeletePoint(point.id)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                                title="Delete point"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No points recorded.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'segments' && (
              <div className="space-y-1.5 font-mono text-xs">
                {metrics && metrics.segments.length > 0 ? (
                  metrics.segments.map((seg, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <Ruler className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-bold text-slate-200">
                          P{seg.fromPointNumber} ➔ P{seg.toPointNumber}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-400">{seg.lengthMeters.toFixed(2)} m</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">({seg.bearingDegrees.toFixed(1)}°)</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Capture at least 3 points to view side lengths.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportGeoJSON}
                disabled={capturedPoints.length === 0}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 transition"
              >
                <Download className="w-3 h-3" />
                <span>GeoJSON</span>
              </button>

              {onUploadMapFile && (
                <>
                  <input
                    type="file"
                    ref={panelFileInputRef}
                    onChange={onUploadMapFile}
                    accept=".json,.geojson"
                    className="hidden"
                  />
                  <button
                    onClick={() => panelFileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/60 flex items-center space-x-1.5 transition shadow-sm"
                    title="Upload JSON or GeoJSON survey file to load map"
                  >
                    <Upload className="w-3 h-3 text-emerald-400" />
                    <span>Upload Map</span>
                  </button>
                </>
              )}
            </div>

            {onOpenProjectsModal && (
              <button
                onClick={onOpenProjectsModal}
                disabled={capturedPoints.length === 0}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 shadow transition disabled:opacity-40"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Save to DB</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h2 className="text-sm font-bold text-white">Reset Survey Data?</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will erase all <strong className="text-slate-100">{capturedPoints.length} captured boundary points</strong>.
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
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

