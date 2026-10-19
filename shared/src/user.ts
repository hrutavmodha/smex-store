export type UserRole = 'user' | 'admin';
export type ThemePreference = 'dark' | 'amoled' | 'light';
export type DensityPreference = 'compact' | 'comfortable' | 'spacious';
export type PrivacyPreference = 'public' | 'friends' | 'private';

export interface UserProfile {
  uid: string;
  inGameId?: string | null;
  email: string;
  ign: string;
  avatarPreset?: string;
  emailVerified: boolean;
  role?: string;
  isBanned?: boolean;
  banReason?: string | null;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sessionId: string;
  iat?: number;
  exp?: number;
  isBanned?: boolean;
}
