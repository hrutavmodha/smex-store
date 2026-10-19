'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Users, Calendar, IndianRupee, Swords } from 'lucide-react';

import type { TournamentCardData } from '@smex/shared';

function TournamentsDirectoryContent() {
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab') || 'upcoming';
  const [activeTab, setActiveTab] = useState<'upcoming' | 'ongoing' | 'past'>(
    tabParam === 'ongoing' || tabParam === 'past' ? tabParam : 'upcoming'
  );

  const [tournamentsList, setTournamentsList] = useState<TournamentCardData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleTabChange = (tab: 'upcoming' | 'ongoing' | 'past') => {
    setActiveTab(tab);
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.replaceState({}, '', url.toString());
      } catch {
        // Safe navigation fallback
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/api/v1/tournaments?status=${activeTab}`)
      .then((res) => (res.ok ? res.json() : { tournaments: [] }))
      .then((data) => {
        if (isMounted) {
          setTournamentsList(data.tournaments || []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setTournamentsList([]);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  function formatFormatBadge(format: string) {
    if (format === 'single_elimination') return 'Single Elimination';
    if (format === 'double_elimination') return 'Double Elimination';
    if (format === 'round_robin') return 'Round Robin';
    return format;
  }

  return (
    <main
      aria-label="Tournaments Directory"
      className="min-h-screen bg-bg-canvas text-text-primary py-10 px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header Hero */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Swords className="h-6 w-6 text-emerald-primary" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-primary">
                Competitive Esports
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-text-primary sm:text-4xl">
              Tournaments
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Compete in official community clash tournaments and climb the esports leaderboards.
            </p>
          </div>

          {/* Segmented Tabs */}
          <nav
            aria-label="Tournament Status Tabs"
            className="flex rounded-lg border border-border-subtle bg-bg-surface p-1 select-none"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'upcoming'}
              onClick={() => handleTabChange('upcoming')}
              className={`rounded-md px-4 py-2 text-xs font-bold uppercase transition-all duration-[120ms] ${
                activeTab === 'upcoming'
                  ? 'bg-emerald-primary text-[#0B1A15]'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ongoing'}
              onClick={() => handleTabChange('ongoing')}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-bold uppercase transition-all duration-[120ms] ${
                activeTab === 'ongoing'
                  ? 'bg-emerald-primary text-[#0B1A15]'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-primary" />
              Ongoing
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'past'}
              onClick={() => handleTabChange('past')}
              className={`rounded-md px-4 py-2 text-xs font-bold uppercase transition-all duration-[120ms] ${
                activeTab === 'past'
                  ? 'bg-emerald-primary text-[#0B1A15]'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Past
            </button>
          </nav>
        </div>

        {/* Tournament Card Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-64 rounded-xl border border-border-subtle bg-bg-surface p-6 animate-pulse"
              />
            ))}
          </div>
        ) : tournamentsList.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-bg-surface py-16 px-4 text-center"
          >
            <Trophy className="h-12 w-12 text-text-muted mb-3 opacity-60" />
            <h3 className="text-base font-bold text-text-primary">No Tournaments Found</h3>
            <p className="mt-1 text-xs text-text-secondary max-w-sm">
              There are currently no {activeTab} tournaments scheduled. Check back soon for announcements.
            </p>
          </div>
        ) : (
          <div
            role="region"
            aria-label="Tournament List"
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {tournamentsList.map((t) => {
              const isOngoing = t.status === 'ongoing';

              return (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="group relative flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-6 transition-all duration-[120ms] ease-out hover:border-emerald-primary hover:-translate-y-0.5"
                >
                  <div>
                    {/* Badges & Live Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-bg-surface-elevated px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-emerald-primary border border-border-subtle">
                          {t.gameSlug.toUpperCase()}
                        </span>
                        <span className="rounded bg-bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                          {formatFormatBadge(t.format)}
                        </span>
                      </div>

                      {isOngoing && (
                        <div
                          aria-label="Live Tournament Status"
                          className="flex items-center gap-1.5 rounded-full border border-emerald-primary/40 bg-bg-surface-elevated px-2.5 py-0.5 text-[10px] font-bold text-emerald-primary shadow-[0_0_8px_rgba(31,174,122,0.3)]"
                        >
                          <span className="h-2 w-2 rounded-full bg-emerald-primary animate-pulse" />
                          LIVE
                        </div>
                      )}
                    </div>

                    {/* Tournament Title */}
                    <h3 className="text-lg font-bold text-text-primary group-hover:text-emerald-primary transition-colors duration-[120ms]">
                      {t.title}
                    </h3>

                    {/* Prize Pool */}
                    <div className="mt-4 flex items-baseline gap-1 text-emerald-primary">
                      <IndianRupee className="h-4 w-4" />
                      <span className="text-xl font-mono font-black">
                        {Number(t.prizePoolInr).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] font-semibold text-text-muted ml-1">Prize Pool</span>
                    </div>
                  </div>

                  {/* Metadata Footer */}
                  <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-4 text-xs text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-cyan-depth" />
                      <span>
                        {t.registeredTeams ?? 0} / {t.maxTeams} Teams
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-text-muted" />
                      <span>{new Date(t.startTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function TournamentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-canvas" />}>
      <TournamentsDirectoryContent />
    </Suspense>
  );
}
