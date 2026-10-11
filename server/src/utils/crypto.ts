import argon2 from 'argon2';
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export interface PasswordHasher {
  hashPassword: (plainText: string) => Promise<string>;
  verifyPassword: (hash: string, plainText: string) => Promise<boolean>;
}

export const ARGON2_CONFIG: argon2.HashOptions & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  raw: false,
};

export async function hashPassword(plainText: string): Promise<string> {
  passwordSchema.parse(plainText);
  return argon2.hash(plainText, ARGON2_CONFIG);
}

export async function verifyPassword(hash: string, plainText: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch {
    return false;
  }
}
