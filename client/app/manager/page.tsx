'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Zap,
  AlertTriangle,
  Activity,
  CheckCircle,
  ExternalLink,
  Shield,
  Clock,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { fetchWithAuth } from '../../lib/api';

interface TournamentItem {
  id: string;
  title: string;
  status: string;
  format: string;
  entryFee: number;
}

export default function ManagerDashboardPage() {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetchWithAuth('/api/v1/tournaments?limit=10');
        if (res.ok) {
          const data = await res.json();
          setTournaments(data.tournaments || []);
        }
      } catch {
        // Fallback gracefully
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const liveTournaments = tournaments.filter(
    (t) => t.status === 'in_progress' || t.status === 'live'
  );
  const upcomingTournaments = tournaments.filter(
    (t) => t.status === 'registration_open' || t.status === 'upcoming'
  );

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/20 text-purple-400">
              <Shield className="h-4 w-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
              Manager Operations Center
            </h1>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Manage live tournament match incidents, review player disputes, and monitor incoming boosting orders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-xs font-semibold text-purple-300 transition-all duration-[120ms] ease-out active:scale-[0.98] min-h-[38px]"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>View All Tournaments</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Live Tournaments */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-text-secondary uppercase">Live Tournaments</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-primary border border-emerald-500/20">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-text-primary">
              {loading ? '—' : liveTournaments.length}
            </div>
            <span className="text-[11px] text-text-muted">Active brackets in play</span>
          </div>
        </div>

        {/* Upcoming Tournaments */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-text-secondary uppercase">Open Tournaments</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-text-primary">
              {loading ? '—' : upcomingTournaments.length}
            </div>
            <span className="text-[11px] text-text-muted">Registration or check-in phase</span>
          </div>
        </div>

        {/* Incident Authority */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-text-secondary uppercase">Match Incidents</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-primary flex items-center gap-1.5">
              <span>Operational</span>
            </div>
            <span className="text-[11px] text-text-muted">Live match dispute authority active</span>
          </div>
        </div>

        {/* Boosting Feed */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-text-secondary uppercase">Boosting Alerts</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-text-primary flex items-center gap-1.5">
              <span>Subscribed</span>
            </div>
            <span className="text-[11px] text-text-muted">Real-time WebSocket alerts routed to you</span>
          </div>
        </div>
      </div>

      {/* Main Operations Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tournaments Under Supervision */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface-elevated">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-purple-400" />
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  Tournaments Under Supervision
                </h2>
              </div>
              <span className="text-xs font-mono text-text-muted">
                {tournaments.length} Tournaments Total
              </span>
            </div>

            <div className="divide-y divide-border-subtle">
              {loading ? (
                <div className="p-8 text-center text-xs font-mono text-text-muted">
                  Loading operational tournament registry...
                </div>
              ) : tournaments.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-text-muted">
                  No active tournaments requiring supervision at this time.
                </div>
              ) : (
                tournaments.slice(0, 6).map((tourney) => (
                  <div
                    key={tourney.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-bg-surface-elevated transition-colors duration-[120ms]"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-text-primary">
                        {tourney.title}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-bg-surface-elevated border border-border-subtle text-text-secondary">
                          {tourney.format || 'Standard'}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted">
                          Fee: ₹{tourney.entryFee}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          tourney.status === 'in_progress' || tourney.status === 'live'
                            ? 'bg-emerald-500/10 text-emerald-primary border border-emerald-500/30'
                            : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {tourney.status}
                      </span>

                      <Link
                        href={`/tournaments/${tourney.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-surface-elevated hover:bg-purple-500/10 border border-border-subtle hover:border-purple-500/30 text-xs font-semibold text-text-primary hover:text-purple-300 transition-colors duration-[120ms]"
                      >
                        <span>Manage Matches</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Standing Manager Guidelines & Quick Actions */}
        <div className="space-y-4">
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
              <Shield className="h-4 w-4 text-purple-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Manager Privileges & Authority
              </h3>
            </div>

            <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
              <div className="p-3 rounded-lg bg-bg-surface-elevated border border-border-subtle">
                <span className="font-bold text-text-primary block mb-1">
                  1. Live Match Incident Adjudication
                </span>
                You hold operational permissions to flag incidents, inspect dispute logs, and review team rosters during active matches.
              </div>

              <div className="p-3 rounded-lg bg-bg-surface-elevated border border-border-subtle">
                <span className="font-bold text-text-primary block mb-1">
                  2. Dedicated Boosting Order Routing
                </span>
                New customer orders trigger high-priority alerts routed directly to all standing managers for fulfillment and booster assignment.
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/boosting"
                className="flex items-center justify-between w-full p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-xs font-bold text-purple-300 transition-all duration-[120ms] ease-out active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-400" />
                  <span>Open Boosting Operations</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
