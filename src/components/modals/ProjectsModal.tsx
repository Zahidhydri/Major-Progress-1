'use client';

import React, { useEffect, useState, useRef } from 'react';
import { X, FolderOpen, Plus, Download, Trash2, Calendar, MapPin, Search, Cloud, CloudOff, Check, Upload, AlertCircle } from 'lucide-react';
import { SurveyProject, CapturedPoint } from '@/types/survey';
import { getAllSurveyProjects, deleteSurveyProject, exportProjectFile, exportProjectGeoJSON, exportProjectCSV, saveSurveyProject } from '@/lib/db';
import { isFirebaseConfigured } from '@/lib/firebase';
import { calculateSurveyMetrics } from '@/lib/geo';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: SurveyProject) => void;
  onSaveCurrentAsProject: (title: string, clientName?: string) => void;
  hasActivePoints: boolean;
}

export default function ProjectsModal({
  isOpen,
  onClose,
  onLoadProject,
  onSaveCurrentAsProject,
  hasActivePoints,
}: ProjectsModalProps) {
  const [projects, setProjects] = useState<SurveyProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [fileErrorNotice, setFileErrorNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    const list = await getAllSurveyProjects();
    setProjects(list);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileErrorNotice(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let loadedPoints: CapturedPoint[] = [];
        let loadedTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

        // Case A: GeoVerify Project Object
        if (parsed.points && Array.isArray(parsed.points)) {
          loadedPoints = parsed.points;
          if (parsed.title) loadedTitle = parsed.title;
        }
        // Case B: Standard GeoJSON FeatureCollection
        else if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          let ptIdx = 1;
          parsed.features.forEach((feat: any) => {
            if (feat.geometry && feat.geometry.type === 'Point') {
              const [lng, lat, elev] = feat.geometry.coordinates;
              loadedPoints.push({
                id: `pt_json_${Date.now()}_${ptIdx}`,
                pointNumber: ptIdx++,
                lat,
                lng,
                elevation: elev || 120,
                timestamp: Date.now(),
              });
            } else if (feat.geometry && (feat.geometry.type === 'Polygon' || feat.geometry.type === 'LineString')) {
              const ring = feat.geometry.type === 'Polygon' ? feat.geometry.coordinates[0] : feat.geometry.coordinates;
              ring.slice(0, -1).forEach((coord: number[]) => {
                const [lng, lat, elev] = coord;
                loadedPoints.push({
                  id: `pt_json_${Date.now()}_${ptIdx}`,
                  pointNumber: ptIdx++,
                  lat,
                  lng,
                  elevation: elev || 120,
                  timestamp: Date.now(),
                });
              });
            }
          });
        }

        if (loadedPoints.length > 0) {
          const metrics = calculateSurveyMetrics(loadedPoints, 'captured');
          const project: SurveyProject = {
            id: `proj_upload_${Date.now()}`,
            title: loadedTitle,
            points: loadedPoints,
            metrics,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await saveSurveyProject(project);
          onLoadProject(project);
          onClose();
        } else {
          setFileErrorNotice('No valid boundary points found in uploaded file.');
        }
      } catch (err) {
        console.error('File parsing error:', err);
        setFileErrorNotice('Failed to parse file. Please select a valid GeoVerify JSON or GeoJSON survey file.');
      }
    };
    reader.readAsText(file);
  };

  const confirmAndDelete = async () => {
    if (deleteConfirmId) {
      await deleteSurveyProject(deleteConfirmId);
      setDeleteConfirmId(null);
      loadProjects();
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onSaveCurrentAsProject(newTitle, newClient);
    setIsCreating(false);
    setNewTitle('');
    setNewClient('');
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
    loadProjects();
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.clientName && p.clientName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Survey Projects Database
                </h2>
                {isFirebaseConfigured ? (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Cloud className="w-2.5 h-2.5" /> Firestore Cloud Active
                  </span>
                ) : (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                    <CloudOff className="w-2.5 h-2.5" /> Local DB Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Saved land boundaries ({projects.length} Projects in Database)
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json,.geojson"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow transition"
              title="Upload JSON or GeoJSON survey file from computer"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Upload JSON</span>
            </button>

            {hasActivePoints && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 shadow transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Active Survey</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Toast Notification */}
          {saveSuccessNotice && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-300 font-medium flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Survey project saved to database successfully!
              </span>
            </div>
          )}

          {/* File Error Notification */}
          {fileErrorNotice && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl text-rose-300 font-medium flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{fileErrorNotice}</span>
              </span>
              <button onClick={() => setFileErrorNotice(null)} className="p-1 hover:bg-rose-900/50 rounded">
                <X className="w-3.5 h-3.5 text-rose-300" />
              </button>
            </div>
          )}

          {/* Search Bar & Stats */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search saved projects by name or client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Create Form */}
          {isCreating && (
            <form onSubmit={handleSaveSubmit} className="p-4 bg-slate-950/80 rounded-xl border border-cyan-500/40 space-y-3">
              <div className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Save Current Land Survey Project to Database
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-mono block mb-1">Project Name / Parcel ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Parcel #A-102 Boundary"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-mono block mb-1">Client / Owner Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold shadow"
                >
                  Save to Database
                </button>
              </div>
            </form>
          )}

          {/* List of Saved Projects */}
          {filteredProjects.length === 0 ? (
            <div className="text-center py-10 text-slate-500 space-y-2">
              <FolderOpen className="w-8 h-8 mx-auto opacity-40" />
              <p>No matching survey projects found in database.</p>
              <p className="text-[10px]">Capture points on map and click "Save Active Survey" above.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-xs truncate">{proj.title}</span>
                      {proj.clientName && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {proj.clientName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1 text-cyan-400 font-bold">
                        <MapPin className="w-3 h-3" /> {proj.points.length} Points
                      </span>
                      {proj.metrics && (
                        <span>Area: {proj.metrics.areaSqMeters.toFixed(1)} m² ({proj.metrics.areaAcres.toFixed(3)} acres)</span>
                      )}
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" /> {new Date(proj.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onLoadProject(proj);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 rounded-lg text-xs font-semibold border border-cyan-800/60 transition shadow-sm"
                    >
                      Load Map
                    </button>
                    <button
                      onClick={() => exportProjectGeoJSON(proj)}
                      className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition font-medium flex items-center gap-1"
                      title="Export GeoJSON / Map file"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>Export</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(proj.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 hover:bg-rose-500/10 rounded-lg transition"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation In-App UI Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[800] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Survey Project?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action will permanently erase this land boundary survey project from the database.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndDelete}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

