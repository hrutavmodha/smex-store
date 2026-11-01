'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sliders,
  Laptop,
  Shield,
  User,
  ArrowRight,
  Sun,
  Moon,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../../lib/useAuth';

export default function SettingsOverviewPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-primary/10 text-emerald-primary">
          <Sliders className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
            Account Settings
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage your device sessions, personal preferences, and security settings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Device Management Card */}
        <Link
          href="/settings/devices"
          className="p-5 rounded-2xl bg-bg-surface border border-border-subtle hover:border-emerald-primary/40 transition-all duration-[120ms] ease-out flex flex-col justify-between group active:scale-[0.99]"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-primary border border-emerald-500/20">
                <Laptop className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-emerald-primary transition-colors" />
            </div>
            <h2 className="text-base font-bold text-text-primary group-hover:text-emerald-primary transition-colors">
              Device Management
            </h2>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Inspect active login sessions across mobile, tablet, and desktop devices. Remotely revoke unrecognized sessions.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-emerald-primary font-semibold">
            <span>Manage Sessions</span>
            <span>&rarr;</span>
          </div>
        </Link>

        {/* Profile Details Card */}
        <Link
          href="/profile"
          className="p-5 rounded-2xl bg-bg-surface border border-border-subtle hover:border-emerald-primary/40 transition-all duration-[120ms] ease-out flex flex-col justify-between group active:scale-[0.99]"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/20">
                <User className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-purple-300 transition-colors" />
            </div>
            <h2 className="text-base font-bold text-text-primary group-hover:text-purple-300 transition-colors">
              Player Profile
            </h2>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Update your in-game identity, playstyle specs, avatar preset, and competitive esports bio.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-purple-300 font-semibold">
            <span>Edit Profile</span>
            <span>&rarr;</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
