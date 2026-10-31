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

export const loginIpRateLimitConfig: RateLimitOptions = {
  hook: 'onRequest',
  max: 15,
  timeWindow: 60 * 1000, // 60 seconds
  keyGenerator: (req) => `rl:login:ip:${req.ip}`,
  errorResponseBuilder,
};

export async function loginIpRateLimitHook(request: FastifyRequest, reply: any) {
  const redis = (request.server as any).redis;
  if (!redis) return;

  const ip = request.ip;
  const key = `rl:login:ip:${ip}`;
  const max = 15;
  const windowSeconds = 60;

  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.ttl(key);
  const results = await pipeline.exec();
  const current = Number(results?.[0]?.[1] ?? 1);
  let ttl = Number(results?.[1]?.[1] ?? -1);

  if (ttl === -1) {
    await redis.expire(key, windowSeconds);
    ttl = windowSeconds;
  }

  const ttlMs = (ttl > 0 ? ttl : windowSeconds) * 1000;
  const retryAfter = Math.ceil(ttlMs / 1000);

  if (current > max) {
    reply.header('Retry-After', retryAfter);
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', 0);
    reply.header('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + retryAfter);

    return reply.code(429).send({
      type: 'https://api.smexstore.com/errors/rate-limit-exceeded',
      title: 'Too Many Requests',
      status: 429,
      detail: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      instance: request.url,
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }
}

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
    let clientIp = '127.0.0.1';
    try {
      clientIp = req.ip || '127.0.0.1';
    } catch {
      clientIp = req.raw?.socket?.remoteAddress || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    }
    return `rl:search:${user?.sub || clientIp}`;
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
    keyGenerator: (req) => {
      let clientIp = '127.0.0.1';
      try {
        clientIp = req.ip || '127.0.0.1';
      } catch {
        clientIp = req.raw?.socket?.remoteAddress || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      }
      return `rl:global:${clientIp}`;
    },
    errorResponseBuilder,
  });
};

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  dependencies: ['redis'],
});
