'use client';

import React, { useState } from 'react';
import { Trophy, Users, ShieldAlert, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';
import { type MatchNodeData, type ParticipantItem } from '@smex/shared';
import { fetchWithAuth } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { IncidentReportModal } from './IncidentReportModal';

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
  const { isManager, isStaff: authStaff } = useAuth();
  const canModerate = isAdmin || authStaff;
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState<boolean>(false);
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
        const res = await fetchWithAuth(
          `/api/v1/tournaments/${tournamentId}/matches/${activeMatch.id}`,
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
      className="grid w-full grid-cols-1 gap-6 bg-bg-canvas p-6 text-text-primary lg:grid-cols-3"
    >
      {/* Registered Squads Roster */}
      <div className="flex flex-col rounded-xl border border-border-subtle bg-bg-surface p-5">
        <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              Registered Squads
            </h3>
          </div>
          <span className="rounded-full bg-bg-surface-elevated px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-primary">
            {participants.length} Teams
          </span>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-[420px]">
          {participants.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-secondary">No squads registered yet</p>
          ) : (
            participants.map((p) => (
              <div
                key={p.id}
                aria-label={`Squad ${p.teamName || p.teamId}`}
                className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface-elevated px-3 py-2 transition-all duration-[120ms] hover:border-emerald-primary"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-bg-canvas text-[10px] font-mono font-bold text-emerald-primary">
                    #{p.seed ?? '?'}
                  </span>
                  <span className="truncate text-xs font-medium text-text-primary">
                    {p.teamName || `Squad ${p.teamId.slice(0, 6)}`}
                  </span>
                </div>
                {p.teamTag && (
                  <span className="rounded bg-bg-canvas px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
                    [{p.teamTag}]
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Match Schedule List */}
      <div className="flex flex-col rounded-xl border border-border-subtle bg-bg-surface p-5 lg:col-span-1">
        <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-cyan-depth" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              Match Queue
            </h3>
          </div>
          <span className="text-xs text-text-secondary">{matches.length} Matches</span>
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
                    ? 'border-emerald-primary bg-bg-surface-elevated'
                    : 'border-border-subtle bg-bg-canvas hover:border-emerald-primary'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
                  <span>Round {m.roundNumber} - Match #{m.matchOrder}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${
                      m.status === 'live'
                        ? 'bg-emerald-primary/20 text-emerald-primary'
                        : m.status === 'completed'
                        ? 'text-text-muted'
                        : 'text-cyan-depth'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-text-primary">
                    {m.teamAName || (m.teamAId ? `Team ${m.teamAId.slice(0, 6)}` : 'TBD')}
                  </span>
                  <span className="font-mono font-bold text-emerald-primary">{m.teamAScore}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-text-primary">
                    {m.teamBName || (m.teamBId ? `Team ${m.teamBId.slice(0, 6)}` : 'TBD')}
                  </span>
                  <span className="font-mono font-bold text-emerald-primary">{m.teamBScore}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Match Control & Admin Console */}
      <div className="flex flex-col rounded-xl border border-border-subtle bg-bg-surface p-5">
        <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-emerald-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              Match Desk
            </h3>
          </div>
          {isAdmin ? (
            <span className="rounded bg-emerald-primary px-2 py-0.5 text-[10px] font-bold uppercase text-[#0B1A15]">
              Admin
            </span>
          ) : isManager ? (
            <span className="rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 text-[10px] font-bold uppercase flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Manager
            </span>
          ) : null}
        </div>

        {activeMatch ? (
          <div className="flex flex-col gap-5">
            {/* Live Match Card */}
            <div className="rounded-lg border border-border-subtle bg-bg-canvas p-4">
              <div className="text-center text-xs text-text-secondary mb-3">
                Round {activeMatch.roundNumber} &bull; Match #{activeMatch.matchOrder}
              </div>

              {/* Score Display / Counters */}
              <div className="grid grid-cols-2 gap-4">
                {/* Team A Desk */}
                <div className="flex flex-col items-center rounded-lg border border-border-subtle bg-bg-surface-elevated p-3">
                  <span className="truncate text-xs font-bold text-text-primary mb-2">
                    {activeMatch.teamAName || (activeMatch.teamAId ? `Team A` : 'TBD')}
                  </span>

                  {isAdmin ? (
                    <div className="flex items-center gap-2 my-2">
                      <button
                        type="button"
                        aria-label="Decrease Team A Score"
                        onClick={() => setTeamAScore((prev) => Math.max(0, prev - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded bg-bg-canvas text-lg font-bold text-text-primary hover:bg-bg-surface"
                      >
                        -
                      </button>
                      <span aria-label={`Team A Score: ${teamAScore}`} className="font-mono text-2xl font-black text-emerald-primary">
                        {teamAScore}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase Team A Score"
                        onClick={() => setTeamAScore((prev) => prev + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded bg-bg-canvas text-lg font-bold text-text-primary hover:bg-bg-surface"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-3xl font-black text-emerald-primary my-2">
                      {activeMatch.teamAScore}
                    </span>
                  )}

                  {isAdmin && activeMatch.teamAId && (
                    <button
                      type="button"
                      aria-label="Confirm Team A Winner"
                      disabled={isSubmitting}
                      onClick={() => handleConfirmWinner(activeMatch.teamAId!)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-primary px-3 py-1.5 text-xs font-bold text-[#0B1A15] transition-all duration-[120ms] hover:bg-[#22C58F] active:scale-[0.98] disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm Winner
                    </button>
                  )}
                </div>

                {/* Team B Desk */}
                <div className="flex flex-col items-center rounded-lg border border-border-subtle bg-bg-surface-elevated p-3">
                  <span className="truncate text-xs font-bold text-text-primary mb-2">
                    {activeMatch.teamBName || (activeMatch.teamBId ? `Team B` : 'TBD')}
                  </span>

                  {isAdmin ? (
                    <div className="flex items-center gap-2 my-2">
                      <button
                        type="button"
                        aria-label="Decrease Team B Score"
                        onClick={() => setTeamBScore((prev) => Math.max(0, prev - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded bg-bg-canvas text-lg font-bold text-text-primary hover:bg-bg-surface"
                      >
                        -
                      </button>
                      <span aria-label={`Team B Score: ${teamBScore}`} className="font-mono text-2xl font-black text-emerald-primary">
                        {teamBScore}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase Team B Score"
                        onClick={() => setTeamBScore((prev) => prev + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded bg-bg-canvas text-lg font-bold text-text-primary hover:bg-bg-surface"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-3xl font-black text-emerald-primary my-2">
                      {activeMatch.teamBScore}
                    </span>
                  )}

                  {isAdmin && activeMatch.teamBId && (
                    <button
                      type="button"
                      aria-label="Confirm Team B Winner"
                      disabled={isSubmitting}
                      onClick={() => handleConfirmWinner(activeMatch.teamBId!)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-primary px-3 py-1.5 text-xs font-bold text-[#0B1A15] transition-all duration-[120ms] hover:bg-[#22C58F] active:scale-[0.98] disabled:opacity-50"
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
                  className="mt-3 rounded border border-emerald-primary/30 bg-bg-surface-elevated p-2 text-center text-xs font-medium text-emerald-primary"
                >
                  {feedbackMessage}
                </div>
              )}

              {canModerate && (
                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary">Referee & Moderation</span>
                  <button
                    type="button"
                    onClick={() => setIsIncidentModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all duration-[120ms] min-h-[32px]"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Flag Incident</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-text-secondary">Select a match from queue</p>
        )}
      </div>

      {canModerate && activeMatch && (
        <IncidentReportModal
          isOpen={isIncidentModalOpen}
          onClose={() => setIsIncidentModalOpen(false)}
          matchId={activeMatch.id}
          tournamentId={tournamentId}
          teams={[
            ...(activeMatch.teamAId ? [{ id: activeMatch.teamAId, name: activeMatch.teamAName || 'Team A' }] : []),
            ...(activeMatch.teamBId ? [{ id: activeMatch.teamBId, name: activeMatch.teamBName || 'Team B' }] : []),
          ]}
          onIncidentReported={() => {
            setFeedbackMessage('Match incident successfully reported.');
          }}
        />
      )}
    </section>
  );
}
export default TournamentLobbyRoom;
