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
