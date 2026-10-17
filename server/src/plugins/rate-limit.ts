import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRateLimit, {
  type RateLimitOptions,
  type errorResponseBuilderContext,
} from '@fastify/rate-limit';

interface EmailBody {
  email?: unknown;
}

export function errorResponseBuilder(
  request: FastifyRequest,
  context: errorResponseBuilderContext
) {
  const retryAfter = Math.ceil(context.ttl / 1000);
  return {
    type: 'https://api.smexstore.com/errors/rate-limit-exceeded',
    title: 'Too Many Requests',
    status: 429,
    detail: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
    instance: request.url,
    code: 'RATE_LIMIT_EXCEEDED',
  };
}

export const registerRateLimitConfig: RateLimitOptions = {
  hook: 'onRequest',
  max: 3,
  timeWindow: 3600 * 1000, // 1 hour
  keyGenerator: (req) => `rl:register:${req.ip}`,
  errorResponseBuilder,
};

export const loginRateLimitConfig: RateLimitOptions = {
  hook: 'preValidation',
  max: 5,
  timeWindow: 60 * 1000, // 60 seconds
  keyGenerator: (req) => {
    const email = String((req.body as EmailBody | undefined)?.email || '')
      .toLowerCase()
      .trim();
    return `rl:login:${req.ip}:${email}`;
  },
  errorResponseBuilder,
};

export const forgotPasswordRateLimitConfig: RateLimitOptions = {
  hook: 'preValidation',
  max: 3,
  timeWindow: 3600 * 1000, // 1 hour
  keyGenerator: (req) => {
    const email = String((req.body as EmailBody | undefined)?.email || '')
      .toLowerCase()
      .trim();
    return `rl:forgot:${req.ip}:${email}`;
  },
  errorResponseBuilder,
};

export const resendVerificationRateLimitConfig: RateLimitOptions = {
  hook: 'preValidation',
  max: 3,
  timeWindow: 3600 * 1000, // 1 hour
  keyGenerator: (req) => {
    const email = String((req.body as EmailBody | undefined)?.email || '')
      .toLowerCase()
      .trim();
    return `rl:resend:${req.ip}:${email}`;
  },
  errorResponseBuilder,
};

export const presignedUploadRateLimitConfig: RateLimitOptions = {
  hook: 'preValidation',
  max: 10,
  timeWindow: 3600 * 1000, // 1 hour
  keyGenerator: (req) => {
    const user = (req as FastifyRequest & { user?: { sub?: string } }).user;
    return `rl:upload:${user?.sub || req.ip}`;
  },
  errorResponseBuilder,
};

export const searchRateLimitConfig: RateLimitOptions = {
  hook: 'onRequest',
  max: 60,
  timeWindow: 60 * 1000, // 60 seconds
  keyGenerator: (req) => {
    const user = (req as FastifyRequest & { user?: { sub?: string } }).user;
    return `rl:search:${user?.sub || req.ip}`;
  },
  errorResponseBuilder,
};


const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 300,
    timeWindow: 60 * 1000,
    hook: 'onRequest',
    redis: fastify.redis,
    keyGenerator: (req) => `rl:global:${req.ip}`,
    errorResponseBuilder,
  });
};

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  dependencies: ['redis'],
});
