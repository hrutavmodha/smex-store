import { type FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCors, { type FastifyCorsOptions } from '@fastify/cors';
import { getEnv } from '../config/env.js';

export interface SecurityCorsOptions {
  allowedOrigins?: string[];
  maxAge?: number;
}

const corsPlugin: FastifyPluginAsync<SecurityCorsOptions> = async (fastify, opts) => {
  const env = getEnv();
  const configuredOrigins = opts.allowedOrigins ?? env.CORS_ORIGIN.split(',').map((s) => s.trim());

  const corsOptions: FastifyCorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.NODE_ENV === 'development') {
        const isLocal =
          origin.startsWith('http://localhost:') ||
          origin.startsWith('https://localhost:') ||
          origin.startsWith('http://127.0.0.1:') ||
          origin.startsWith('https://127.0.0.1:');
        if (isLocal) {
          callback(null, true);
          return;
        }
      }

      if (configuredOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy violation: Origin '${origin}' is not allowed.`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Device-Fingerprint',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Response-Time', 'Content-Range'],
    maxAge: opts.maxAge ?? 86400,
    preflight: true,
    strictPreflight: true,
  };

  await fastify.register(fastifyCors, corsOptions);
};

export default fp(corsPlugin, {
  name: 'cors',
});
