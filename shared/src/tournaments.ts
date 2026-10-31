export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';
export type TournamentStatus = 'upcoming' | 'registration_open' | 'ongoing' | 'completed';
export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'bye';

export interface TournamentCardData {
  id: string;
  title: string;
  gameSlug: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startTime: string;
  endTime?: string | null;
  prizePoolInr: string;
  maxTeams: number;
  registeredTeams?: number;
  winnerTeamId?: string | null;
  winnerName?: string | null;
  runnerUpName?: string | null;
  mvpName?: string | null;
  rulesMarkdown?: string | null;
}

export interface MatchNodeData {
  id: string;
  roundNumber: number;
  matchOrder: number;
  bracketType?: 'upper' | 'lower' | 'grand_final' | string;
  teamAId: string | null;
  teamBId: string | null;
  teamAName?: string | null;
  teamBName?: string | null;
  teamAScore: number;
  teamBScore: number;
  winnerId: string | null;
  status: MatchStatus;
}

export interface BracketUpdatePayload {
  matchId: string;
  roundNumber?: number;
  matchOrder?: number;
  teamAScore?: number;
  teamBScore?: number;
  winnerId?: string | null;
  status?: MatchStatus;
  nextMatchId?: string | null;
}

export interface ParticipantItem {
  id: string;
  teamId: string;
  teamName?: string;
  teamTag?: string;
  seed?: number;
}
