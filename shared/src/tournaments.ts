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
}
