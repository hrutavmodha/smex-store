'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ShieldAlert, Crown } from 'lucide-react';

import {
  type MatchNodeData,
  type BracketUpdatePayload,
  type TournamentFormat,
} from '@smex/shared';

export interface BracketVisualizerProps {
  tournamentId: string;
  initialMatches: MatchNodeData[];
  format?: TournamentFormat;
  onMatchSelect?: (match: MatchNodeData) => void;
}

export function BracketVisualizer({
  tournamentId,
  initialMatches = [],
  format,
  onMatchSelect,
}: BracketVisualizerProps) {
  const [matches, setMatches] = useState<MatchNodeData[]>(initialMatches);
  const [prevInitial, setPrevInitial] = useState<MatchNodeData[]>(initialMatches);

  if (initialMatches !== prevInitial) {
    setPrevInitial(initialMatches);
    setMatches(initialMatches);
  }

  // Detect format based on explicit prop or match bracketType presence
  const isDoubleElim =
    format === 'double_elimination' ||
    matches.some((m) => m.bracketType === 'lower' || m.bracketType === 'grand_final');

  const isRoundRobin = format === 'round_robin';

  const [activeTier, setActiveTier] = useState<'all' | 'upper' | 'lower' | 'grand_final'>('all');

  // Real-time synchronization via centralized WebSocket gateway (Production Pure)
  useEffect(() => {
    function handleBracketUpdate(payload: BracketUpdatePayload) {
      if (!payload || !payload.matchId) return;

      setMatches((prevMatches) =>
        prevMatches.map((m) => {
          if (m.id === payload.matchId) {
            return {
              ...m,
              teamAScore: payload.teamAScore ?? m.teamAScore,
              teamBScore: payload.teamBScore ?? m.teamBScore,
              winnerId: payload.winnerId ?? m.winnerId,
              status: payload.status ?? m.status,
            };
          }
          if (payload.nextMatchId && m.id === payload.nextMatchId) {
            const isTeamA = ((payload.matchOrder ?? 1) % 2 === 1);
            return {
              ...m,
              teamAId: isTeamA ? (payload.winnerId ?? null) : m.teamAId,
              teamBId: !isTeamA ? (payload.winnerId ?? null) : m.teamBId,
            };
          }
          return m;
        })
      );
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(`${wsUrl}/ws`);
      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            action: 'subscribe',
            channel: `tournament:${tournamentId}`,
          })
        );
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'bracket:update' && data.payload) {
            handleBracketUpdate(data.payload);
          }
        } catch {
          // Non-fatal payload parse
        }
      };
    } catch {
      // Offline fallback
    }

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [tournamentId]);

  function getRoundTitle(round: number, totalRounds: number, tier?: string): string {
    if (isRoundRobin) {
      return `Round ${round}`;
    }
    if (tier === 'grand_final') {
      return 'Championship Grand Final';
    }
    const prefix = tier === 'lower' ? 'Lower ' : tier === 'upper' ? 'Upper ' : '';
    if (round === totalRounds) {
      return tier ? `${prefix}Final` : 'Championship Final';
    }
    if (round === totalRounds - 1 && totalRounds > 2) {
      return `${prefix}Semifinals`;
    }
    if (round === totalRounds - 2 && totalRounds > 3) {
      return `${prefix}Quarterfinals`;
    }
    return `${prefix}Round ${round}`;
  }

  // Helper to render a bracket tier (single elimination or a double elimination sub-tier)
  function renderTierBracket(tierMatches: MatchNodeData[], tierName: string, tierKey?: string) {
    const roundMap = new Map<number, MatchNodeData[]>();
    tierMatches.forEach((m) => {
      const list = roundMap.get(m.roundNumber) || [];
      list.push(m);
      roundMap.set(m.roundNumber, list);
    });

    const sortedRounds = Array.from(roundMap.keys()).sort((a, b) => a - b);
    const totalRounds = sortedRounds.length;

    if (sortedRounds.length === 0) {
      return (
        <div className="py-6 text-center text-xs text-[#8FA39C]">
          No matches scheduled in {tierName}
        </div>
      );
    }

    return (
      <div className="flex min-w-[700px] items-stretch pb-4 overflow-x-auto">
        {sortedRounds.map((round, rIdx) => {
          const roundMatches = (roundMap.get(round) || []).sort(
            (a, b) => a.matchOrder - b.matchOrder
          );
          const roundTitle = getRoundTitle(round, totalRounds, tierKey);
          const nextRound = sortedRounds[rIdx + 1];
          const nextRoundMatches = nextRound
            ? (roundMap.get(nextRound) || []).sort((a, b) => a.matchOrder - b.matchOrder)
            : null;

          return (
            <React.Fragment key={`round-group-${tierKey || 'main'}-${round}`}>
              {/* Round Column */}
              <div
                aria-label={roundTitle}
                className="flex flex-1 flex-col justify-around gap-6 min-w-[200px]"
              >
                {/* Round Header */}
                <div className="border-b border-[#1A2A25] pb-2 text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8FA39C]">
                    {roundTitle}
                  </span>
                  <span className="ml-2 text-[10px] text-[#1FAE7A]">
                    ({roundMatches.length} Matches)
                  </span>
                </div>

                {/* Match Cards */}
                <div className="flex flex-1 flex-col justify-around gap-6 py-2">
                  {roundMatches.map((match) => {
                    const isTeamAWinner =
                      match.winnerId && match.teamAId && match.winnerId === match.teamAId;
                    const isTeamBWinner =
                      match.winnerId && match.teamBId && match.winnerId === match.teamBId;
                    const teamAName =
                      match.teamAName || (match.teamAId ? `Team ${match.teamAId.slice(0, 6)}` : 'TBD');
                    const teamBName =
                      match.status === 'bye' && !match.teamBId
                        ? 'BYE'
                        : match.teamBName ||
                          (match.teamBId ? `Team ${match.teamBId.slice(0, 6)}` : 'TBD');

                    return (
                      <article
                        key={match.id}
                        aria-label={`Match ${match.matchOrder} ${roundTitle}`}
                        onClick={() => onMatchSelect?.(match)}
                        className={`group relative flex flex-col overflow-hidden rounded-lg border bg-[#0B0F12] transition-all duration-[120ms] ease-out ${
                          match.status === 'live'
                            ? 'border-[#1FAE7A] shadow-[0_0_12px_rgba(31,174,122,0.2)]'
                            : 'border-[#1A2A25] hover:border-[#22C58F]'
                        }`}
                      >
                        {/* Match Status Tag */}
                        <div className="flex items-center justify-between border-b border-[#1A2A25] bg-[#070A0C] px-3 py-1 text-[10px] font-semibold text-[#8FA39C]">
                          <span>Match #{match.matchOrder}</span>
                          {match.status === 'live' && (
                            <span className="flex items-center gap-1 font-bold text-[#1FAE7A]">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1FAE7A]" />
                              LIVE
                            </span>
                          )}
                          {match.status === 'bye' && (
                            <span className="font-semibold text-[#1B8F97]">BYE ADVANCE</span>
                          )}
                          {match.status === 'completed' && (
                            <span className="text-[#8FA39C]">FINAL</span>
                          )}
                        </div>

                        {/* Team A Row */}
                        <div
                          aria-label={`${teamAName} Score: ${match.teamAScore}`}
                          className={`flex items-center justify-between px-3 py-2 transition-all duration-[120ms] ${
                            isTeamAWinner
                              ? 'bg-[#121C19] text-[#1FAE7A] font-bold border-l-4 border-l-[#1FAE7A]'
                              : 'text-[#E9F5F1]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isTeamAWinner && <Trophy className="h-3.5 w-3.5 shrink-0 text-[#1FAE7A]" />}
                            <span className="truncate text-xs font-medium">{teamAName}</span>
                          </div>
                          <span
                            aria-label={`Score ${match.teamAScore}`}
                            className={`ml-2 rounded px-1.5 py-0.5 text-xs font-mono font-bold ${
                              isTeamAWinner
                                ? 'bg-[#1FAE7A] text-[#000000]'
                                : 'bg-[#16211D] text-[#E9F5F1]'
                            }`}
                          >
                            {match.teamAScore}
                          </span>
                        </div>

                        <div className="h-[1px] w-full bg-[#1A2A25]" />

                        {/* Team B Row */}
                        <div
                          aria-label={`${teamBName} Score: ${match.teamBScore}`}
                          className={`flex items-center justify-between px-3 py-2 transition-all duration-[120ms] ${
                            isTeamBWinner
                              ? 'bg-[#121C19] text-[#1FAE7A] font-bold border-l-4 border-l-[#1FAE7A]'
                              : 'text-[#E9F5F1]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isTeamBWinner && <Trophy className="h-3.5 w-3.5 shrink-0 text-[#1FAE7A]" />}
                            <span className="truncate text-xs font-medium">{teamBName}</span>
                          </div>
                          <span
                            aria-label={`Score ${match.teamBScore}`}
                            className={`ml-2 rounded px-1.5 py-0.5 text-xs font-mono font-bold ${
                              isTeamBWinner
                                ? 'bg-[#1FAE7A] text-[#000000]'
                                : 'bg-[#16211D] text-[#E9F5F1]'
                            }`}
                          >
                            {match.teamBScore}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic SVG Bezier Connectors between adjacent rounds (Elimination formats only) */}
              {!isRoundRobin && nextRoundMatches && nextRoundMatches.length > 0 && (
                <div
                  aria-hidden="true"
                  className="w-10 shrink-0 flex flex-col justify-around py-2 self-stretch"
                >
                  {nextRoundMatches.map((nextMatch) => {
                    const feeder1Order = nextMatch.matchOrder * 2 - 1;
                    const feeder2Order = nextMatch.matchOrder * 2;
                    const feeder1 = roundMatches.find((m) => m.matchOrder === feeder1Order);
                    const feeder2 = roundMatches.find((m) => m.matchOrder === feeder2Order);

                    const isFeeder1Winner =
                      Boolean(feeder1?.winnerId && feeder1.winnerId === nextMatch.teamAId);
                    const isFeeder2Winner =
                      Boolean(feeder2?.winnerId && feeder2.winnerId === nextMatch.teamBId);

                    return (
                      <div
                        key={`conn-${nextMatch.id}`}
                        className="flex-1 relative flex items-center justify-center min-h-[60px]"
                      >
                        <svg
                          className="w-full h-full overflow-visible"
                          viewBox="0 0 40 100"
                          preserveAspectRatio="none"
                        >
                          <path
                            d="M 0 25 C 20 25, 20 50, 40 50"
                            fill="none"
                            stroke={isFeeder1Winner ? '#1FAE7A' : '#1A2A25'}
                            strokeWidth="2"
                            className="transition-colors duration-[120ms]"
                          />
                          <path
                            d="M 0 75 C 20 75, 20 50, 40 50"
                            fill="none"
                            stroke={isFeeder2Winner ? '#1FAE7A' : '#1A2A25'}
                            strokeWidth="2"
                            className="transition-colors duration-[120ms]"
                          />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // Filter matches by tier when double elimination
  const upperMatches = matches.filter(
    (m) => !m.bracketType || m.bracketType === 'upper'
  );
  const lowerMatches = matches.filter((m) => m.bracketType === 'lower');
  const grandFinalMatches = matches.filter((m) => m.bracketType === 'grand_final');

  return (
    <section
      aria-label="Tournament Bracket"
      className="w-full overflow-x-auto bg-[#000000] p-6 text-[#E9F5F1] select-none"
    >
      {/* Double Elimination Tier Switcher */}
      {isDoubleElim && (
        <nav
          aria-label="Bracket Tier Tabs"
          className="mb-6 flex flex-wrap gap-1 rounded-lg border border-[#1A2A25] bg-[#070A0C] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTier === 'all'}
            onClick={() => setActiveTier('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase transition-all duration-[120ms] ${
              activeTier === 'all'
                ? 'bg-[#1FAE7A] text-[#000000]'
                : 'text-[#8FA39C] hover:text-[#E9F5F1]'
            }`}
          >
            All Brackets
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTier === 'upper'}
            onClick={() => setActiveTier('upper')}
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase transition-all duration-[120ms] ${
              activeTier === 'upper'
                ? 'bg-[#1FAE7A] text-[#000000]'
                : 'text-[#8FA39C] hover:text-[#E9F5F1]'
            }`}
          >
            Upper Bracket
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTier === 'lower'}
            onClick={() => setActiveTier('lower')}
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase transition-all duration-[120ms] ${
              activeTier === 'lower'
                ? 'bg-[#1FAE7A] text-[#000000]'
                : 'text-[#8FA39C] hover:text-[#E9F5F1]'
            }`}
          >
            Lower Bracket
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTier === 'grand_final'}
            onClick={() => setActiveTier('grand_final')}
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase transition-all duration-[120ms] ${
              activeTier === 'grand_final'
                ? 'bg-[#1FAE7A] text-[#000000]'
                : 'text-[#8FA39C] hover:text-[#E9F5F1]'
            }`}
          >
            Grand Finals
          </button>
        </nav>
      )}

      {/* Render Brackets */}
      {!isDoubleElim ? (
        renderTierBracket(matches, 'Main Bracket')
      ) : (
        <div className="flex flex-col gap-8">
          {(activeTier === 'all' || activeTier === 'upper') && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 border-b border-[#1A2A25] pb-2">
                <Trophy className="h-4 w-4 text-[#1FAE7A]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#1FAE7A]">
                  Upper Bracket (Championship Path)
                </h3>
              </div>
              {renderTierBracket(upperMatches, 'Upper Bracket', 'upper')}
            </div>
          )}

          {(activeTier === 'all' || activeTier === 'lower') && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 border-b border-[#1A2A25] pb-2">
                <ShieldAlert className="h-4 w-4 text-[#1B8F97]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#1B8F97]">
                  Lower Bracket (Elimination Path)
                </h3>
              </div>
              {renderTierBracket(lowerMatches, 'Lower Bracket', 'lower')}
            </div>
          )}

          {(activeTier === 'all' || activeTier === 'grand_final') && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 border-b border-[#1A2A25] pb-2">
                <Crown className="h-4 w-4 text-[#22C58F]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#22C58F]">
                  Grand Championship Final
                </h3>
              </div>
              {renderTierBracket(grandFinalMatches, 'Grand Finals', 'grand_final')}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
export default BracketVisualizer;
