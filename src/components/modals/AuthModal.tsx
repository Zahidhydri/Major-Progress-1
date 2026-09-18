'use client';

import React, { useState } from 'react';
import { X, User, ShieldCheck, Mail, Lock, CheckCircle2, LogOut, Loader2, AlertCircle, Send } from 'lucide-react';
import { UserProfile } from '@/types/survey';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  isFirebaseConfigured,
} from '@/lib/firebase';

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
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserProfile['role']>('lead_surveyor');
  const [organization, setOrganization] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Firebase Google Auth Sign-In
  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !auth) {
      setErrorMsg('Firebase configuration missing in .env.local');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      onUpdateUser({
        id: fbUser.uid,
        name: fbUser.displayName || 'Surveyor',
        email: fbUser.email || '',
        role: 'lead_surveyor',
        organization: 'College Project Firebase',
        isAuthenticated: true,
      });
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setErrorMsg(err.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  // Firebase Strict Email/Password Auth
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    if (!isFirebaseConfigured || !auth) {
      setErrorMsg('Firebase is not configured in .env.local');
      setIsLoading(false);
      return;
    }

    try {
      if (isSignUpMode) {
        // Real Sign Up
        const res = await createUserWithEmailAndPassword(auth, email, password);
        try {
          await sendEmailVerification(res.user);
          setInfoMsg(`Account created! A verification link has been sent to ${email}. Please check your inbox.`);
        } catch (vErr) {
          console.warn('Verification email notice:', vErr);
        }

        onUpdateUser({
          id: res.user.uid,
          name: name || email.split('@')[0],
          email: res.user.email || email,
          role,
          organization: organization || 'GeoVerify GIS',
          isAuthenticated: true,
        });
        setIsLoading(false);
      } else {
        // Real Sign In
        const res = await signInWithEmailAndPassword(auth, email, password);
        onUpdateUser({
          id: res.user.uid,
          name: res.user.displayName || email.split('@')[0],
          email: res.user.email || email,
          role,
          organization: organization || 'GeoVerify GIS',
          isAuthenticated: true,
        });
        setIsLoading(false);
        onClose();
      }
    } catch (err: any) {
      console.error('Firebase Auth error:', err);
      let friendlyError = err.message;
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        friendlyError = 'Invalid email or password. Please check your credentials.';
      } else if (err.code === 'auth/user-not-found') {
        friendlyError = 'No user account found with this email. Click "Sign Up" below to register.';
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyError = 'This email is already registered. Please sign in instead.';
      }
      setErrorMsg(friendlyError);
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('Signout notice:', err);
      }
    }
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
    <div className="fixed inset-0 z-[700] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">
              {user.isAuthenticated ? 'Surveyor Profile' : isSignUpMode ? 'Register New Account' : 'Firebase Sign In'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {user.isAuthenticated ? (
          <div className="p-5 space-y-4 text-xs text-slate-300">
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white truncate">{user.name}</div>
                <div className="text-slate-400 font-mono text-[11px] truncate">{user.email}</div>
                <div className="text-[10px] text-blue-400 font-mono capitalize mt-0.5">
                  {user.role.replace('_', ' ')} • {user.organization}
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Firebase Authenticated Session Active.</span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleLogout}
                className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg font-medium transition flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4 text-xs text-slate-300">
            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-xl font-medium text-slate-200 transition flex items-center justify-center space-x-2.5 shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center my-3">
              <div className="flex-1 border-t border-slate-800" />
              <span className="px-3 text-[10px] text-slate-500 font-mono uppercase">Or Email & Password</span>
              <div className="flex-1 border-t border-slate-800" />
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-[11px] flex items-center gap-2">
                <Send className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{infoMsg}</span>
              </div>
            )}

            <form onSubmit={handleEmailAuthSubmit} className="space-y-3">
              {isSignUpMode && (
                <div>
                  <label className="text-[10px] text-slate-400 font-mono block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Er. Zahid Hydri"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="surveyor@college-project.com"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUpMode(!isSignUpMode);
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="text-[11px] text-blue-400 hover:underline"
                >
                  {isSignUpMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition flex items-center gap-1.5"
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSignUpMode ? 'Register Account' : 'Sign In'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
