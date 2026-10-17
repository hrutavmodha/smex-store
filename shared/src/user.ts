export type UserRole = 'user' | 'admin';
export type ThemePreference = 'dark' | 'amoled' | 'light';
export type DensityPreference = 'compact' | 'comfortable' | 'spacious';
export type PrivacyPreference = 'public' | 'friends' | 'private';

export interface UserProfile {
  uid: string;
  email: string;
  ign: string;
  avatarPreset?: string;
  emailVerified: boolean;
  role?: string;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sessionId: string;
  iat?: number;
  exp?: number;
}
