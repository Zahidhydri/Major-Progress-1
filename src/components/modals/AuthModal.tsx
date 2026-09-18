'use client';

import React, { useState } from 'react';
import { X, User, ShieldCheck, Mail, Lock, Building, CheckCircle2, LogOut } from 'lucide-react';
import { UserProfile } from '@/types/survey';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  user,
  onUpdateUser,
}: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(!user.isAuthenticated);
  const [email, setEmail] = useState(user.email || '');
  const [name, setName] = useState(user.name || '');
  const [role, setRole] = useState<UserProfile['role']>(user.role || 'lead_surveyor');
  const [organization, setOrganization] = useState(user.organization || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      id: user.id || `usr_${Date.now()}`,
      name: name || 'Lead Surveyor',
      email: email || 'surveyor@geoverify.io',
      role,
      organization: organization || 'GeoVerify GIS Systems',
      isAuthenticated: true,
    });
    onClose();
  };

  const handleLogout = () => {
    onUpdateUser({
      id: '',
      name: 'Guest Surveyor',
      email: '',
      role: 'field_technician',
      organization: '',
      isAuthenticated: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {user.isAuthenticated ? 'Surveyor Profile' : 'Surveyor Sign In'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {user.isAuthenticated ? 'Authenticated Account' : 'Sign in for Cloud Sync'}
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

        {/* Form / Profile Body */}
        {user.isAuthenticated ? (
          <div className="p-5 space-y-4 text-xs">
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-base">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-slate-100 text-sm">{user.name}</div>
                <div className="text-slate-400 text-xs font-mono">{user.email}</div>
                <div className="text-[10px] text-cyan-400 font-mono capitalize mt-0.5">
                  {user.role.replace('_', ' ')} • {user.organization}
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Session active. Projects automatically saved under your account.</span>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl font-semibold transition flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                Full Name
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Er. Zahid Hydri"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="surveyor@geoverify.io"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                  Surveyor Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                >
                  <option value="lead_surveyor">Lead Surveyor</option>
                  <option value="field_technician">Field Technician</option>
                  <option value="gis_analyst">GIS Analyst</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. GeoVerify GIS Ltd"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg transition"
              >
                Sign In / Register Profile
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
