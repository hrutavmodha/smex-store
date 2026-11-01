'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Mail,
  Gamepad2,
  Copy,
  Check,
  Edit3,
  Save,
  Laptop,
  Trophy,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../lib/useAuth';
import { fetchWithAuth } from '../../lib/api';
import { Alert } from '@/components/ui/Alert';

export default function ProfilePage() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  const [inGameId, setInGameId] = useState('');
  const [bio, setBio] = useState('');
  const [playstyle, setPlaystyle] = useState('Aggressive Rusher');
  const [avatarPreset, setAvatarPreset] = useState('preset_default_01');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login?redirect=/profile');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setInGameId(user.inGameId || '');
      // Fetch full profile info
      void (async () => {
        try {
          const res = await fetchWithAuth('/api/v1/auth/me');
          if (res.ok) {
            const data = await res.json();
            const prof = data.profile || {};
            if (prof.bio) setBio(prof.bio);
            if (prof.playstyle) setPlaystyle(prof.playstyle);
            if (prof.avatarPreset) setAvatarPreset(prof.avatarPreset);
          }
        } catch {
          // Fallback gracefully
        }
      })();
    }
  }, [user]);

  const handleCopyId = () => {
    if (!user?.inGameId && !inGameId) return;
    void navigator.clipboard.writeText(user?.inGameId || inGameId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetchWithAuth('/api/v1/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inGameId,
          bio,
          playstyle,
          avatarPreset,
        }),
      });

      if (res.ok) {
        setIsEditing(false);
        setFeedback({
          type: 'success',
          message: 'Profile updated successfully!',
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({
          type: 'error',
          message: err.detail || err.message || 'Failed to update profile',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Network error while updating profile',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center font-mono text-emerald-primary">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading player profile...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Feedback Alert */}
      {feedback && (
        <Alert
          variant={feedback.type === 'success' ? 'success' : 'error'}
          description={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Profile Header Hero Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle relative overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar Circle */}
            <div
              data-preset={avatarPreset}
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-emerald-primary/15 border-2 border-emerald-primary/40 flex items-center justify-center text-emerald-primary font-black text-2xl sm:text-3xl shadow-inner shrink-0"
            >
              {(user.ign || user.email).charAt(0).toUpperCase()}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight truncate">
                  {user.ign || 'Player'}
                </h1>

                {/* Role Badges */}
                {user.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-primary border border-emerald-500/30 uppercase">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Admin
                  </span>
                )}
                {user.role === 'manager' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 uppercase">
                    <Shield className="h-3.5 w-3.5" />
                    Standing Manager
                  </span>
                )}
                {(!user.role || user.role === 'user') && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-bg-surface-elevated text-text-secondary border border-border-subtle">
                    Player
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-text-secondary flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-text-muted" />
                  {user.email}
                </span>

                {user.phoneNumber && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="h-3.5 w-3.5 text-text-muted" />
                    {user.phoneNumber}
                  </span>
                )}

                {user.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-primary">
                    <Check className="h-3 w-3" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
                    <ShieldAlert className="h-3 w-3" />
                    Unverified
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-bg-surface-elevated hover:bg-bg-canvas border border-border-subtle hover:border-emerald-primary/40 text-xs font-semibold text-text-primary transition-all duration-[120ms] ease-out active:scale-[0.98] cursor-pointer min-h-[38px]"
            >
              <Edit3 className="h-3.5 w-3.5 text-emerald-primary" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Identity & Bio Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-emerald-primary" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                  In-Game Identity & Specs
                </h2>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">
                    In-Game ID (BGMI / Free Fire / Valorant UID)
                  </label>
                  <input
                    type="text"
                    value={inGameId}
                    onChange={(e) => setInGameId(e.target.value)}
                    placeholder="e.g. 5123456789"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-bg-surface-elevated border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">
                    Preferred Playstyle
                  </label>
                  <select
                    value={playstyle}
                    onChange={(e) => setPlaystyle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-bg-surface-elevated border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors"
                  >
                    <option value="Aggressive Rusher">Aggressive Rusher</option>
                    <option value="Sniper / Support">Sniper / Support</option>
                    <option value="Tactical IGL (In-Game Leader)">Tactical IGL (In-Game Leader)</option>
                    <option value="Flanker / Lurker">Flanker / Lurker</option>
                    <option value="Flex / All-Rounder">Flex / All-Rounder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">
                    Player Bio
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell your squad and competitors about your playstyle and achievements..."
                    className="w-full px-3.5 py-2.5 rounded-lg bg-bg-surface-elevated border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-emerald-primary transition-colors"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-lg bg-bg-surface-elevated text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-primary hover:bg-emerald-hover text-black text-xs font-bold transition-all duration-[120ms] ease-out active:scale-[0.98] disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-bg-surface-elevated border border-border-subtle flex flex-col justify-between">
                  <span className="text-[11px] font-mono text-text-muted uppercase">In-Game ID (UID)</span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {user.inGameId || inGameId || 'Not set'}
                    </span>
                    {(user.inGameId || inGameId) && (
                      <button
                        type="button"
                        onClick={handleCopyId}
                        className="p-1.5 rounded-md hover:bg-bg-surface text-text-secondary hover:text-text-primary transition-colors"
                        title="Copy In-Game ID"
                      >
                        {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-primary" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-bg-surface-elevated border border-border-subtle flex flex-col justify-between">
                  <span className="text-[11px] font-mono text-text-muted uppercase">Playstyle Role</span>
                  <div className="mt-2 text-sm font-bold text-text-primary">
                    {playstyle || 'Flex / All-Rounder'}
                  </div>
                </div>

                <div className="sm:col-span-2 p-3.5 rounded-xl bg-bg-surface-elevated border border-border-subtle">
                  <span className="text-[11px] font-mono text-text-muted uppercase block mb-1">Player Bio</span>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {bio || 'No bio provided yet. Click "Edit Profile" to add your favorite weapons, competitive history, and achievements.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Portal Shortcuts */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary pb-2 border-b border-border-subtle">
              Account Portals
            </h3>

            {user.role === 'admin' && (
              <Link
                href="/admin"
                className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-primary transition-all duration-[120ms] ease-out active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Admin Governance Portal</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}

            {user.role === 'manager' && (
              <Link
                href="/manager"
                className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-xs font-bold text-purple-700 dark:text-purple-300 transition-all duration-[120ms] ease-out active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Manager Operations Panel</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}

            <Link
              href="/settings/devices"
              className="flex items-center justify-between p-3 rounded-xl bg-bg-surface-elevated hover:bg-bg-canvas border border-border-subtle text-xs font-semibold text-text-primary transition-all duration-[120ms] ease-out active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <Laptop className="h-4 w-4 text-text-secondary" />
                <span>Device & Session Management</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
            </Link>

            <Link
              href="/tournaments"
              className="flex items-center justify-between p-3 rounded-xl bg-bg-surface-elevated hover:bg-bg-canvas border border-border-subtle text-xs font-semibold text-text-primary transition-all duration-[120ms] ease-out active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-text-secondary" />
                <span>My Tournaments & Matches</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
