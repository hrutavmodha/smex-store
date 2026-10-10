import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import 'fastify';

// Load variables from .env file (current working directory or monorepo root)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5432/smex_store'),
  REDIS_URL: z
    .string()
    .url()
    .default('redis://localhost:6379'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .default('development_jwt_secret_key_needs_to_be_32_chars_minimum!'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long')
    .default('development_jwt_refresh_secret_key_needs_32_chars_min!'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().default('smex-storage'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      return (
        !data.JWT_SECRET.includes('development') &&
        !data.JWT_REFRESH_SECRET.includes('development')
      );
    }
    return true;
  },
  {
    message: 'Production deployments must supply secure, non-development JWT secrets',
    path: ['JWT_SECRET'],
  }
);

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function loadEnv(customEnv?: Record<string, unknown>): EnvConfig {
  const source = customEnv ?? process.env;
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const errorDetails = result.error.issues.map((err) => ({
      field: err.path.join('.'),
      issue: err.message,
    }));

    console.error('Fatal configuration error: Invalid environment variables:');
    console.table(errorDetails);
    throw new Error(`Environment validation failed: ${JSON.stringify(errorDetails)}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    return loadEnv();
  }
  return cachedEnv;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: EnvConfig;
  }
}
