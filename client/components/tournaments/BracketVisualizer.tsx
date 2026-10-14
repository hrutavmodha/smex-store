'use client';

import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';

export interface MatchNodeData {
  id: string;
  roundNumber: number;
  matchOrder: number;
  bracketType?: string;
  teamAId: string | null;
  teamBId: string | null;
  teamAName?: string | null;
  teamBName?: string | null;
  teamAScore: number;
  teamBScore: number;
  winnerId: string | null;
  status: 'scheduled' | 'live' | 'completed' | 'bye';
}

export interface BracketUpdatePayload {
  matchId: string;
  roundNumber?: number;
  matchOrder?: number;
  teamAScore?: number;
  teamBScore?: number;
  winnerId?: string | null;
  status?: 'scheduled' | 'live' | 'completed' | 'bye';
  nextMatchId?: string | null;
}

export interface BracketVisualizerProps {
  tournamentId: string;
  initialMatches: MatchNodeData[];
  onMatchSelect?: (match: MatchNodeData) => void;
}

export function BracketVisualizer({
  tournamentId,
  initialMatches = [],
  onMatchSelect,
}: BracketVisualizerProps) {
  const [matches, setMatches] = useState<MatchNodeData[]>(initialMatches);
  const [prevInitial, setPrevInitial] = useState<MatchNodeData[]>(initialMatches);

  if (initialMatches !== prevInitial) {
    setPrevInitial(initialMatches);
    setMatches(initialMatches);
  }

  // Real-time synchronization via WebSocket & CustomEvent listener
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
            // Check if slot update applies
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

    // 1. Listen for DOM dispatched bracket:update events (used by testing & local dispatch)
    const domListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        handleBracketUpdate(customEvent.detail.payload || customEvent.detail);
      }
    };
    window.addEventListener('bracket:update', domListener);

    // 2. Connect to live WebSocket gateway
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
      window.removeEventListener('bracket:update', domListener);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [tournamentId]);

  // Group matches strictly by roundNumber ascending
  const roundMap = new Map<number, MatchNodeData[]>();
  matches.forEach((m) => {
    const list = roundMap.get(m.roundNumber) || [];
    list.push(m);
    roundMap.set(m.roundNumber, list);
  });

  const sortedRounds = Array.from(roundMap.keys()).sort((a, b) => a - b);
  const totalRounds = sortedRounds.length;

  function getRoundTitle(round: number): string {
    if (round === totalRounds) return 'Championship Final';
    if (round === totalRounds - 1 && totalRounds > 2) return 'Semifinals';
    if (round === totalRounds - 2 && totalRounds > 3) return 'Quarterfinals';
    return `Round ${round}`;
  }

  return (
    <section
      aria-label="Tournament Bracket"
      className="w-full overflow-x-auto bg-[#000000] p-6 text-[#E9F5F1] select-none"
    >
      <div className="flex min-w-[700px] items-stretch gap-8 pb-4">
        {sortedRounds.map((round) => {
          const roundMatches = (roundMap.get(round) || []).sort(
            (a, b) => a.matchOrder - b.matchOrder
          );
          const roundTitle = getRoundTitle(round);

          return (
            <div
              key={round}
              aria-label={roundTitle}
              className="flex flex-1 flex-col justify-around gap-6"
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

              {/* Match Nodes */}
              <div className="flex flex-1 flex-col justify-around gap-6 py-2">
                {roundMatches.map((match) => {
                  const isTeamAWinner = match.winnerId && match.teamAId && match.winnerId === match.teamAId;
                  const isTeamBWinner = match.winnerId && match.teamBId && match.winnerId === match.teamBId;
                  const teamAName = match.teamAName || (match.teamAId ? `Team ${match.teamAId.slice(0, 6)}` : 'TBD');
                  const teamBName = match.status === 'bye' && !match.teamBId
                    ? 'BYE'
                    : match.teamBName || (match.teamBId ? `Team ${match.teamBId.slice(0, 6)}` : 'TBD');

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
                          <span className="truncate text-xs font-medium">
                            {teamAName}
                          </span>
                        </div>
                        <span
                          aria-label={`Score ${match.teamAScore}`}
                          className={`ml-2 rounded px-1.5 py-0.5 text-xs font-mono font-bold ${
                            isTeamAWinner ? 'bg-[#1FAE7A] text-[#000000]' : 'bg-[#16211D] text-[#E9F5F1]'
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
                          <span className="truncate text-xs font-medium">
                            {teamBName}
                          </span>
                        </div>
                        <span
                          aria-label={`Score ${match.teamBScore}`}
                          className={`ml-2 rounded px-1.5 py-0.5 text-xs font-mono font-bold ${
                            isTeamBWinner ? 'bg-[#1FAE7A] text-[#000000]' : 'bg-[#16211D] text-[#E9F5F1]'
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
          );
        })}
      </div>
    </section>
  );
}
export default BracketVisualizer;
