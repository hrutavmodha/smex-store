'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Swords, ArrowLeft, Users, Calendar, IndianRupee } from 'lucide-react';
import { BracketVisualizer, type MatchNodeData } from '../../../components/tournaments/BracketVisualizer';
import { TournamentLobbyRoom, type ParticipantItem } from '../../../components/tournaments/TournamentLobbyRoom';
import { fetchWithAuth, getStoredToken } from '../../../lib/api';

export interface TournamentDetailData {
  id: string;
  title: string;
  gameSlug: string;
  format: 'single_elimination' | 'double_elimination' | 'round_robin';
  status: 'upcoming' | 'registration_open' | 'ongoing' | 'completed';
  startTime: string;
  endTime?: string | null;
  prizePoolInr: string;
  maxTeams: number;
  matches?: MatchNodeData[];
  participants?: ParticipantItem[];
}

export default function TournamentDetailPage() {
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
      const token = getStoredToken();
      if (!token) {
        if (isMounted) setIsAdmin(false);
        return;
      }
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetchWithAuth(`${apiUrl}/api/v1/auth/me`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setIsAdmin(data.role === 'admin');
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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/api/v1/tournaments/${id}`)
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
      <div className="flex min-h-screen items-center justify-center bg-[#000000] text-[#E9F5F1]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1FAE7A] border-t-transparent" />
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#000000] text-[#E9F5F1] p-4">
        <h2 className="text-xl font-bold text-red-400">Error Loading Tournament</h2>
        <p className="mt-2 text-sm text-[#8FA39C]">{error || 'Tournament not found'}</p>
        <Link
          href="/tournaments"
          className="mt-6 flex items-center gap-2 rounded bg-[#121C19] px-4 py-2 text-xs font-bold text-[#1FAE7A] hover:bg-[#16211D]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tournaments
        </Link>
      </div>
    );
  }

  const isOngoing = tournament.status === 'ongoing';

  return (
    <div className="min-h-screen bg-[#000000] text-[#E9F5F1] py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Back Link */}
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8FA39C] hover:text-[#1FAE7A] mb-6 transition-colors duration-[120ms]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tournaments
        </Link>

        {/* Tournament Hero Card */}
        <div className="rounded-2xl border border-[#1A2A25] bg-[#0B0F12] p-6 sm:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded bg-[#121C19] px-2.5 py-0.5 text-xs font-mono font-bold uppercase text-[#1FAE7A] border border-[#1A2A25]">
                  {tournament.gameSlug.toUpperCase()}
                </span>
                <span className="rounded bg-[#16211D] px-2.5 py-0.5 text-xs font-medium text-[#8FA39C]">
                  {tournament.format.replace(/_/g, ' ')}
                </span>
                {isOngoing && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[#1FAE7A]/40 bg-[#121C19] px-2.5 py-0.5 text-xs font-bold text-[#1FAE7A]">
                    <span className="h-2 w-2 rounded-full bg-[#1FAE7A] animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-[#E9F5F1]">
                {tournament.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-6 text-xs text-[#8FA39C]">
                <div className="flex items-center gap-1.5">
                  <IndianRupee className="h-4 w-4 text-[#1FAE7A]" />
                  <span className="font-mono text-sm font-bold text-[#1FAE7A]">
                    ₹{Number(tournament.prizePoolInr).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[#1B8F97]" />
                  <span>
                    {tournament.participants?.length ?? 0} / {tournament.maxTeams} Teams
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[#8FA39C]" />
                  <span>{new Date(tournament.startTime).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex rounded-lg border border-[#1A2A25] bg-[#070A0C] p-1 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('bracket')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase transition-all duration-[120ms] ${
                  activeTab === 'bracket'
                    ? 'bg-[#1FAE7A] text-[#000000]'
                    : 'text-[#8FA39C] hover:text-[#E9F5F1]'
                }`}
              >
                <Trophy className="h-4 w-4" />
                Bracket
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lobby')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase transition-all duration-[120ms] ${
                  activeTab === 'lobby'
                    ? 'bg-[#1FAE7A] text-[#000000]'
                    : 'text-[#8FA39C] hover:text-[#E9F5F1]'
                }`}
              >
                <Swords className="h-4 w-4" />
                Live Lobby
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Tab Views */}
        <div className="rounded-2xl border border-[#1A2A25] bg-[#0B0F12] overflow-hidden">
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
