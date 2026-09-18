'use client';

import React, { useEffect, useState } from 'react';
import { X, FolderOpen, Plus, Download, Trash2, Calendar, MapPin, Layers, Check } from 'lucide-react';
import { SurveyProject } from '@/types/survey';
import { getAllSurveyProjects, deleteSurveyProject, exportProjectFile } from '@/lib/db';

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
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    const list = await getAllSurveyProjects();
    setProjects(list);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this survey project?')) {
      await deleteSurveyProject(id);
      loadProjects();
    }
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onSaveCurrentAsProject(newTitle, newClient);
    setIsCreating(false);
    setNewTitle('');
    setNewClient('');
    loadProjects();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Survey Projects Database
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Saved land boundaries ({projects.length} Projects)
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
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
          {/* Create Form */}
          {isCreating && (
            <form onSubmit={handleSaveSubmit} className="p-4 bg-slate-950/80 rounded-xl border border-cyan-500/40 space-y-3">
              <div className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Save Current Land Survey Project
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
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold"
                >
                  Save to Database
                </button>
              </div>
            </form>
          )}

          {/* List of Saved Projects */}
          {projects.length === 0 ? (
            <div className="text-center py-10 text-slate-500 space-y-2">
              <FolderOpen className="w-8 h-8 mx-auto opacity-40" />
              <p>No saved survey projects in database yet.</p>
              <p className="text-[10px]">Capture points on map and click "Save Active Survey" above.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {projects.map((proj) => (
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
                      <span className="flex items-center gap-1 text-cyan-400">
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
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => exportProjectFile(proj)}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg transition"
                      title="Export JSON"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(proj.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 hover:bg-rose-500/10 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
