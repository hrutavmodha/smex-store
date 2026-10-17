export type TeamStatus = 'open' | 'closed';
export type TeamAvailability = 'open' | 'closed' | 'full';

export interface TeamCardData {
  id: string;
  name: string;
  tag: string;
  captainId: string;
  gameSlug: string;
  memberCap: number;
  status: TeamStatus;
  description?: string | null;
  activeMembersCount: number;
  openSlots: number;
  availability: TeamAvailability;
  captainUsername?: string | null;
  captainIgn?: string | null;
  captainAvatarPreset?: string | null;
  hasPendingRequest?: boolean;
}

export const STANDARDIZED_ROLES = ['Roam', 'Hyper', 'Exp', 'Gold', 'Mid'] as const;
export type StandardizedRole = (typeof STANDARDIZED_ROLES)[number];

export interface RosterMember {
  id: string;
  userId: string;
  memberRole: string;
  joinedAt: string | Date;
  username?: string | null;
  inGameId?: string | null;
  avatarPreset?: string | null;
  playstyle?: string | null;
}

export interface JoinRequestItem {
  id: string;
  teamId: string;
  userId: string;
  playerIgn: string;
  playerRole: string;
  message?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string | Date;
  username?: string | null;
  avatarPreset?: string | null;
}
