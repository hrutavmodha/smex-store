'use client';

import React, { useState } from 'react';
import { Trophy, Users, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { type MatchNodeData } from './BracketVisualizer';
import { fetchWithAuth } from '../../lib/api';

export interface ParticipantItem {
  id: string;
  teamId: string;
  teamName?: string;
  teamTag?: string;
  seed?: number;
}

export interface TournamentLobbyRoomProps {
  tournamentId: string;
  matches: MatchNodeData[];
  participants?: ParticipantItem[];
  isAdmin?: boolean;
  onScoreUpdate?: (
    matchId: string,
    teamAScore: number,
    teamBScore: number,
    winnerId: string
  ) => Promise<void>;
}

export function TournamentLobbyRoom({
  tournamentId,
  matches = [],
  participants = [],
  isAdmin = false,
  onScoreUpdate,
}: TournamentLobbyRoomProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    matches[0]?.id || ''
  );
  const [teamAScore, setTeamAScore] = useState<number>(
    matches[0]?.teamAScore ?? 0
  );
  const [teamBScore, setTeamBScore] = useState<number>(
    matches[0]?.teamBScore ?? 0
  );
  const [prevMatches, setPrevMatches] = useState<MatchNodeData[]>(matches);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

  if (matches !== prevMatches) {
    setPrevMatches(matches);
    const stillExists = matches.find((m) => m.id === selectedMatchId);
    if (stillExists) {
      // Keep existing selection and update active scores to match updated data
      setTeamAScore(stillExists.teamAScore);
      setTeamBScore(stillExists.teamBScore);
    } else if (matches[0]) {
      // Only fallback to first match if previous selection was deleted or didn't exist
      setSelectedMatchId(matches[0].id);
      setTeamAScore(matches[0].teamAScore);
      setTeamBScore(matches[0].teamBScore);
    }
  }

  const activeMatch = matches.find((m) => m.id === selectedMatchId) || matches[0];

  const handleSelectMatch = (match: MatchNodeData) => {
    setSelectedMatchId(match.id);
    setTeamAScore(match.teamAScore);
    setTeamBScore(match.teamBScore);
    setFeedbackMessage('');
  };

  const handleConfirmWinner = async (winnerId: string) => {
    if (!activeMatch) return;
    setIsSubmitting(true);
    setFeedbackMessage('');

    try {
      if (onScoreUpdate) {
        await onScoreUpdate(activeMatch.id, teamAScore, teamBScore, winnerId);
      } else {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetchWithAuth(
          `${apiUrl}/api/v1/tournaments/${tournamentId}/matches/${activeMatch.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              teamAScore,
              teamBScore,
              winnerId,
            }),
          }
        );

        if (!res.ok) {
          throw new Error('Failed to update match score');
        }
      }
      setFeedbackMessage('Match completed and winner confirmed!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error updating score';
      setFeedbackMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-label="Tournament Lobby Room"
      className="grid w-full grid-cols-1 gap-6 bg-[#000000] p-6 text-[#E9F5F1] lg:grid-cols-3"
    >
      {/* Registered Squads Roster */}
      <div className="flex flex-col rounded-xl border border-[#1A2A25] bg-[#0B0F12] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#1A2A25] pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#1FAE7A]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#E9F5F1]">
              Registered Squads
            </h3>
          </div>
          <span className="rounded-full bg-[#121C19] px-2.5 py-0.5 text-xs font-mono font-bold text-[#1FAE7A]">
            {participants.length} Teams
          </span>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-[420px]">
          {participants.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#8FA39C]">No squads registered yet</p>
          ) : (
            participants.map((p) => (
              <div
                key={p.id}
                aria-label={`Squad ${p.teamName || p.teamId}`}
                className="flex items-center justify-between rounded-lg border border-[#1A2A25] bg-[#121C19] px-3 py-2 transition-all duration-[120ms] hover:border-[#22C58F]"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-[#16211D] text-[10px] font-mono font-bold text-[#1FAE7A]">
                    #{p.seed ?? '?'}
                  </span>
                  <span className="truncate text-xs font-medium text-[#E9F5F1]">
                    {p.teamName || `Squad ${p.teamId.slice(0, 6)}`}
                  </span>
                </div>
                {p.teamTag && (
                  <span className="rounded bg-[#16211D] px-1.5 py-0.5 text-[10px] font-mono text-[#8FA39C]">
                    [{p.teamTag}]
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Match Schedule List */}
      <div className="flex flex-col rounded-xl border border-[#1A2A25] bg-[#0B0F12] p-5 lg:col-span-1">
        <div className="mb-4 flex items-center justify-between border-b border-[#1A2A25] pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#1B8F97]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#E9F5F1]">
              Match Queue
            </h3>
          </div>
          <span className="text-xs text-[#8FA39C]">{matches.length} Matches</span>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-[420px]">
          {matches.map((m) => {
            const isSelected = m.id === selectedMatchId;
            return (
              <button
                key={m.id}
                type="button"
                aria-label={`Select Match ${m.matchOrder} Round ${m.roundNumber}`}
                onClick={() => handleSelectMatch(m)}
                className={`flex flex-col rounded-lg border p-3 text-left transition-all duration-[120ms] ${
                  isSelected
                    ? 'border-[#1FAE7A] bg-[#121C19]'
                    : 'border-[#1A2A25] bg-[#070A0C] hover:border-[#22C58F]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#8FA39C]">
                  <span>Round {m.roundNumber} - Match #{m.matchOrder}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${
                      m.status === 'live'
                        ? 'bg-[#1FAE7A]/20 text-[#1FAE7A]'
                        : m.status === 'completed'
                        ? 'text-[#8FA39C]'
                        : 'text-[#1B8F97]'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-[#E9F5F1]">
                    {m.teamAName || (m.teamAId ? `Team ${m.teamAId.slice(0, 6)}` : 'TBD')}
                  </span>
                  <span className="font-mono font-bold text-[#1FAE7A]">{m.teamAScore}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-[#E9F5F1]">
                    {m.teamBName || (m.teamBId ? `Team ${m.teamBId.slice(0, 6)}` : 'TBD')}
                  </span>
                  <span className="font-mono font-bold text-[#1FAE7A]">{m.teamBScore}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Match Control & Admin Console */}
      <div className="flex flex-col rounded-xl border border-[#1A2A25] bg-[#0B0F12] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#1A2A25] pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#1FAE7A]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#E9F5F1]">
              Match Desk
            </h3>
          </div>
          {isAdmin && (
            <span className="rounded bg-[#1FAE7A] px-2 py-0.5 text-[10px] font-bold uppercase text-[#000000]">
              Admin
            </span>
          )}
        </div>

        {activeMatch ? (
          <div className="flex flex-col gap-5">
            {/* Live Match Card */}
            <div className="rounded-lg border border-[#1A2A25] bg-[#070A0C] p-4">
              <div className="text-center text-xs text-[#8FA39C] mb-3">
                Round {activeMatch.roundNumber} &bull; Match #{activeMatch.matchOrder}
              </div>

              {/* Score Display / Counters */}
              <div className="grid grid-cols-2 gap-4">
                {/* Team A Desk */}
                <div className="flex flex-col items-center rounded-lg border border-[#1A2A25] bg-[#121C19] p-3">
                  <span className="truncate text-xs font-bold text-[#E9F5F1] mb-2">
                    {activeMatch.teamAName || (activeMatch.teamAId ? `Team A` : 'TBD')}
                  </span>

                  {isAdmin ? (
                    <div className="flex items-center gap-2 my-2">
                      <button
                        type="button"
                        aria-label="Decrease Team A Score"
                        onClick={() => setTeamAScore((prev) => Math.max(0, prev - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded bg-[#16211D] text-lg font-bold text-[#E9F5F1] hover:bg-[#1A2A25]"
                      >
                        -
                      </button>
                      <span aria-label={`Team A Score: ${teamAScore}`} className="font-mono text-2xl font-black text-[#1FAE7A]">
                        {teamAScore}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase Team A Score"
                        onClick={() => setTeamAScore((prev) => prev + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded bg-[#16211D] text-lg font-bold text-[#E9F5F1] hover:bg-[#1A2A25]"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-3xl font-black text-[#1FAE7A] my-2">
                      {activeMatch.teamAScore}
                    </span>
                  )}

                  {isAdmin && activeMatch.teamAId && (
                    <button
                      type="button"
                      aria-label="Confirm Team A Winner"
                      disabled={isSubmitting}
                      onClick={() => handleConfirmWinner(activeMatch.teamAId!)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-[#1FAE7A] px-3 py-1.5 text-xs font-bold text-[#000000] transition-all duration-[120ms] hover:bg-[#22C58F] active:scale-[0.98] disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm Winner
                    </button>
                  )}
                </div>

                {/* Team B Desk */}
                <div className="flex flex-col items-center rounded-lg border border-[#1A2A25] bg-[#121C19] p-3">
                  <span className="truncate text-xs font-bold text-[#E9F5F1] mb-2">
                    {activeMatch.teamBName || (activeMatch.teamBId ? `Team B` : 'TBD')}
                  </span>

                  {isAdmin ? (
                    <div className="flex items-center gap-2 my-2">
                      <button
                        type="button"
                        aria-label="Decrease Team B Score"
                        onClick={() => setTeamBScore((prev) => Math.max(0, prev - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded bg-[#16211D] text-lg font-bold text-[#E9F5F1] hover:bg-[#1A2A25]"
                      >
                        -
                      </button>
                      <span aria-label={`Team B Score: ${teamBScore}`} className="font-mono text-2xl font-black text-[#1FAE7A]">
                        {teamBScore}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase Team B Score"
                        onClick={() => setTeamBScore((prev) => prev + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded bg-[#16211D] text-lg font-bold text-[#E9F5F1] hover:bg-[#1A2A25]"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-3xl font-black text-[#1FAE7A] my-2">
                      {activeMatch.teamBScore}
                    </span>
                  )}

                  {isAdmin && activeMatch.teamBId && (
                    <button
                      type="button"
                      aria-label="Confirm Team B Winner"
                      disabled={isSubmitting}
                      onClick={() => handleConfirmWinner(activeMatch.teamBId!)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-[#1FAE7A] px-3 py-1.5 text-xs font-bold text-[#000000] transition-all duration-[120ms] hover:bg-[#22C58F] active:scale-[0.98] disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm Winner
                    </button>
                  )}
                </div>
              </div>

              {feedbackMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 rounded border border-[#1FAE7A]/30 bg-[#121C19] p-2 text-center text-xs font-medium text-[#1FAE7A]"
                >
                  {feedbackMessage}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-[#8FA39C]">Select a match from queue</p>
        )}
      </div>
    </section>
  );
}
export default TournamentLobbyRoom;
