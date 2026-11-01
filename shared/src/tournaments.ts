export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';
export type TournamentStatus = 'upcoming' | 'registration_open' | 'ongoing' | 'completed';
export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'bye';

export interface TournamentCardData {
  id: string;
  title: string;
  gameSlug: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startTime?: string | null;
  endTime?: string | null;
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

export type IncidentType =
  | 'suspected_cheat'
  | 'unauthorized_substitute'
  | 'toxic_behavior'
  | 'connection_manipulation'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 'flagged' | 'under_review' | 'resolved' | 'dismissed';

export interface TournamentIncidentItem {
  id: string;
  tournamentId: string;
  matchId: string;
  reportedBy: string;
  reportedByIgn?: string | null;
  targetTeamId?: string | null;
  targetTeamName?: string | null;
  targetPlayerIgn?: string | null;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  description: string;
  evidenceUrl?: string | null;
  status: IncidentStatus;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentAlertFramePayload {
  incidentId: string;
  tournamentId: string;
  matchId: string;
  reportedByIgn: string;
  targetTeamName?: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  summary: string;
  timestamp: string;
}
