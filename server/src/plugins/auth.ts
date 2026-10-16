import { type FastifyPluginAsync, type FastifyRequest, type FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema/users.js';
import { loadEnv } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  role: 'user' | 'admin';
  sessionId: string;
  iat?: number;
  exp?: number;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    emailVerifiedGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const env = fastify.hasDecorator('config') ? fastify.config : loadEnv();

  await fastify.register(fastifyCookie);
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: '15m',
    },
  });

  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<AccessTokenPayload>();

      if (!payload.sessionId || !payload.sub) {
        return reply.code(401).send({
          type: 'https://api.smexstore.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid token structure',
          code: 'INVALID_TOKEN',
        });
      }

      // Fast-path tombstone check via Redis
      const isRevoked = await fastify.redis.exists(`revoked_token:${payload.sessionId}`);
      if (isRevoked) {
        return reply.code(401).send({
          type: 'https://api.smexstore.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Session has been revoked',
          code: 'SESSION_REVOKED',
        });
      }

      request.user = payload;
    } catch (err: unknown) {
      return reply.code(401).send({
        type: 'https://api.smexstore.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: err instanceof Error ? err.message : 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }
  };

  const emailVerifiedGuard = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.sub) {
      return reply.code(401).send({
        type: 'https://api.smexstore.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const [userRecord] = await fastify.db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, request.user.sub))
      .limit(1);

    if (!userRecord || !userRecord.emailVerified) {
      return reply.code(403).send({
        type: 'https://api.smexstore.com/errors/email-verification-required',
        title: 'Email Verification Required',
        status: 403,
        detail: 'Email verification is required to perform this action.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }
  };

  const adminGuard = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({
        type: 'https://api.smexstore.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Admin privileges required',
        code: 'FORBIDDEN',
      });
    }
  };

  fastify.decorate('authenticate', authenticate);
  fastify.decorate('emailVerifiedGuard', emailVerifiedGuard);
  fastify.decorate('adminGuard', adminGuard);
};

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['redis', 'db'],
});
