export interface AdminRateUpdateRequest {
  priceInr?: number | string;
  isActive?: boolean;
  minStars?: number;
  maxStars?: number;
}

export type AnnouncementLevel = 'info' | 'warning' | 'alert';

export interface SystemAnnouncementPayload {
  message: string;
  level: AnnouncementLevel;
  isActive: boolean;
  actionUrl?: string;
  expiresAt?: string;
}

export interface AdminMetrics {
  activeUsers: number;
  activeListings: number;
  liveTournaments: number;
  databaseStatus: 'ok' | 'degraded' | 'down';
  dbLatencyMs?: number;
}

export interface ModerationListingItem {
  id: string;
  title: string;
  priceInr: string;
  sellerId: string;
  sellerUsername?: string;
  status: string;
  createdAt: string | Date;
  reportCount?: number;
  reports?: Array<{
    reason: string;
    reporterId: string;
    createdAt: string | Date;
  }>;
  proofs?: Array<{
    id: string;
    cdnUrl: string;
    s3Key: string;
  }>;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  isBanned: boolean;
  banReason?: string | null;
  bannedAt?: string | Date | null;
  username?: string | null;
  inGameId?: string | null;
  createdAt: string | Date;
}
