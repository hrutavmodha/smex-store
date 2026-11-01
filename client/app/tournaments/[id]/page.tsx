'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Swords, ArrowLeft, Users, Calendar } from 'lucide-react';
import { type MatchNodeData, type ParticipantItem } from '@smex/shared';
import { BracketVisualizer } from '../../../components/tournaments/BracketVisualizer';
import { TournamentLobbyRoom } from '../../../components/tournaments/TournamentLobbyRoom';
import { fetchWithAuth } from '../../../lib/api';

export interface TournamentDetailData {
  id: string;
  title: string;
  gameSlug: string;
  format: 'single_elimination' | 'double_elimination' | 'round_robin';
  status: 'upcoming' | 'registration_open' | 'ongoing' | 'completed';
  startTime: string;
  endTime?: string | null;
  maxTeams: number;
  matches?: MatchNodeData[];
  participants?: ParticipantItem[];
}

function TournamentDetailContent() {
  const params = useParams();
  const id = params?.id as string;

  const [tournament, setTournament] = useState<TournamentDetailData | null>(null);
  const [activeTab, setActiveTab] = useState<'bracket' | 'lobby'>('bracket');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const checkRole = async () => {
      try {
        const res = await fetchWithAuth('/api/v1/auth/me');
        if (res.ok && isMounted) {
          const data = await res.json();
          setIsAdmin(data.role === 'admin');
        } else if (isMounted) {
          setIsAdmin(false);
        }
      } catch {
        if (isMounted) setIsAdmin(false);
      }
    };
    void checkRole();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    fetch(`/api/v1/tournaments/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Tournament not found');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setTournament(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-canvas text-text-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg-canvas text-text-primary p-4">
        <h2 className="text-xl font-bold text-red-400">Error Loading Tournament</h2>
        <p className="mt-2 text-sm text-text-secondary">{error || 'Tournament not found'}</p>
        <Link
          href="/tournaments"
          className="mt-6 flex items-center gap-2 rounded bg-bg-surface-elevated px-4 py-2 text-xs font-bold text-emerald-primary hover:bg-bg-surface"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tournaments
        </Link>
      </div>
    );
  }

  const isOngoing = tournament.status === 'ongoing';

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Back Link */}
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-emerald-primary mb-6 transition-colors duration-[120ms]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tournaments
        </Link>

        {/* Tournament Hero Card */}
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded bg-bg-surface-elevated px-2.5 py-0.5 text-xs font-mono font-bold uppercase text-emerald-primary border border-border-subtle">
                  {tournament.gameSlug.toUpperCase()}
                </span>
                <span className="rounded bg-bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                  {tournament.format.replace(/_/g, ' ')}
                </span>
                {isOngoing && (
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-primary/40 bg-bg-surface-elevated px-2.5 py-0.5 text-xs font-bold text-emerald-primary">
                    <span className="h-2 w-2 rounded-full bg-emerald-primary animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-text-primary">
                {tournament.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-6 text-xs text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-cyan-depth" />
                  <span>
                    {tournament.participants?.length ?? 0} / {tournament.maxTeams} Teams
                  </span>
                </div>
                {tournament.status !== 'completed' && tournament.startTime && tournament.endTime ? (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-text-muted" />
                    <span>
                      {new Date(tournament.startTime).toLocaleString()} - {new Date(tournament.endTime).toLocaleString()}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex w-full sm:w-auto rounded-lg border border-border-subtle bg-bg-surface-elevated p-1 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('bracket')}
                className={`flex-1 sm:flex-initial justify-center flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase transition-all duration-[120ms] ${
                  activeTab === 'bracket'
                    ? 'bg-emerald-primary text-[#0B1A15]'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Trophy className="h-4 w-4" />
                Bracket
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lobby')}
                className={`flex-1 sm:flex-initial justify-center flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase transition-all duration-[120ms] ${
                  activeTab === 'lobby'
                    ? 'bg-emerald-primary text-[#0B1A15]'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Swords className="h-4 w-4" />
                Live Lobby
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Tab Views */}
        <div className="rounded-2xl border border-border-subtle bg-bg-surface overflow-hidden">
          {activeTab === 'bracket' ? (
            <BracketVisualizer
              tournamentId={id}
              initialMatches={tournament.matches || []}
            />
          ) : (
            <TournamentLobbyRoom
              tournamentId={id}
              matches={tournament.matches || []}
              participants={tournament.participants || []}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function TournamentDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-canvas p-6 text-sm text-text-secondary flex items-center justify-center">
          Loading tournament...
        </div>
      }
    >
      <TournamentDetailContent />
    </Suspense>
  );
}

